"""Unit economics, and the budget guard that stops a runaway from eating a month
of revenue in an afternoon.

The previous cost query was wrong in a way that would have been very hard to
notice, because it produced a plausible-looking number:

    FROM processing_costs pc
    LEFT JOIN vods v ON pc.workspace_id = v.workspace_id
       AND pc.job_id IN (SELECT id FROM processing_jobs WHERE vod_id = v.id)
    ...
    GROUP BY pc.cost_category

Every cost row joined every VOD in the workspace, then `SUM(duration/3600)` was
summed again across categories. Hours were multiplied by roughly
(#vods x #categories), so cost-per-hour came out low by an order of magnitude or
more -- and the one metric the pricing depends on would have read as healthy
while margins were underwater.

The fix is structural, not a smarter join: `processing_costs.stream_session_id`
attributes spend directly, so the numerator and the denominator are two
independent single-table aggregates that cannot fan out.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Protocol

# ---------------------------------------------------------------------------
# SQL
# ---------------------------------------------------------------------------

SPEND_SQL = """
SELECT cost_category, SUM(amount_usd) AS total
FROM processing_costs
WHERE incurred_at >= $1
  AND ($2::uuid IS NULL OR workspace_id = $2)
GROUP BY cost_category
"""

MONITORED_HOURS_SQL = """
SELECT COALESCE(SUM(monitored_seconds), 0) / 3600.0 AS hours
FROM stream_sessions
WHERE started_at >= $1
  AND ($2::uuid IS NULL OR workspace_id = $2)
"""

PUBLISHED_CLIPS_SQL = """
SELECT COUNT(*) AS n
FROM publish_jobs
WHERE published_at >= $1
  AND status = 'published'
  AND ($2::uuid IS NULL OR workspace_id = $2)
"""

# Margin per workspace. Cost and revenue are aggregated separately and joined on
# workspace_id only -- one row per workspace on each side, so no fan-out.
MARGIN_BY_PLAN_SQL = """
WITH spend AS (
  SELECT workspace_id, SUM(amount_usd) AS cogs
  FROM processing_costs
  WHERE incurred_at >= $1
  GROUP BY workspace_id
)
SELECT
  s.plan,
  COUNT(*)                                        AS customers,
  SUM(pl.price_monthly_cents) / 100.0              AS mrr_usd,
  COALESCE(SUM(spend.cogs), 0)                     AS cogs_usd,
  SUM(pl.price_monthly_cents) / 100.0 - COALESCE(SUM(spend.cogs), 0) AS gross_profit_usd,
  CASE WHEN SUM(pl.price_monthly_cents) > 0
       THEN 1 - COALESCE(SUM(spend.cogs), 0) / (SUM(pl.price_monthly_cents) / 100.0)
  END                                              AS gross_margin
FROM subscriptions s
JOIN plan_limits pl ON pl.plan = s.plan
LEFT JOIN spend ON spend.workspace_id = s.workspace_id
WHERE s.status IN ('active', 'past_due')
GROUP BY s.plan
ORDER BY s.plan
"""

# Workspaces costing more than they pay. The list a founder should read weekly.
UNDERWATER_SQL = """
WITH spend AS (
  SELECT workspace_id, SUM(amount_usd) AS cogs
  FROM processing_costs
  WHERE incurred_at >= $1
  GROUP BY workspace_id
)
SELECT s.workspace_id, s.plan, spend.cogs,
       pl.price_monthly_cents / 100.0 AS revenue_usd,
       spend.cogs - pl.price_monthly_cents / 100.0 AS loss_usd
