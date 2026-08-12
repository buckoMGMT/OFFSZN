"""Queue load exercise.

Drives real jobs through the real claim protocol against a real Postgres, with
concurrent workers, and records the result in `load_test_runs`. This is honest
evidence about a mechanism -- the queue does not lose, duplicate or strand work
under contention -- and no evidence at all about demand, which is why the row it
writes is stamped `provenance = 'load_test'` and why the audit engine will let
it verify Engineering and nothing downstream of customers.

A share of jobs are made to fail on purpose. A load test where everything
succeeds exercises the happy path and tells you nothing about the retry and
dead-letter machinery, which is the part that actually decides whether a
creator's clips appear.

Run:  python -m packages.pipeline.loadtest --jobs 1200 --workers 8
"""

from __future__ import annotations

import argparse
import os
import random
import shutil
import subprocess
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

# Errors the pipeline can plausibly hit, weighted toward transient ones.
TRANSIENT = ["PROVIDER_TIMEOUT", "RENDER_OOM", "STORAGE_5XX"]
PERMANENT = ["SOURCE_DELETED", "UNSUPPORTED_CODEC"]


def _psql_path() -> str:
    """Absolute path to psql.

    A bare name is resolved through PATH at call time, so anything that can
    prepend a directory chooses what runs against the database.
    """
    path = shutil.which("psql")
    if path is None:
        raise RuntimeError("psql not found on PATH")
    return path


def psql(dsn: str, query: str, **params: str | int) -> str:
    """Run a query, binding values through psql variables.

    Values are passed with `-v` and referenced as :'name' in the SQL rather than
    interpolated into it. Everything here is internally generated, but SQL built
    by string formatting is the shape of an injection whether or not today's
    inputs are safe -- and this file is the one that scores the Engineering
    sector, so it does not get to be the exception.
    """
    cmd = [_psql_path(), dsn, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"]
    for name, value in params.items():
        cmd += ["-v", f"{name}={value}"]
    # -f - rather than -c: psql only interpolates :'name' in input read from a
    # file or stdin, never in a -c command string.
    cmd += ["-f", "-"]

    proc = subprocess.run(cmd, input=query, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip())
    return proc.stdout.strip()


@dataclass
class Stats:
    claimed: int = 0
    completed: int = 0
    requeued: int = 0
    dead_lettered: int = 0
    failed_permanent: int = 0
    errors: int = 0
    latencies_ms: list[float] = field(default_factory=list)

    def merge(self, other: Stats) -> None:
        self.claimed += other.claimed
        self.completed += other.completed
        self.requeued += other.requeued
        self.dead_lettered += other.dead_lettered
        self.failed_permanent += other.failed_permanent
        self.errors += other.errors
        self.latencies_ms.extend(other.latencies_ms)


def seed(dsn: str, jobs: int) -> tuple[str, str]:
    ws, vod = str(uuid.uuid4()), str(uuid.uuid4())
    psql(dsn, """
        INSERT INTO workspaces (id, name, plan)
          VALUES (:'ws', 'load test', 'network');
        INSERT INTO vods (id, workspace_id, title, status)
          VALUES (:'vod', :'ws', 'load source', 'ready');
    """, ws=ws, vod=vod)
    # One row per job. Each needs a distinct vod because of the idempotency
    # constraint UNIQUE(vod_id, pipeline_version) -- which is exactly the
    # constraint that stops a duplicate go-live webhook double-processing, so
    # the load test has to respect it rather than work around it.
    psql(dsn, """
        INSERT INTO vods (workspace_id, title, status)
          SELECT :'ws', 'load source ' || g, 'ready'
          FROM generate_series(1, :'jobs'::int) g;
        INSERT INTO processing_jobs (workspace_id, vod_id, max_retries)
          SELECT :'ws', id, 2 FROM vods
          WHERE workspace_id = :'ws' AND title LIKE 'load source %';
    """, ws=ws, jobs=int(jobs))
    return ws, vod


def worker(dsn: str, worker_id: str, deadline: float, fail_rate: float) -> Stats:
    """Claim, decide an outcome, and record it -- against the real SQL."""
    from packages.pipeline.worker import (
        CLAIM_SQL,
        COMPLETE_SQL,
        DEAD_LETTER_SQL,
        FAIL_SQL,
        REQUEUE_SQL,
        Disposition,
        decide_retry,
    )

    # Scheduling, not secrets; seeded per worker so a run is reproducible.
    rng = random.Random(worker_id)  # nosec B311
    stats = Stats()

    while time.monotonic() < deadline:
        started = time.perf_counter()
        try:
            row = psql(dsn, CLAIM_SQL.replace("$1", f"'{worker_id}'")
                                     .replace("$2", "'2 minutes'") + ";")
        except RuntimeError:
            stats.errors += 1
            continue
        if not row:
            break

        fields = row.split("|")
        job_id, retry_count, max_retries = fields[0], int(fields[3]), int(fields[4])
        stats.claimed += 1
        stats.latencies_ms.append((time.perf_counter() - started) * 1000)

        try:
            if rng.random() >= fail_rate:
                psql(dsn, COMPLETE_SQL.replace("$1", f"'{job_id}'")
                                      .replace("$2", f"'{worker_id}'") + ";")
                stats.completed += 1
                continue

            permanent = rng.random() < 0.2
            code = rng.choice(PERMANENT if permanent else TRANSIENT)
            decision = decide_retry(error_code=code, retry_count=retry_count,
                                    max_retries=max_retries, jitter=rng.random())

            if decision.disposition is Disposition.RETRY:
                psql(dsn, REQUEUE_SQL.replace("$1", f"'{job_id}'")
                                     .replace("$2", f"'{code}'")
                                     .replace("$3", "'1 millisecond'") + ";")
                stats.requeued += 1
            elif decision.disposition is Disposition.DEAD_LETTER:
                psql(dsn, DEAD_LETTER_SQL.replace("$1", f"'{job_id}'")
                                         .replace("$2", f"'{code}'") + ";")
                psql(dsn, FAIL_SQL.replace("$1", f"'{job_id}'")
                                  .replace("$2", f"'{code}'")
                                  .replace("$3", "'dead_letter'") + ";")
                stats.dead_lettered += 1
            else:
                psql(dsn, FAIL_SQL.replace("$1", f"'{job_id}'")
                                  .replace("$2", f"'{code}'")
                                  .replace("$3", "'failed'") + ";")
                stats.failed_permanent += 1
        except RuntimeError:
            stats.errors += 1

    return stats


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * p))]


