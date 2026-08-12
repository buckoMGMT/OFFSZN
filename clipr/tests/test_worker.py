"""Job queue mechanics.

The retry policy is tested in memory. The claim protocol is tested against a
real Postgres, because the property that matters -- two workers polling the same
queue never get the same job -- is a property of `FOR UPDATE SKIP LOCKED` and
cannot be observed through a mock.
"""

from __future__ import annotations

import os
import subprocess
import uuid
from datetime import timedelta

import pytest

from packages.pipeline.worker import (
    CHECKPOINT_SQL,
    CLAIM_SQL,
    COMPLETE_SQL,
    PERMANENT_ERRORS,
    QUEUE_HEALTH_SQL,
    Disposition,
    Stage,
    decide_retry,
)

# ---------------------------------------------------------------------------
# Retry policy — no database
# ---------------------------------------------------------------------------


def test_transient_failures_retry():
    d = decide_retry(error_code="PROVIDER_TIMEOUT", retry_count=0, max_retries=3)
    assert d.should_requeue and d.delay is not None


@pytest.mark.parametrize("code", sorted(PERMANENT_ERRORS))
def test_permanent_failures_never_retry(code):
    """Retrying a deleted source forever burns GPU on something that cannot
    succeed, and looks like abuse to whichever API keeps refusing us."""
    d = decide_retry(error_code=code, retry_count=0, max_retries=3)
    assert d.disposition is Disposition.FAIL_PERMANENT
    assert d.delay is None


def test_exhausted_retries_go_to_the_dead_letter_queue():
    d = decide_retry(error_code="PROVIDER_TIMEOUT", retry_count=3, max_retries=3)
    assert d.disposition is Disposition.DEAD_LETTER
    assert "human" in d.reason


def test_backoff_grows_and_is_capped():
    delays = [
        decide_retry(error_code="X", retry_count=i, max_retries=10, jitter=1.0).delay
        for i in range(8)
    ]
    assert delays == sorted(delays)
    assert delays[-1] <= timedelta(seconds=1800)


def test_jitter_spreads_the_retry():
    """Without it, a provider outage synchronises every worker's retry into a
    herd that arrives exactly when the provider is recovering."""
    low = decide_retry(error_code="X", retry_count=3, max_retries=9, jitter=0.0).delay
    high = decide_retry(error_code="X", retry_count=3, max_retries=9, jitter=1.0).delay
    assert low < high


# ---------------------------------------------------------------------------
# Claim protocol — real Postgres
# ---------------------------------------------------------------------------

DSN = os.environ.get("CLIPR_TEST_DSN")
db = pytest.mark.skipif(not DSN, reason="CLIPR_TEST_DSN not set")


def sql(query: str) -> str:
    proc = subprocess.run(
        ["psql", DSN, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query],
        capture_output=True, text=True, timeout=30,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr.strip())
    return proc.stdout.strip()


def claim(worker: str, lease: str = "10 minutes") -> str:
    """CLAIM_SQL with its parameters inlined, so psql can run it."""
    return sql(
        CLAIM_SQL.replace("$1", f"'{worker}'").replace("$2", f"'{lease}'")
        + " ;"
    )


@pytest.fixture
def queue():
    """One workspace, one VOD, and a factory for queued jobs."""
    ws, vod = str(uuid.uuid4()), str(uuid.uuid4())
    sql(f"""
        INSERT INTO workspaces (id, name, plan) VALUES ('{ws}', 'queue test', 'rail');
        INSERT INTO vods (id, workspace_id, title, status)
          VALUES ('{vod}', '{ws}', 'source', 'ready');
    """)

    def add(pipeline_version: str, **columns) -> str:
        job = str(uuid.uuid4())
        cols = "".join(f", {k}" for k in columns)
        vals = "".join(f", {v}" for v in columns.values())
        sql(f"INSERT INTO processing_jobs (id, workspace_id, vod_id, pipeline_version{cols}) "
            f"VALUES ('{job}', '{ws}', '{vod}', '{pipeline_version}'{vals});")
        return job

    yield type("Q", (), {"ws": ws, "vod": vod, "add": staticmethod(add)})
    sql(f"DELETE FROM workspaces WHERE id = '{ws}';")


@db
def test_a_queued_job_is_claimed(queue):
    job = queue.add("v1")
    assert job in claim("worker-a")
    assert sql(f"SELECT status, worker_id FROM processing_jobs WHERE id = '{job}';") \
        == "running|worker-a"


