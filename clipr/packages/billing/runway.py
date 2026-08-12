"""Runway: how far into a month does each plan get you, and what happens then.

The question this answers is the one a streamer actually asks — "I stream this
much; when do I hit the wall?" — and the two products answer it in different
units, which is exactly why comparing monthly prices tells you nothing.

The load-bearing assumption is `MINUTES_PER_CREDIT = 1`: that a credit is one
minute of *source* video, charged on ingest. That comes from third-party
write-ups, not from Opus's own pricing page, where the definition sits behind a
tooltip. **If it is wrong, every credit number here is wrong**, so it is a named
constant with a warning attached rather than a figure baked into a table.

Everything about ClipR comes from `plans.py`, which is test-locked against the
schema and the pricing page.
"""

from __future__ import annotations

from dataclasses import dataclass

from packages.billing.plans import UNLIMITED, get_plan, next_plan_up

# --- competitor model, from third-party sources ----------------------------

# UNVERIFIED. Read from external write-ups; the definition on opus.pro sits
# behind an info tooltip. Worth ten seconds of hovering to confirm before
# anyone quotes these numbers publicly.
MINUTES_PER_CREDIT = 1.0

CREDIT_PLANS = {
    "opus_starter": {"name": "OpusClip Starter", "usd": 15.0, "credits": 150,
                     "billing": "monthly only"},
    # 3,600/yr granted instantly, so a heavy month can draw down the whole year.
    # Shown as the annual grant, not a monthly slice, because that is how it
    # actually behaves.
    "opus_pro_annual": {"name": "OpusClip Pro (annual)", "usd": 14.5, "credits": 3600,
                        "billing": "$174 billed annually"},
}


@dataclass(frozen=True)
class Runway:
    plan: str
    price_usd: float
    limit_hours: float | None      # None = not the binding limit
    binding_limit: str
    what_happens: str

    @property
    def hours(self) -> float:
        return self.limit_hours if self.limit_hours is not None else float("inf")


def credit_runway(plan_key: str) -> Runway:
    """Hours of stream a credit plan covers, if you feed it the whole stream."""
    plan = CREDIT_PLANS[plan_key]
    hours = plan["credits"] * MINUTES_PER_CREDIT / 60
    return Runway(
        plan=plan["name"],
        price_usd=plan["usd"],
        limit_hours=hours,
        binding_limit=f"{plan['credits']} credits ({plan['credits']:,} source minutes)",
        what_happens="Hard stop. Buy more credits to keep processing.",
    )


def clipr_runway(plan_code: str, clips_per_hour: float) -> Runway:
    """Hours of stream a ClipR plan covers.

    Two meters, so the answer depends on how clippable the stream is: a quiet
    stream runs out of hours, a highly clippable one runs out of clips first.
    Reporting only the hours allowance would overstate the runway for exactly
    the customer we most want.
    """
    plan = get_plan(plan_code)
    hours_limit = float("inf") if plan.monitored_hours == UNLIMITED else plan.monitored_hours
    clips_limit = (float("inf") if plan.published_clips == UNLIMITED
                   else plan.published_clips / clips_per_hour if clips_per_hour else float("inf"))

    if clips_limit < hours_limit:
        binding = f"{plan.published_clips} published clips"
        limit = clips_limit
    else:
        binding = f"{plan.monitored_hours} monitored hours"
        limit = hours_limit

    nxt = next_plan_up(plan_code)
    cap = plan.overage_cap_cents / 100
    what = (f"Keeps running. ${plan.clip_overage_cents / 100:.2f} per extra clip, "
            f"capped at ${cap:.0f}")
    what += f" — the price of {nxt.display_name}." if nxt else "."

    return Runway(
        plan=f"ClipR {plan.display_name}",
        price_usd=plan.price_monthly_cents / 100,
        limit_hours=None if limit == float("inf") else limit,
        binding_limit=binding,
        what_happens=what,
    )


# --- the comparison --------------------------------------------------------


def month_cost_credits(plan_key: str, hours: float, credit_price_usd: float = 0.10) -> dict:
    """What a month costs on a credit plan if the whole stream is processed.

    `credit_price_usd` is an estimate; Opus does not publish a per-credit
    overage rate on the pricing page. The exhaustion point above is solid
    arithmetic — this figure is not, and is labelled that way wherever it
    appears.
    """
    plan = CREDIT_PLANS[plan_key]
    needed = hours * 60 / MINUTES_PER_CREDIT
    extra = max(0.0, needed - plan["credits"])
    return {
        "plan": plan["name"],
        "credits_needed": round(needed),
        "credits_included": plan["credits"],
        "credits_short": round(extra),
        "base_usd": plan["usd"],
        "estimated_total_usd": round(plan["usd"] + extra * credit_price_usd, 2),
        "estimate_warning": "Overage rate is our estimate, not a published figure.",
    }


def month_cost_clipr(plan_code: str, hours: float, clips_per_hour: float) -> dict:
    plan = get_plan(plan_code)
    clips = hours * clips_per_hour
    over = max(0, clips - plan.published_clips)
    raw = over * plan.clip_overage_cents / 100
    charged = min(raw, plan.overage_cap_cents / 100)
    base = plan.price_monthly_cents / 100
    return {
        "plan": f"ClipR {plan.display_name}",
        "clips_published": round(clips),
        "clips_included": plan.published_clips,
        "base_usd": base,
        "overage_usd": round(charged, 2),
        "total_usd": round(base + charged, 2),
        "capped": raw > charged,
    }


def compare(hours_per_month: float, clips_per_hour: float = 2.5) -> dict:
    """Both models at one usage level. `clips_per_hour` is the honest fudge
    factor: it decides which ClipR meter binds, and it varies enormously by
    what someone streams."""
    return {
        "hours_per_month": hours_per_month,
        "clips_per_hour": clips_per_hour,
        "runways": [
            credit_runway("opus_starter"),
            credit_runway("opus_pro_annual"),
            clipr_runway("rail", clips_per_hour),
            clipr_runway("control_room", clips_per_hour),
        ],
        "costs": [
            month_cost_credits("opus_starter", hours_per_month),
            month_cost_clipr("rail", hours_per_month, clips_per_hour),
            month_cost_clipr("control_room", hours_per_month, clips_per_hour),
        ],
    }


def breakeven_hours(clips_per_hour: float = 2.5, credit_price_usd: float = 0.10) -> float:
    """Streamed hours per month above which ClipR Rail costs less than staying
    on Opus Starter and processing everything.

    Below this number they are cheaper and we should say so rather than pretend
    otherwise. It is the single most useful figure in this module.
    """
    lo, hi = 0.0, 400.0
    for _ in range(60):
        mid = (lo + hi) / 2
        theirs = month_cost_credits("opus_starter", mid, credit_price_usd)["estimated_total_usd"]
        ours = month_cost_clipr("rail", mid, clips_per_hour)["total_usd"]
        if theirs < ours:
            lo = mid
        else:
            hi = mid
    return round(hi, 1)
