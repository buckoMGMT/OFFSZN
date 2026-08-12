"""Plan definitions and entitlement arithmetic.

This module is the single source of truth for what a plan includes. The pricing
page, the Stripe products, the database `plan_limits` rows and this file all use
the same four plan codes; the earlier draft used three different vocabularies
(page: Rail/Control Room/Network, schema: starter/creator/pro/agency, env:
STARTER/CREATOR/PRO), which is how customers end up paying for one thing and
being granted another.

Deliberately pure Python with no database or network, so the rules that decide
whether someone can publish are unit-testable without a stack.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from enum import Enum
from typing import Optional

UNLIMITED = -1


class Meter(str, Enum):
    MONITORED_HOURS = "monitored_hours"
    PUBLISHED_CLIPS = "published_clips"
    LIVE_SOURCES = "live_sources"
    SEATS = "seats"


@dataclass(frozen=True)
class Plan:
    code: str
    display_name: str
    live_sources: int
    monitored_hours: int          # UNLIMITED allowed
    published_clips: int
    connected_accounts: int       # UNLIMITED
    seats: int                    # UNLIMITED
    storage_gb: int
    price_monthly_cents: int
    price_annual_cents: int
    clip_overage_cents: int
    overage_cap_cents: int
    # Rejections beyond published_clips * this stop being free. Without a cap,
    # "rejected clips are free" is an unmetered tier for anyone willing to
    # reject every clip after pulling the render.
    free_reject_multiplier: float
    sort_order: int

    @property
    def annual_monthly_equivalent_cents(self) -> int:
        return round(self.price_annual_cents / 12)


# Annual is ten months' price: two months free, matching the pricing page.
PLANS: dict[str, Plan] = {
    p.code: p
    for p in [
        Plan("trial", "Trial", 1, 10, 20, UNLIMITED, 1, 10, 0, 0, 0, 0, 3.0, 0),
        Plan("rail", "Rail", 1, 60, 80, UNLIMITED, 1, 40,
             2_900, 29_000, 35, 7_900, 3.0, 1),
        Plan("control_room", "Control Room", 3, 200, 400, UNLIMITED, 4, 200,
             7_900, 79_000, 35, 24_900, 3.0, 2),
        # Monitored hours are metered here rather than unlimited. Twelve sources
        # against an unmetered watcher is the one shape in this table that can
        # run a negative margin, and 600 hours is 50 per source per month --
        # past any real agency roster, but bounded.
        Plan("network", "Network", 12, 600, 1_500, UNLIMITED, UNLIMITED, 600,
             24_900, 249_000, 30, 99_900, 3.0, 3),
    ]
}

ORDERED = sorted(PLANS.values(), key=lambda p: p.sort_order)


def get_plan(code: str) -> Plan:
    try:
        return PLANS[code]
    except KeyError:
        raise ValueError(
            f"Unknown plan {code!r}. Known plans: {', '.join(PLANS)}"
        ) from None


def next_plan_up(code: str) -> Optional[Plan]:
    plan = get_plan(code)
    higher = [p for p in ORDERED if p.sort_order > plan.sort_order]
    return higher[0] if higher else None


# ---------------------------------------------------------------------------
# Overage
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class OverageQuote:
    billable_clips: int
    raw_cents: int
    charged_cents: int
    capped: bool
    upgrade_hint: Optional[str]

    @property
    def savings_from_upgrade_cents(self) -> int:
        return max(0, self.raw_cents - self.charged_cents)


def quote_overage(plan_code: str, clips_published: int) -> OverageQuote:
    """Price clips published beyond the plan allowance.

    Overage is capped at the price of the next plan up, so the worst case for a
    customer who ignores every warning is that they paid for the tier they
    should have been on. A pipeline is never killed to enforce a limit -- the
    failure mode of an always-on product must not be silence.
    """
    plan = get_plan(plan_code)
    if plan.published_clips == UNLIMITED:
        return OverageQuote(0, 0, 0, False, None)

    billable = max(0, clips_published - plan.published_clips)
    raw = billable * plan.clip_overage_cents
    capped = raw > plan.overage_cap_cents
    charged = min(raw, plan.overage_cap_cents)

    hint = None
    if billable > 0:
        nxt = next_plan_up(plan_code)
        if nxt is not None and charged >= nxt.price_monthly_cents - plan.price_monthly_cents:
            hint = nxt.code

    return OverageQuote(billable, raw, charged, capped, hint)


# ---------------------------------------------------------------------------
# Free-rejection guard
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RejectionRuling:
    refunded: bool
    reason: str


def rule_on_rejection(
    plan_code: str,
    *,
    had_egress: bool,
    free_rejections_used: int,
) -> RejectionRuling:
    """Decide whether rejecting a clip returns it to the allowance.

    Two conditions, both load-bearing:

    `had_egress` -- the rendered file already left our systems (downloaded,
    fetched over the API, opened via a share link). Once the customer has the
    artifact, rejecting it is not "the ranker was wrong", it is taking the
    product for free.

    `free_rejections_used` -- even without egress, unlimited free rejections let
    a workspace run the pipeline forever at zero marginal charge. The cap is
    generous (3x the plan's clip allowance) so an honest creator with a picky
    taste never sees it.
    """
    plan = get_plan(plan_code)
    if had_egress:
        return RejectionRuling(
            False, "Clip was downloaded or fetched before rejection, so it counts as published."
        )

    if plan.published_clips == UNLIMITED:
        return RejectionRuling(True, "Rejected before egress.")

    cap = int(plan.published_clips * plan.free_reject_multiplier)
    if free_rejections_used >= cap:
        return RejectionRuling(
            False,
            f"Free-rejection cap reached ({cap} this period). Further rejections count "
            f"toward the clip allowance.",
        )
    return RejectionRuling(True, "Rejected before egress.")


# ---------------------------------------------------------------------------
# Entitlement checks
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Usage:
    monitored_seconds: int = 0
    clips_published: int = 0
    live_sources: int = 0
    seats: int = 0
    free_rejections_used: int = 0


@dataclass(frozen=True)
class Decision:
    allowed: bool
    # Distinct from `allowed`: over allowance but still running, on the meter.
    billable_overage: bool
    message: str
    meter: Optional[Meter] = None


def check(plan_code: str, meter: Meter, usage: Usage) -> Decision:
    """Can this workspace do one more of `meter` right now?

    Monitored hours and published clips are soft: past the allowance they keep
    working and accrue capped overage. Live sources and seats are hard, because
    they are structural rather than consumption -- allowing a 13th source on a
    12-source plan is not an overage, it is a different product.
    """
    plan = get_plan(plan_code)

    if meter is Meter.LIVE_SOURCES:
        if plan.live_sources != UNLIMITED and usage.live_sources >= plan.live_sources:
            return Decision(
                False, False,
                f"{plan.display_name} covers {plan.live_sources} live "
                f"source{'s' if plan.live_sources != 1 else ''}. Upgrade to connect another.",
                meter,
            )
        return Decision(True, False, "", meter)

    if meter is Meter.SEATS:
        if plan.seats != UNLIMITED and usage.seats >= plan.seats:
            return Decision(
                False, False,
                f"{plan.display_name} includes {plan.seats} seat"
                f"{'s' if plan.seats != 1 else ''}. Upgrade to invite more.",
                meter,
            )
        return Decision(True, False, "", meter)

    if meter is Meter.MONITORED_HOURS:
        if plan.monitored_hours == UNLIMITED:
            return Decision(True, False, "", meter)
        used_hours = usage.monitored_seconds / 3600
        if used_hours >= plan.monitored_hours:
            # Never detach a live watcher mid-stream over an allowance. The
            # budget guard (observability/budget.py) is the only thing that
            # detaches, and it does so on real spend, not on plan limits.
            return Decision(
                True, True,
                f"Past {plan.monitored_hours} monitored hours. Monitoring continues; "
                f"extra hours are included, clip overage applies at "
                f"${plan.clip_overage_cents / 100:.2f} each.",
                meter,
            )
        return Decision(True, False, "", meter)

    if meter is Meter.PUBLISHED_CLIPS:
        if plan.published_clips == UNLIMITED:
            return Decision(True, False, "", meter)
        if usage.clips_published >= plan.published_clips:
            quote = quote_overage(plan_code, usage.clips_published + 1)
            if quote.capped:
                return Decision(
                    True, True,
                    f"Overage capped at ${plan.overage_cap_cents / 100:.2f} this period. "
                    f"Publishing continues at no further charge.",
                    meter,
                )
            return Decision(
                True, True,
                f"Past {plan.published_clips} clips. Each further clip is "
                f"${plan.clip_overage_cents / 100:.2f}, capped at "
                f"${plan.overage_cap_cents / 100:.2f}.",
                meter,
            )
        return Decision(True, False, "", meter)

    raise ValueError(f"Unhandled meter: {meter}")


# ---------------------------------------------------------------------------
# Margin model
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CostModel:
    """Marginal cost assumptions, in USD.

    Estimates until `packages/observability/cost.py` has production data.
    `margin_for_plan` exists so that when real numbers land, every tier can be
    re-checked with one command instead of a spreadsheet.

    The single most consequential line is `asr_per_candidate_hour`. Hosted
    speech APIs run around $0.36 per audio-hour; self-hosted faster-whisper on
    an L4 at roughly 25x realtime is about $0.035. At 60 monitored hours that is
    the difference between a 55% and an 85% gross margin on the entry tier --
    self-hosted ASR is not an optimisation here, it is the business model.
    Swap in `CostModel(asr_per_candidate_hour=0.36)` to see the hosted case.
    """
    watch_per_hour: float = 0.02          # CPU container: HLS tail + chat socket
    asr_per_candidate_hour: float = 0.035  # self-hosted, ~25x realtime on an L4
    candidate_fraction: float = 0.12       # share of stream reaching stage two
    llm_rank_per_hour: float = 0.02        # one batched ranking call per ~12 windows
    render_per_clip: float = 0.006         # NVENC, captions burned in the same pass
    upload_per_clip: float = 0.006         # egress, ~15 MB to each destination
    storage_per_gb_month: float = 0.021    # blended, with lifecycle to infrequent access


def cogs_for_usage(
    monitored_hours: float, clips_published: int, storage_gb: float = 0.0,
    model: CostModel = CostModel(),
) -> float:
    per_hour = (
        model.watch_per_hour
        + model.asr_per_candidate_hour * model.candidate_fraction
        + model.llm_rank_per_hour
    )
    return (
        monitored_hours * per_hour
        + clips_published * (model.render_per_clip + model.upload_per_clip)
        + storage_gb * model.storage_per_gb_month
    )


def margin_for_plan(plan_code: str, model: CostModel = CostModel()) -> dict:
    """Gross margin at full allowance use -- the worst realistic case.

    Reported to two decimals rather than rounded to a headline number, because
    the whole point is to notice when a tier drifts under target.
    """
    plan = get_plan(plan_code)
    hours = plan.monitored_hours if plan.monitored_hours != UNLIMITED else 720
    cogs = cogs_for_usage(hours, plan.published_clips, plan.storage_gb, model)
    revenue = plan.price_monthly_cents / 100
    return {
        "plan": plan.code,
        "revenue_usd": round(revenue, 2),
        "cogs_usd": round(cogs, 2),
        "gross_profit_usd": round(revenue - cogs, 2),
        "gross_margin": round(1 - cogs / revenue, 4) if revenue else None,
        "assumes": "every included hour and clip consumed",
    }