@db
def test_two_workers_never_claim_the_same_job(queue):
    """The property a mock cannot show. A plain SELECT-then-UPDATE is a race
    that double-charges the cost ledger and double-publishes the clip."""
    first, second = queue.add("v1"), queue.add("v2")
    a, b = claim("worker-a"), claim("worker-b")
    assert a and b and a != b
    assert {first, second} == {a.split("|")[0], b.split("|")[0]}


@db
def test_an_empty_queue_returns_nothing(queue):
    assert claim("worker-a") == ""


@db
def test_a_live_lease_is_not_stolen(queue):
    queue.add("v1")
    claim("worker-a")
    assert claim("worker-b") == ""


@db
def test_an_expired_lease_is_reclaimed(queue):
    """The only thing that recovers work from a worker that died. Without it,
    `status='running'` is a permanent leak and the clips never appear."""
    job = queue.add("v1")
    claim("worker-a", lease="-1 second")
    reclaimed = claim("worker-b")
    assert job in reclaimed
    assert sql(f"SELECT worker_id FROM processing_jobs WHERE id = '{job}';") == "worker-b"


@db
def test_reclaiming_counts_as_an_attempt(queue):
    """Otherwise a job that reliably kills its worker loops forever."""
    job = queue.add("v1")
    claim("worker-a", lease="-1 second")
    claim("worker-b")
    assert sql(f"SELECT retry_count FROM processing_jobs WHERE id = '{job}';") == "1"


@db
def test_a_job_waiting_on_backoff_is_invisible(queue):
    queue.add("v1", status="'queued'", next_attempt_at="now() + interval '1 hour'")
    assert claim("worker-a") == ""


@db
def test_backoff_expiry_makes_the_job_claimable(queue):
    job = queue.add("v1", status="'queued'", next_attempt_at="now() - interval '1 second'")
    assert job in claim("worker-a")


@db
def test_oldest_job_is_claimed_first(queue):
    old = queue.add("v1", queued_at="now() - interval '1 hour'")
    queue.add("v2", queued_at="now()")
    assert old in claim("worker-a")


@db
def test_checkpoints_merge_rather_than_overwrite(queue):
    """A retry must skip stages that already succeeded, or transcription gets
    paid for twice."""
    job = queue.add("v1")
    claim("worker-a")
    for stage, payload in ((Stage.INGEST, '{"bytes": 1}'), (Stage.TRANSCRIBE, '{"segments": 9}')):
        sql(CHECKPOINT_SQL
            .replace("$1", f"'{job}'")
            .replace("$2", f"""'{{"{stage.value}": {payload}}}'""")
            .replace("$3", f"'{stage.value}'")
            .replace("$4", "'worker-a'") + ";")
    stored = sql(f"SELECT stage_checkpoints FROM processing_jobs WHERE id = '{job}';")
    assert "ingest" in stored and "transcribe" in stored


@db
def test_only_the_holding_worker_can_complete_a_job(queue):
    """A worker whose lease lapsed must not be able to mark work done after
    another worker has picked it up."""
    job = queue.add("v1")
    claim("worker-a")
    assert sql(COMPLETE_SQL.replace("$1", f"'{job}'").replace("$2", "'worker-b'") + ";") == ""
    assert sql(COMPLETE_SQL.replace("$1", f"'{job}'").replace("$2", "'worker-a'") + ";") != ""


@db
def test_the_same_vod_cannot_be_queued_twice_for_one_pipeline(queue):
    """Idempotency: a duplicate go-live webhook must not double-process, which
    would double every cost line for that stream."""
    queue.add("v1")
    with pytest.raises(AssertionError, match="duplicate key"):
        queue.add("v1")


@db
def test_a_new_pipeline_version_may_reprocess_the_same_vod(queue):
    queue.add("v1")
    queue.add("clipr-ai-v2")   # allowed: different pipeline


@db
def test_queue_health_surfaces_orphans(queue):
    """Depth is the vanity metric. How long the oldest job has waited, and how
    many leases have lapsed, are what predict an incident."""
    queue.add("v1", queued_at="now() - interval '10 minutes'")
    queue.add("v2", status="'running'", worker_id="'a-worker-that-died'",
              lease_expires_at="now() - interval '1 minute'")
    queued, running, orphaned, oldest = sql(QUEUE_HEALTH_SQL + ";").split("|")
    assert int(queued) == 1
    assert int(running) == 1
    assert int(orphaned) == 1
    assert float(oldest) >= 600
