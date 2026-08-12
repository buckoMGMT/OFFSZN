"""Job queue: claiming, leasing, retrying, giving up.

An unattended pipeline fails in exactly two ways, and both are quiet:

* A worker dies mid-job. `status='running'` is not self-healing -- without a
  lease the row sits there forever and the creator's clips never appear. The
  original schema had no lease at all.
* Two workers claim the same job. `SELECT ... FOR UPDATE SKIP LOCKED` is the
  fix; a plain `SELECT ... LIMIT 1` followed by an `UPDATE` is a race that
  double-charges the cost ledger and double-publishes.

The SQL below is verified against a real Postgres in `tests/test_worker.py`,
including the two-workers-one-job case, which cannot be tested with a mock.

The retry policy is pure Python so the interesting decisions -- what is worth
retrying, when to stop -- are testable without a database.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import timedelta
from enum import StrEnum
from typing import Protocol

LEASE = timedelta(minutes=10)


class Stage(StrEnum):
    INGEST = "ingest"
    DETECT = "detect"
    TRANSCRIBE = "transcribe"
    RANK = "rank"
    RENDER = "render"
    SCREEN = "screen"
    PUBLISH = "publish"


class Disposition(StrEnum):
    RETRY = "retry"
    DEAD_LETTER = "dead_letter"
    FAIL_PERMANENT = "fail_permanent"


# Retrying a bad clip forever burns GPU on something that will never succeed,
# and looks like abuse to whichever API is refusing us.
PERMANENT_ERRORS = frozenset({
    "SOURCE_DELETED",
    "SOURCE_PRIVATE",
    "UNSUPPORTED_CODEC",
    "ZERO_LENGTH_SOURCE",
    "WORKSPACE_SUSPENDED",
    "BUDGET_DETACHED",
})


@dataclass(frozen=True)
class RetryDecision:
    disposition: Disposition
    delay: timedelta | None
    reason: str

    @property
    def should_requeue(self) -> bool:
        return self.disposition is Disposition.RETRY


def decide_retry(
    *, error_code: str, retry_count: int, max_retries: int, jitter: float = 1.0
) -> RetryDecision:
    """What to do with a job that just failed.

    Jitter is a parameter rather than a hidden `random()` call so the backoff
    curve is testable. Production passes a random value: without it, a
    provider outage synchronises every worker's retry into a thundering herd
    that arrives exactly when the provider is trying to recover.
    """
    if error_code in PERMANENT_ERRORS:
        return RetryDecision(
            Disposition.FAIL_PERMANENT, None,
            f"{error_code} will not succeed on a retry.",
        )

    if retry_count >= max_retries:
        return RetryDecision(
            Disposition.DEAD_LETTER, None,
            f"Exhausted {max_retries} retries; moved to the dead-letter queue for a human.",
        )

    base = min(30 * (3 ** retry_count), 1800)
    return RetryDecision(
        Disposition.RETRY,
        timedelta(seconds=base * (0.5 + 0.5 * jitter)),
        f"Attempt {retry_count + 1} of {max_retries}.",
    )


def jittered() -> float:
    # Spreading retries, not generating a secret. random is the right tool here;
    # secrets.SystemRandom would be cargo cult.
    return random.random()  # nosec B311


# ---------------------------------------------------------------------------
# SQL
# ---------------------------------------------------------------------------

# One statement: find, lock, and claim. SKIP LOCKED lets N workers poll the
# same queue without blocking each other or colliding.
CLAIM_SQL = """
WITH claimable AS (
  SELECT id FROM processing_jobs
  WHERE (
      status = 'queued'
      -- A running job whose lease has lapsed is presumed orphaned. This is the
      -- only thing that recovers work from a worker that died.
      OR (status = 'running' AND lease_expires_at < now())
    )
    AND (next_attempt_at IS NULL OR next_attempt_at <= now())
  ORDER BY queued_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE processing_jobs j
SET status = 'running',
    worker_id = $1,
    lease_expires_at = now() + $2::interval,
    started_at = COALESCE(j.started_at, now()),
    -- A reclaimed lease counts as an attempt, otherwise a job that reliably
    -- kills its worker loops forever.
    retry_count = CASE WHEN j.status = 'running' THEN j.retry_count + 1 ELSE j.retry_count END
FROM claimable c
WHERE j.id = c.id
RETURNING j.id, j.workspace_id, j.vod_id, j.retry_count, j.max_retries, j.stage_checkpoints
"""

# Called periodically while a stage runs. A worker that stops heartbeating
# loses its claim, which is the point.
RENEW_SQL = """
UPDATE processing_jobs
SET lease_expires_at = now() + $2::interval
WHERE id = $1 AND worker_id = $3 AND status = 'running'
RETURNING id
"""

# Checkpoints merge rather than overwrite, so a retry can skip stages that
# already succeeded instead of paying for transcription twice.
CHECKPOINT_SQL = """
UPDATE processing_jobs
SET stage_checkpoints = stage_checkpoints || $2::jsonb,
    current_stage = $3
WHERE id = $1 AND worker_id = $4
RETURNING stage_checkpoints
"""

COMPLETE_SQL = """
UPDATE processing_jobs
SET status = 'succeeded', finished_at = now(), lease_expires_at = NULL, error = NULL
WHERE id = $1 AND worker_id = $2 AND status = 'running'
RETURNING id
"""

REQUEUE_SQL = """
UPDATE processing_jobs
SET status = 'queued',
    retry_count = retry_count + 1,
    next_attempt_at = now() + $3::interval,
    lease_expires_at = NULL,
    worker_id = NULL,
    error = $2
WHERE id = $1
RETURNING retry_count
"""

FAIL_SQL = """
UPDATE processing_jobs
SET status = $3, finished_at = now(), lease_expires_at = NULL, worker_id = NULL, error = $2
WHERE id = $1
RETURNING id
"""

DEAD_LETTER_SQL = """
INSERT INTO dead_letter_jobs (job_id, workspace_id, vod_id, last_error, payload)
SELECT id, workspace_id, vod_id, $2, jsonb_build_object(
  'retry_count', retry_count,
  'current_stage', current_stage,
  'stage_checkpoints', stage_checkpoints,
  'pipeline_version', pipeline_version
)
FROM processing_jobs WHERE id = $1
RETURNING id
"""

# Queue health, for the metric that actually predicts an incident: not depth,
# but how long the oldest waiting job has been waiting.
QUEUE_HEALTH_SQL = """
SELECT
  count(*) FILTER (WHERE status = 'queued')                              AS queued,
  count(*) FILTER (WHERE status = 'running')                             AS running,
  count(*) FILTER (WHERE status = 'running' AND lease_expires_at < now()) AS orphaned,
  COALESCE(EXTRACT(EPOCH FROM (now() - min(queued_at)
           FILTER (WHERE status = 'queued'))), 0)                        AS oldest_wait_seconds
FROM processing_jobs
"""


class Db(Protocol):
    async def fetchrow(self, sql: str, *args): ...
    async def fetchval(self, sql: str, *args): ...
    async def execute(self, sql: str, *args): ...


@dataclass
class Claim:
    job_id: str
    workspace_id: str
    vod_id: str
    retry_count: int
    max_retries: int
    checkpoints: dict


class JobQueue:
    def __init__(self, db: Db, worker_id: str, lease: timedelta = LEASE):
        self.db = db
        self.worker_id = worker_id
        self.lease = lease

    async def claim(self) -> Claim | None:
        row = await self.db.fetchrow(CLAIM_SQL, self.worker_id, self.lease)
        if row is None:
            return None
        return Claim(
            job_id=str(row["id"]),
            workspace_id=str(row["workspace_id"]),
            vod_id=str(row["vod_id"]),
            retry_count=row["retry_count"],
            max_retries=row["max_retries"],
            checkpoints=row["stage_checkpoints"] or {},
        )

    async def renew(self, job_id: str) -> bool:
        return await self.db.fetchval(RENEW_SQL, job_id, self.lease, self.worker_id) is not None

    async def checkpoint(self, job_id: str, stage: Stage, payload: dict) -> None:
        import json
        await self.db.execute(
            CHECKPOINT_SQL, job_id, json.dumps({stage.value: payload}),
            stage.value, self.worker_id,
        )

    async def complete(self, job_id: str) -> bool:
        return await self.db.fetchval(COMPLETE_SQL, job_id, self.worker_id) is not None

    async def fail(self, claim: Claim, *, error_code: str, message: str) -> RetryDecision:
        decision = decide_retry(
            error_code=error_code,
            retry_count=claim.retry_count,
            max_retries=claim.max_retries,
            jitter=jittered(),
        )
        detail = f"{error_code}: {message}"

        if decision.disposition is Disposition.RETRY:
            await self.db.fetchval(REQUEUE_SQL, claim.job_id, detail, decision.delay)
        elif decision.disposition is Disposition.DEAD_LETTER:
            # Record before transitioning, so a crash between the two leaves the
            # job visibly stuck rather than silently gone.
            await self.db.fetchval(DEAD_LETTER_SQL, claim.job_id, detail)
            await self.db.fetchval(FAIL_SQL, claim.job_id, detail, "dead_letter")
        else:
            await self.db.fetchval(FAIL_SQL, claim.job_id, detail, "failed")

        return decision

    async def health(self) -> dict:
        row = await self.db.fetchrow(QUEUE_HEALTH_SQL)
        return dict(row) if row else {}
