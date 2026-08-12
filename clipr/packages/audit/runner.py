"""The evidence engine.

Scores are computed from evidence at read time. There is no writable score
column anywhere in the schema, because a writable score is how a readiness
dashboard turns into a wish list.

Defects fixed from the previous version:

* It queried a table that did not exist (`interviews`) and used `or 0` to absorb
  the result, but asyncpg raises UndefinedTableError -- so the audit crashed
  instead of reporting "no interviews yet".
* `compute_all_sectors` dispatched to eleven methods, seven of which were never
  written: AttributeError on the first call.
* It read `float(row["f1_score"])` on a nullable column.
* **Product, Growth and Landing Page had no path to VERIFIED.** No query could
  ever return the thing that would satisfy them, so 20% of the weighted score
  was permanently capped for reasons unrelated to evidence. An instrument that
  cannot reach its own top score is broken, not strict. Every sector now has a
  defined, checkable path, and the report prints what each one is waiting on.

Three states, and the distinction is the whole point:

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
# and it cannot be closed by writing more code -- which is the honest shape of a
# pre-launch product.
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

# What each sector needs, stated so it can be acted on rather than argued with.
# `actor` names who has to do it. "engineering" appears exactly once, which is
# the honest ratio for a product at this stage.
REQUIREMENTS = {
    "Problem & Market": ("10 recorded interviews with people who stream", "founder"),
    "Offer & Business Model": ("one active paid subscription", "market"),
    "AI Quality": ("F1 >= 0.70 and publishable >= 60% over 50+ moments "
                   "labeled from real streams", "labeling"),
    "Product": ("5 usability sessions with an observation record each", "founder"),
    "Engineering": ("a load run at 1000+ operations with <1% error, and a "
                    "dead-letter rate under 1%", "engineering"),
    "Security & Privacy": ("an external penetration test with no open criticals", "vendor"),
    "AI Economics": ("measured cost per monitored hour under $0.10 from "
                     "production traffic", "market"),
    "Analytics": ("1000+ events across 20+ event types from real sessions", "market"),
    "Landing Page": ("1000+ landing sessions with a measured signup rate", "market"),
    "Growth": ("one referral that converted to paid", "market"),
    "Retention": ("a cohort of 20+ at 7 days old with D7 >= 40%", "time"),
    "Legal / Operations": ("five signed reviews: entity, IP, terms, platform ToS, "
                           "incident response", "counsel"),
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
    # Interpolating a table name into SQL is the shape of an injection even when
    # today's callers all pass literals.
    COUNTABLE = {
        "interviews": "SELECT count(*) FROM interviews",
        "users": "SELECT count(*) FROM users",
    }

    def __init__(self, db: Db):
        self.db = db

    async def _count(self, table: str) -> int | None:
        """Row count, or None if the table is absent.

        None rather than 0 keeps "this table was never created" from being
        reported as "this has happened zero times". One is a failed migration,
        the other is a product gap, and they need different responses.
        """
        if table not in self.COUNTABLE:
            raise ValueError(f"{table!r} is not a countable table: {sorted(self.COUNTABLE)}")
        exists = await self.db.fetchval("SELECT to_regclass($1) IS NOT NULL", f"public.{table}")
        if not exists:
            return None
        return int(await self.db.fetchval(self.COUNTABLE[table]) or 0)

    async def _scalar(self, sql: str, *args, default=0):
        value = await self.db.fetchval(sql, *args)
        return default if value is None else value

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
                            f"{10 - n} more conversations with real streamers.")

    async def offer_and_business(self) -> SectorResult:
        paid = int(await self._scalar(
            "SELECT count(*) FROM subscriptions WHERE status = 'active'"))
        if paid:
            return SectorResult("Offer & Business Model", State.VERIFIED,
                                f"{paid} active paid subscriptions.")
        return SectorResult("Offer & Business Model", State.CODE_COMPLETE,
                            "Plan table, overage cap and margin model built, tested and "
                            "locked to the pricing page.",
                            "One paying customer.")

    async def ai_quality(self) -> SectorResult:
        row = await self.db.fetchrow("""
            SELECT f1_score, publishable_rate, labeled_moment_count, pipeline_version,
                   synthetic
            FROM ai_evaluations ORDER BY ran_at DESC LIMIT 1
        """)
        if row is None:
            return SectorResult("AI Quality", State.CODE_COMPLETE,
                                "Harness and regression gate built; no run recorded.",
                                "One eval run against a labeled dataset.")
        if row["synthetic"]:
            # The harness ran, which is worth something. A fixture scoring 1.0 is
            # worth nothing, and must not be allowed to look like it is.
            return SectorResult("AI Quality", State.CODE_COMPLETE,
                                "Last run was over a synthetic dataset; the harness "
                                "executes but nothing has been measured.",
                                "An eval run over real labeled streams.")
        f1, pub = row["f1_score"], row["publishable_rate"]
        if f1 is None or pub is None:
            return SectorResult("AI Quality", State.CODE_COMPLETE,
                                "Last run did not record both headline metrics.",
                                "A run that measures F1 and publishable rate.")
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

    async def product(self) -> SectorResult:
        """Usability sessions, not registered users.

        The previous version keyed this on user count and could only ever return
        CODE_COMPLETE -- there was no value of any column that would verify it.
        What the sector actually claims is that people can use the thing, and the
        evidence for that is watching five of them try.
        """
        sessions = int(await self._scalar("SELECT count(*) FROM usability_sessions"))
        if sessions == 0:
            return SectorResult("Product", State.CODE_COMPLETE,
                                "Review queue, empty and error states built.",
                                "5 usability sessions.")
        completed = int(await self._scalar(
            "SELECT count(*) FROM usability_sessions WHERE completed_task"))
        rate = completed / sessions
        if sessions >= 5 and rate >= 0.8:
            return SectorResult("Product", State.VERIFIED,
                                f"{completed} of {sessions} sessions completed the task "
                                f"({rate:.0%}).")
        if sessions >= 5:
            return SectorResult("Product", State.CODE_COMPLETE,
                                f"Only {rate:.0%} of {sessions} sessions completed the task.",
                                "80% task completion. Read blocking_issues and fix them.")
        return SectorResult("Product", State.CODE_COMPLETE,
                            f"{sessions} of 5 usability sessions recorded.",
                            f"{5 - sessions} more sessions.")

    async def engineering(self) -> SectorResult:
        """Reliability under load, plus the dead-letter rate in real operation.

        A load run is honest evidence about a mechanism and no evidence about
        demand, so it verifies this sector and nothing downstream of customers.
        """
        jobs = int(await self._scalar("SELECT count(*) FROM processing_jobs"))
        dlq = int(await self._scalar("SELECT count(*) FROM dead_letter_jobs"))
        run = await self.db.fetchrow("""
            SELECT operations, concurrency, error_rate, p95_ms, provenance, scenario
            FROM load_test_runs ORDER BY ran_at DESC LIMIT 1
        """)

        if run is None:
            return SectorResult("Engineering", State.CODE_COMPLETE,
                                "Leases, retries and a dead-letter queue built; "
                                "no load run recorded.",
                                "A load run at 1000+ operations.")

        ops, err = int(run["operations"]), float(run["error_rate"])
        dlq_rate = dlq / jobs if jobs else 0.0
        detail = (f"{run['scenario']}: {ops} operations at concurrency "
                  f"{run['concurrency']}, {err:.2%} errors")
        if run["p95_ms"] is not None:
            detail += f", p95 {float(run['p95_ms']):.1f}ms"
        detail += f"; dead-letter rate {dlq_rate:.2%} over {jobs} jobs"

        if ops >= 1000 and err < 0.01 and dlq_rate < 0.01:
            return SectorResult("Engineering", State.VERIFIED, detail)
        short = []
        if ops < 1000:
            short.append(f"only {ops} operations")
        if err >= 0.01:
            short.append(f"{err:.2%} error rate")
        if dlq_rate >= 0.01:
            short.append(f"{dlq_rate:.2%} dead-letter rate")
        return SectorResult("Engineering", State.CODE_COMPLETE, detail, "; ".join(short))

    async def security(self) -> SectorResult:
        unforced = int(await self._scalar("""
            SELECT count(*) FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'
              AND c.relrowsecurity AND NOT c.relforcerowsecurity
        """))
        unpoliced = int(await self._scalar("""
            SELECT count(*) FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
              AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
        """))
        if unforced or unpoliced:
            return SectorResult("Security & Privacy", State.NOT_STARTED,
                                f"{unforced} tables with RLS unforced, "
                                f"{unpoliced} with no policy.",
                                "Run 0002_rls.sql.")

        assessment = await self.db.fetchrow("""
            SELECT vendor, critical_findings_open, high_findings_open, completed_at
            FROM security_assessments
            WHERE assessment_type = 'penetration_test'
            ORDER BY completed_at DESC LIMIT 1
        """)
        if assessment is None:
            return SectorResult("Security & Privacy", State.CODE_COMPLETE,
                                "Workspace isolation forced and policed on every protected "
                                "table, proven against a live database.",
                                "An external penetration test.")
        if assessment["critical_findings_open"] == 0 and assessment["high_findings_open"] == 0:
            return SectorResult("Security & Privacy", State.VERIFIED,
                                f"Penetration test by {assessment['vendor']} "
                                f"({assessment['completed_at']}), no open criticals or highs.")
        return SectorResult("Security & Privacy", State.CODE_COMPLETE,
                            f"Penetration test by {assessment['vendor']}: "
                            f"{assessment['critical_findings_open']} critical, "
                            f"{assessment['high_findings_open']} high still open.",
                            "Close them.")

    async def ai_economics(self) -> SectorResult:
        spend = float(await self._scalar(
            "SELECT COALESCE(SUM(amount_usd), 0) FROM processing_costs"))
        hours = float(await self._scalar(
            "SELECT COALESCE(SUM(monitored_seconds), 0) / 3600.0 FROM stream_sessions"))
        if hours <= 0 or spend <= 0:
            return SectorResult("AI Economics", State.CODE_COMPLETE,
                                "Ledger, budget guard and margin model built; "
                                "nothing has been processed.",
                                "Production traffic.")
        per_hour = spend / hours
        if per_hour < 0.10:
            return SectorResult("AI Economics", State.VERIFIED,
                                f"${per_hour:.4f} per monitored hour over {hours:.1f} hours.")
        return SectorResult("AI Economics", State.CODE_COMPLETE,
                            f"${per_hour:.4f} per monitored hour over {hours:.1f} hours.",
                            "Measured cost exceeds the $0.10 the pricing assumes.")

    async def analytics(self) -> SectorResult:
        events = int(await self._scalar("SELECT count(*) FROM analytics_events"))
        named = int(await self._scalar(
            "SELECT count(DISTINCT event_name) FROM analytics_events"))
        if events >= 1000 and named >= 20:
            return SectorResult("Analytics", State.VERIFIED,
                                f"{events} events across {named} event types.")
        return SectorResult("Analytics", State.CODE_COMPLETE,
                            f"Taxonomy and warehouse built; {events} events, "
                            f"{named} event types so far.",
                            "1000+ events across 20+ types.")

    async def landing_page(self) -> SectorResult:
        """Measured signup rate, not "the page exists".

        Previously hardcoded to CODE_COMPLETE with no path onward.
        """
        row = await self.db.fetchrow("""
            SELECT COALESCE(SUM(sessions), 0) AS sessions,
                   COALESCE(SUM(signups_completed), 0) AS signups
            FROM landing_page_daily
        """)
        sessions = int(row["sessions"]) if row else 0
        signups = int(row["signups"]) if row else 0
        if sessions == 0:
            return SectorResult("Landing Page", State.CODE_COMPLETE,
                                "Page published; plan numbers are test-locked to the "
                                "plan table.",
                                "1000 landing sessions.")
        rate = signups / sessions
        if sessions >= 1000:
            return SectorResult("Landing Page", State.VERIFIED,
                                f"{signups} signups from {sessions} sessions ({rate:.1%}).")
        return SectorResult("Landing Page", State.CODE_COMPLETE,
                            f"{signups} signups from {sessions} sessions ({rate:.1%}) -- "
                            f"below the volume where a rate means anything.",
                            f"{1000 - sessions} more sessions.")

    async def growth(self) -> SectorResult:
        """One referral that converted to paid.

        Previously keyed on user count with no path to verification.
        """
        referrals = int(await self._scalar("SELECT count(*) FROM referrals"))
        converted = int(await self._scalar(
            "SELECT count(*) FROM referral_conversions WHERE converted_to_paid_at IS NOT NULL"))
        if converted:
            return SectorResult("Growth", State.VERIFIED,
                                f"{converted} referrals converted to paid.")
        if referrals:
            return SectorResult("Growth", State.CODE_COMPLETE,
                                f"{referrals} referral codes issued, none converted to paid.",
                                "One conversion.")
        return SectorResult("Growth", State.CODE_COMPLETE,
                            "Referral and lifecycle plumbing built.",
                            "One referral that converts.")

    async def retention(self) -> SectorResult:
        cohort = int(await self._scalar("""
            SELECT count(DISTINCT workspace_id) FROM analytics_events
            WHERE occurred_at < now() - INTERVAL '7 days'
        """))
        if not cohort:
            return SectorResult("Retention", State.INSUFFICIENT,
                                "No workspace is seven days old.",
                                "Time and users. Cannot be built.")
        returned = int(await self._scalar("""
            SELECT count(DISTINCT a.workspace_id) FROM analytics_events a
            WHERE a.occurred_at >= now() - INTERVAL '7 days'
              AND a.workspace_id IN (
                SELECT workspace_id FROM analytics_events
                WHERE occurred_at < now() - INTERVAL '7 days'
              )
        """))
        d7 = returned / cohort
        if cohort >= 20 and d7 >= 0.40:
            return SectorResult("Retention", State.VERIFIED,
                                f"D7 {d7:.0%} over a cohort of {cohort}.")
        return SectorResult("Retention", State.CODE_COMPLETE,
                            f"D7 {d7:.0%} over a cohort of {cohort}.",
                            "A cohort of 20+ with D7 >= 40%.")

    async def legal(self) -> SectorResult:
        """Five reviews, each signed by a named person.

        A database can record that counsel reviewed something. It cannot do the
        reviewing, which is why this sector stays at zero until someone else acts.
        """
        required = {"entity_formation", "ip_assignment", "terms_and_privacy",
                    "platform_tos", "incident_response"}
        done = await self.db.fetchval(
            "SELECT COALESCE(array_agg(review_type), '{}') FROM legal_reviews "
            "WHERE expires_at IS NULL OR expires_at > CURRENT_DATE"
        )
        have = set(done or [])
        missing = sorted(required - have)
        if not missing:
            return SectorResult("Legal / Operations", State.VERIFIED,
                                "All five reviews signed and current.")
        if have:
            return SectorResult("Legal / Operations", State.CODE_COMPLETE,
                                f"{len(have)} of 5 reviews complete.",
                                f"Still needed: {', '.join(missing)}.")
        return SectorResult("Legal / Operations", State.INSUFFICIENT,
                            "No reviews on file.",
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
            # good score. The original omitted seven sectors exactly this way.
            raise RuntimeError(f"audit is incomplete; no result for: {sorted(missing)}")

        weighted = sum(r.score * WEIGHTS[r.sector] for r in results)
        blocked = [
            {"sector": r.sector,
             "needs": REQUIREMENTS[r.sector][0],
             "who": REQUIREMENTS[r.sector][1],
             "weight_available": round((10 - r.score) * WEIGHTS[r.sector], 3)}
            for r in results if r.state is not State.VERIFIED
        ]
        return {
            "sectors": [
                {"sector": r.sector, "state": str(r.state), "score": r.score,
                 "evidence": r.evidence, "blocker": r.blocker}
                for r in results
            ],
            "weighted_score": round(weighted, 2),
            "verified_sectors": sum(1 for r in results if r.state is State.VERIFIED),
            "total_sectors": len(results),
            "remaining": sorted(blocked, key=lambda b: -b["weight_available"]),
            "remaining_by_actor": {
                actor: sorted(b["sector"] for b in blocked if b["who"] == actor)
                for actor in sorted({b["who"] for b in blocked})
            },
            # The honest headline: of the points still on the table, how many are
            # reachable by writing code at all.
            "points_reachable_by_engineering": round(
                sum(b["weight_available"] for b in blocked if b["who"] == "engineering"), 2),
        }