FROM spend
JOIN subscriptions s ON s.workspace_id = spend.workspace_id
JOIN plan_limits pl ON pl.plan = s.plan
WHERE spend.cogs > pl.price_monthly_cents / 100.0
ORDER BY loss_usd DESC
"""


class Db(Protocol):
    async def fetch(self, sql: str, *args): ...
    async def fetchval(self, sql: str, *args): ...


@dataclass
class UnitEconomics:
    period_days: int
    total_cost_usd: float
    monitored_hours: float
    published_clips: int
    cost_per_monitored_hour: float | None
    cost_per_published_clip: float | None
    by_category: dict[str, float]
    as_of: str

    @property
    def has_signal(self) -> bool:
        return self.monitored_hours > 0 and self.total_cost_usd > 0


class CostEngine:
    def __init__(self, db: Db):
        self.db = db

    async def unit_economics(
        self, *, workspace_id: str | None = None, days: int = 30
    ) -> UnitEconomics:
        since = datetime.now(UTC) - timedelta(days=days)

        rows = await self.db.fetch(SPEND_SQL, since, workspace_id)
        by_category = {r["cost_category"]: float(r["total"] or 0) for r in rows}
        total = sum(by_category.values())

        hours = float(await self.db.fetchval(MONITORED_HOURS_SQL, since, workspace_id) or 0)
        clips = int(await self.db.fetchval(PUBLISHED_CLIPS_SQL, since, workspace_id) or 0)

        return UnitEconomics(
            period_days=days,
            total_cost_usd=round(total, 4),
            monitored_hours=round(hours, 2),
            published_clips=clips,
            # None, not zero. A dashboard that shows $0.00/hour because nothing
            # has run yet is indistinguishable from one showing genuinely free
            # processing, and the first is the state we are actually in.
            cost_per_monitored_hour=round(total / hours, 4) if hours > 0 else None,
            cost_per_published_clip=round(total / clips, 4) if clips > 0 else None,
            by_category={k: round(v, 4) for k, v in by_category.items()},
            as_of=datetime.now(UTC).isoformat(),
        )

    async def margin_by_plan(self, days: int = 30) -> list[dict]:
        since = datetime.now(UTC) - timedelta(days=days)
        return [dict(r) for r in await self.db.fetch(MARGIN_BY_PLAN_SQL, since)]

    async def underwater_workspaces(self, days: int = 30) -> list[dict]:
        since = datetime.now(UTC) - timedelta(days=days)
        return [dict(r) for r in await self.db.fetch(UNDERWATER_SQL, since)]


# ---------------------------------------------------------------------------
# Budget guard
# ---------------------------------------------------------------------------


class GuardAction(StrEnum):
    CONTINUE = "continue"
    WARN = "warn"
    THROTTLE = "throttle"
    DETACH = "detach"


@dataclass(frozen=True)
class GuardDecision:
    action: GuardAction
    message: str
    spend_usd: float
    ceiling_usd: float

    @property
    def ratio(self) -> float:
        return self.spend_usd / self.ceiling_usd if self.ceiling_usd else 0.0


# Default ceiling: several times the modeled COGS for the plan, so it catches a
# runaway (a stuck retry loop, a pathological source) without ever firing on a
# heavy but legitimate month.
DEFAULT_CEILING_MULTIPLE = 4.0


def evaluate_budget(
    *, spend_usd: float, plan_price_usd: float, ceiling_usd: float | None = None
) -> GuardDecision:
    """Decide what to do about a workspace's month-to-date spend.

    Throttling before detaching matters: for an always-on product, silence is
    the worst possible failure, so the guard degrades service (lower candidate
    fraction, cheaper ranking) before it ever stops watching a live stream.
    Detach is reserved for spend that is clearly pathological.
    """
    ceiling = ceiling_usd if ceiling_usd is not None else plan_price_usd * DEFAULT_CEILING_MULTIPLE
    if ceiling <= 0:
        return GuardDecision(GuardAction.CONTINUE, "No ceiling configured.", spend_usd, 0.0)

    ratio = spend_usd / ceiling
    if ratio < 0.75:
        return GuardDecision(GuardAction.CONTINUE, "", spend_usd, ceiling)
    if ratio < 1.0:
        return GuardDecision(
            GuardAction.WARN,
            f"Processing spend is {ratio:.0%} of this workspace's ceiling.",
            spend_usd, ceiling,
        )
    if ratio < 2.0:
        return GuardDecision(
            GuardAction.THROTTLE,
            "Ceiling reached. Monitoring continues on the cheap detection path; "
            "LLM ranking is paused for this workspace.",
            spend_usd, ceiling,
        )
    return GuardDecision(
        GuardAction.DETACH,
        f"Spend is {ratio:.1f}x the ceiling, which indicates a fault rather than usage. "
        "Watchers detached and the account flagged for a human.",
        spend_usd, ceiling,
    )
