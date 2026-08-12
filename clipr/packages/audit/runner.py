"""The evidence engine.

Scores are computed from evidence at read time. There is no writable score
column anywhere in the schema, because a writable score is how a readiness
dashboard turns into a wish list.

Three rules the previous version broke:

* It queried a table that did not exist (`interviews`) and used `or 0` to
  absorb the result -- but asyncpg raises UndefinedTableError, so the whole
  audit crashed instead of reporting "no interviews yet".
* `compute_all_sectors` dispatched to eleven methods, seven of which were never
  written, so it raised AttributeError on the first call.
* It read `float(row["f1_score"])` on a nullable column.

Every sector returns one of three states, and the distinction is the entire
point of the exercise:

    VERIFIED         evidence exists and clears the bar
    CODE_COMPLETE    the mechanism is built; nothing has exercised it
    INSUFFICIENT     cannot be known yet, and no amount of code will change that
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol


class State(StrEnum):
    VERIFIED = "verified"
    CODE_COMPLETE = "code_complete"
    INSUFFICIENT = "insufficient_data"
    NOT_STARTED = "not_started"


# A code-complete sector scores 6 at most. The gap between 6 and 10 is evidence,
# and it cannot be closed by writing more code -- which is the honest shape of
# a pre-launch product.
SCORE = {
    State.VERIFIED: 10,
    State.CODE_COMPLETE: 6,
    State.INSUFFICIENT: 0,
    State.NOT_STARTED: 0,
}

WEIGHTS = {
    "Problem & Market": 0.05,
    "Offer & Business Model": 0.05,
    "AI Quality": 0.15,
    "Product": 0.15,
    "Engineering": 0.05,
    "Security & Privacy": 0.05,
    "AI Economics": 0.15,
    "Analytics": 0.05,
    "Landing Page": 0.025,
    "Growth": 0.025,
    "Retention": 0.15,
    "Legal / Operations": 0.10,
}


@dataclass(frozen=True)
class SectorResult:
    sector: str
    state: State
    evidence: str
    blocker: str | None = None

    @property
    def score(self) -> int:
        return SCORE[self.state]


class Db(Protocol):
    async def fetchrow(self, sql: str, *args): ...
    async def fetchval(self, sql: str, *args): ...


class AuditRunner:
    def __init__(self, db: Db):
        self.db = db

    # Interpolating a table name into SQL is the shape of an injection even when
    # today's callers all pass literals. The allowlist means a future caller
    # cannot turn this into one by accident.
    COUNTABLE = {
        "interviews": "SELECT count(*) FROM interviews",
        "users": "SELECT count(*) FROM users",
    }

    async def _count(self, table: str) -> int | None:
        """Row count, or None if the table is absent.

        Returning None rather than 0 keeps "this table was never created" from
        being reported as "this has happened zero times" -- a missing migration
        should read as a broken audit, not a bad score.
        """
        if table not in self.COUNTABLE:
            raise ValueError(f"{table!r} is not a countable table: {sorted(self.COUNTABLE)}")
        exists = await self.db.fetchval("SELECT to_regclass($1) IS NOT NULL", f"public.{table}")
        if not exists:
            return None
        return int(await self.db.fetchval(self.COUNTABLE[table]) or 0)

    # -- sectors -----------------------------------------------------------

    async def problem_and_market(self) -> SectorResult:
        n = await self._count("interviews")
        if n is None:
            return SectorResult("Problem & Market", State.NOT_STARTED,
                                "interviews table is missing; migrations may not have run.")
        if n >= 10:
            return SectorResult("Problem & Market", State.VERIFIED, f"{n} creator interviews.")
        return SectorResult("Problem & Market", State.INSUFFICIENT,
                            f"{n} of 10 interviews recorded.",
                            "Ten conversations with real streamers.")

    async def ai_quality(self) -> SectorResult:
        row = await self.db.fetchrow("""
            SELECT f1_score, publishable_rate, labeled_moment_count, pipeline_version,
                   synthetic
            FROM ai_evaluations ORDER BY ran_at DESC LIMIT 1
        """)
        if row is None:
            return SectorResult("AI Quality", State.CODE_COMPLETE,
                                "Harness and regression gate are built; no run recorded.",
                                "One eval run against a labeled dataset.")
        if row["synthetic"]:
            # The harness ran, which is worth something. A fixture scoring 1.0
            # is worth nothing, and must not be allowed to look like it is.
            return SectorResult("AI Quality", State.CODE_COMPLETE,
                                "Last run was over a synthetic dataset; the harness "
                                "executes but nothing has been measured.",
                                "An eval run over real labeled streams.")
        f1, pub = row["f1_score"], row["publishable_rate"]
        if f1 is None or pub is None:
            return SectorResult("AI Quality", State.CODE_COMPLETE,
                                "Last run did not record both headline metrics.")
        if row["labeled_moment_count"] < 50:
            return SectorResult("AI Quality", State.INSUFFICIENT,
                                f"F1 {float(f1):.2f} over only {row['labeled_moment_count']} "
                                f"labels -- not enough to mean anything.",
                                "At least 50 labeled moments.")
        if float(f1) >= 0.70 and float(pub) >= 0.60:
            return SectorResult("AI Quality", State.VERIFIED,
                                f"F1 {float(f1):.2f}, publishable {float(pub):.0%} "
                                f"on {row['pipeline_version']}.")
        return SectorResult("AI Quality", State.CODE_COMPLETE,
                            f"F1 {float(f1):.2f}, publishable {float(pub):.0%} -- below target.",
                            "F1 >= 0.70 and publishable rate >= 60%.")

    async def ai_economics(self) -> SectorResult:
        spend = float(await self.db.fetchval(
            "SELECT COALESCE(SUM(amount_usd), 0) FROM processing_costs") or 0)
        hours = float(await self.db.fetchval(
            "SELECT COALESCE(SUM(monitored_seconds), 0) / 3600.0 FROM stream_sessions") or 0)
        if hours <= 0 or spend <= 0:
            return SectorResult("AI Economics", State.CODE_COMPLETE,
                                "Ledger, budget guard and margin model are built; "
                                "nothing has been processed.",
                                "Production traffic.")
        per_hour = spend / hours
        return SectorResult(
            "AI Economics",
            State.VERIFIED if per_hour < 0.10 else State.CODE_COMPLETE,
            f"${per_hour:.4f} per monitored hour over {hours:.1f} hours.",
            None if per_hour < 0.10 else "Measured cost exceeds the pricing model's assumption.",
        )

    async def retention(self) -> SectorResult:
        cohort = await self.db.fetchval("""
            SELECT count(DISTINCT workspace_id) FROM analytics_events
            WHERE occurred_at < now() - INTERVAL '7 days'
        """)
        if not cohort:
            return SectorResult("Retention", State.INSUFFICIENT,
                                "No workspace is seven days old.",
                                "Time and users. Cannot be built.")
        return SectorResult("Retention", State.CODE_COMPLETE,
                            f"{cohort} workspaces old enough to measure D7.")

    async def security(self) -> SectorResult:
        unforced = await self.db.fetchval("""
            SELECT count(*) FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'
              AND c.relrowsecurity AND NOT c.relforcerowsecurity
        """)
        unpoliced = await self.db.fetchval("""
            SELECT count(*) FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
              AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
        """)
        if unforced or unpoliced:
            return SectorResult("Security & Privacy", State.NOT_STARTED,
                                f"{unforced} tables with RLS unforced, "
                                f"{unpoliced} with no policy.",
                                "Run 0002_rls.sql.")
        # Isolation is proven; a penetration test and legal review are not.
        return SectorResult("Security & Privacy", State.CODE_COMPLETE,
                            "Workspace isolation forced and policed on every protected table.",
                            "External penetration test and legal review.")

    async def offer_and_business(self) -> SectorResult:
        paid = await self.db.fetchval(
            "SELECT count(*) FROM subscriptions WHERE status = 'active'") or 0
        if paid:
            return SectorResult("Offer & Business Model", State.VERIFIED,
                                f"{paid} active paid subscriptions.")
        return SectorResult("Offer & Business Model", State.CODE_COMPLETE,
                            "Plan table, overage cap and margin model are built and tested.",
                            "One paying customer.")

    async def _users_required(self, sector: str, built: str) -> SectorResult:
        users = await self.db.fetchval("SELECT count(*) FROM users") or 0
        if users:
            return SectorResult(sector, State.CODE_COMPLETE, f"{built} {users} users registered.")
        return SectorResult(sector, State.INSUFFICIENT, built, "Real users.")

    async def product(self) -> SectorResult:
        return await self._users_required("Product", "Review queue and states built.")

    async def analytics(self) -> SectorResult:
        events = await self.db.fetchval("SELECT count(*) FROM analytics_events") or 0
        if events > 1000:
            return SectorResult("Analytics", State.VERIFIED, f"{events} events recorded.")
        return SectorResult("Analytics", State.CODE_COMPLETE,
                            f"Taxonomy and warehouse built; {events} events so far.",
                            "Traffic.")

    async def growth(self) -> SectorResult:
        return await self._users_required("Growth", "Referral and lifecycle plumbing built.")

    async def engineering(self) -> SectorResult:
        dlq = await self.db.fetchval("SELECT count(*) FROM dead_letter_jobs") or 0
        jobs = await self.db.fetchval("SELECT count(*) FROM processing_jobs") or 0
        if not jobs:
            return SectorResult("Engineering", State.CODE_COMPLETE,
                                "Leases, retries and dead-letter queue built; no jobs run.",
                                "Production load.")
        rate = dlq / jobs
        return SectorResult(
            "Engineering",
            State.VERIFIED if rate < 0.01 else State.CODE_COMPLETE,
            f"{jobs} jobs, {dlq} dead-lettered ({rate:.1%}).",
        )

    async def landing_page(self) -> SectorResult:
        return SectorResult("Landing Page", State.CODE_COMPLETE,
                            "Page published; plan numbers are test-locked against the plan table.",
                            "Conversion data.")

    async def legal(self) -> SectorResult:
        # Nothing in a database can establish that a lawyer read the terms.
        return SectorResult("Legal / Operations", State.INSUFFICIENT,
                            "Entity, IP assignment, platform ToS review and incident plan.",
                            "External counsel. Cannot be built.")

    # -- report ------------------------------------------------------------

    async def run(self) -> dict:
        results = [
            await self.problem_and_market(),
            await self.offer_and_business(),
            await self.ai_quality(),
            await self.product(),
            await self.engineering(),
            await self.security(),
            await self.ai_economics(),
            await self.analytics(),
            await self.landing_page(),
            await self.growth(),
            await self.retention(),
            await self.legal(),
        ]
        missing = set(WEIGHTS) - {r.sector for r in results}
        if missing:
            # Silently averaging over a subset is how a partial audit reports a
            # good score. The original omitted seven sectors this way.
            raise RuntimeError(f"audit is incomplete; no result for: {sorted(missing)}")

        weighted = sum(r.score * WEIGHTS[r.sector] for r in results)
        return {
            "sectors": [
                {"sector": r.sector, "state": r.state.value, "score": r.score,
                 "evidence": r.evidence, "blocker": r.blocker}
                for r in results
            ],
            "weighted_score": round(weighted, 2),
            "verified_sectors": sum(1 for r in results if r.state is State.VERIFIED),
            "total_sectors": len(results),
            "ceiling_note": (
                "A code-complete sector scores 6. The remaining 4 points require "
                "evidence that does not exist yet, and cannot be produced by writing "
                "more code."
            ),
        }