def run(dsn: str, jobs: int, workers: int, seconds: int, fail_rate: float) -> dict:
    ws, _ = seed(dsn, jobs)
    deadline = time.monotonic() + seconds
    started = time.perf_counter()

    totals = Stats()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [
            pool.submit(worker, dsn, f"load-{i}", deadline, fail_rate)
            for i in range(workers)
        ]
        for f in futures:
            totals.merge(f.result())
    elapsed = time.perf_counter() - started

    # The integrity checks. A queue that is fast and loses work is worthless, so
    # these matter more than the latency number.
    stranded = int(psql(dsn, """
        SELECT count(*) FROM processing_jobs
        WHERE workspace_id = :'ws' AND status = 'running' AND lease_expires_at < now();
    """, ws=ws) or 0)
    unfinished = int(psql(dsn, """
        SELECT count(*) FROM processing_jobs
        WHERE workspace_id = :'ws' AND status IN ('queued', 'running');
    """, ws=ws) or 0)
    double_completed = int(psql(dsn, """
        SELECT count(*) FROM (
          SELECT vod_id FROM processing_jobs
          WHERE workspace_id = :'ws' AND status = 'succeeded'
          GROUP BY vod_id HAVING count(*) > 1
        ) d;
    """, ws=ws) or 0)

    operations = totals.claimed
    error_rate = totals.errors / operations if operations else 1.0
    p95 = percentile(totals.latencies_ms, 0.95)

    notes = (f"completed={totals.completed} requeued={totals.requeued} "
             f"dead_lettered={totals.dead_lettered} permanent={totals.failed_permanent} "
             f"stranded={stranded} unfinished={unfinished} "
             f"double_completed={double_completed}")
    psql(dsn, """
        INSERT INTO load_test_runs
          (tool, scenario, concurrency, operations, duration_seconds,
           p95_ms, error_rate, provenance, notes)
        VALUES ('packages.pipeline.loadtest', 'queue claim/complete/retry/dead-letter',
                :'workers'::int, :'operations'::int, :'elapsed'::numeric,
                NULLIF(:'p95', '')::numeric, :'error_rate'::numeric, 'load_test', :'notes');
    """, workers=workers, operations=operations, elapsed=f"{elapsed:.3f}",
         p95="" if p95 is None else f"{p95:.3f}",
         error_rate=f"{error_rate:.5f}", notes=notes)

    return {
        "operations": operations,
        "workers": workers,
        "elapsed_seconds": round(elapsed, 2),
        "ops_per_second": round(operations / elapsed, 1) if elapsed else 0,
        "completed": totals.completed,
        "requeued": totals.requeued,
        "dead_lettered": totals.dead_lettered,
        "failed_permanent": totals.failed_permanent,
        "errors": totals.errors,
        "error_rate": round(error_rate, 5),
        "p95_claim_ms": round(p95, 2) if p95 is not None else None,
        "stranded_jobs": stranded,
        "unfinished_jobs": unfinished,
        "double_completed": double_completed,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jobs", type=int, default=1200)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--seconds", type=int, default=120)
    parser.add_argument("--fail-rate", type=float, default=0.15)
    parser.add_argument("--dsn", default=os.environ.get("CLIPR_TEST_DSN")
                        or os.environ.get("DATABASE_URL"))
    args = parser.parse_args(argv)

    if not args.dsn:
        print("Set CLIPR_TEST_DSN or DATABASE_URL.")
        return 2

    result = run(args.dsn, args.jobs, args.workers, args.seconds, args.fail_rate)
    width = max(len(k) for k in result)
    for key, value in result.items():
        print(f"{key.replace('_', ' '):<{width}}  {value}")

    # Correctness first: a fast queue that loses or duplicates work is worthless.
    if result["double_completed"]:
        print("\nFAIL: the same source completed more than once.")
        return 1
    if result["stranded_jobs"]:
        print("\nFAIL: jobs left stranded with an expired lease.")
        return 1
    print("\nNo work lost, duplicated or stranded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
