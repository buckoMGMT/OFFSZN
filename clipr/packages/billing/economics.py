"""Whole-business economics, not just gross margin.

`plans.py` answers "what does one customer's usage cost us". That is the easy
half, it always looks good, and on its own it is how a business with 85% gross
margins runs out of money.

This file answers the question that decides whether to start at all:

    At what point does the whole thing stop losing money, and what is the
    worst customer it can survive?

Four costs the gross-margin model ignores entirely, all of them real:

* **Fixed platform cost.** Database, control plane, monitoring, log retention,
  the idle share of the render fleet. Paid whether anyone signs up or not, and
  divided across however few customers exist.
* **Free trials.** Fourteen days, full-featured, no card. A trial user who
  streams thirty hours and does not convert is pure loss, and at a 25%
  conversion rate every paying customer carries the cost of three who left.
* **Payment fees.** ~2.9% + $0.30. On a $29 plan that is 3.9%, and it comes
  off the top of every month.
* **Support.** Human minutes per customer per month. The cheapest plan gets the
  most questions per dollar.

Everything is a named, overridable input. Nothing here is a fact yet -- the
point is that when the first real invoice lands, `Ledger.reconcile()` corrects
the price book and this recomputes from it.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from packages.billing.plans import (
    CostModel,
    cogs_for_usage,
    get_plan,
)


@dataclass(frozen=True)
class Overheads:
    """Costs per month that a per-customer margin never sees."""

    # Baseline infrastructure, in USD/month, before any customer traffic.
    # Postgres with a replica, Redis, object storage baseline, metrics and log
    # retention, a small always-on control plane, error tracking.
    fixed_platform_usd: float = 900.0

    # Payment processing.
    payment_percent: float = 0.029
    payment_fixed_usd: float = 0.30

    # Support: minutes per customer per month, at a loaded hourly rate.
    support_minutes_per_customer: float = 12.0
    support_hourly_usd: float = 45.0

    # Trials. Full-featured for 14 days, no card, so the burn is real.
    trial_conversion_rate: float = 0.25
    trial_hours_consumed: float = 20.0
    trial_clips_published: float = 25.0

    # Monthly logo churn. Sets how long a customer pays before leaving.
    monthly_churn: float = 0.06

    # Blended cost to acquire one paying customer.
    cac_usd: float = 60.0


DEFAULT_OVERHEADS = Overheads()


# ---------------------------------------------------------------------------
# Per-customer
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class UnitResult:
    plan: str
    revenue_usd: float
    usage_cogs_usd: float
    payment_fee_usd: float
    support_usd: float
    trial_burn_usd: float
    contribution_usd: float
    contribution_margin: float
    lifetime_months: float
    ltv_usd: float
    cac_usd: float
    ltv_to_cac: float
    months_to_recover_cac: float | None

    @property
    def healthy(self) -> bool:
        """The two conditions that actually matter.

        A positive contribution margin means each customer stops digging. An
        LTV:CAC above 3 is the conventional floor for growth being worth
        funding; below it, every sale makes the hole deeper faster.
        """
        return self.contribution_usd > 0 and self.ltv_to_cac >= 3.0


def unit_economics(
    plan_code: str,
    *,
    utilisation: float = 1.0,
    overheads: Overheads = DEFAULT_OVERHEADS,
    costs: CostModel | None = None,
) -> UnitResult:
    """One customer, fully loaded.

    `utilisation` is the share of the allowance actually consumed. Full
    consumption is the worst realistic case and the only one worth designing
    against; most customers sit far below it, which is where the money is.
    """
    plan = get_plan(plan_code)
    model = costs or CostModel()
    revenue = plan.price_monthly_cents / 100

    hours = plan.monitored_hours * utilisation
    clips = plan.published_clips * utilisation
    usage = cogs_for_usage(hours, clips, plan.storage_gb * utilisation, model)

    fee = revenue * overheads.payment_percent + overheads.payment_fixed_usd
    support = overheads.support_minutes_per_customer / 60 * overheads.support_hourly_usd

    # Every converting customer carries the trials that did not convert.
    trials_per_paid = (1 / overheads.trial_conversion_rate) - 1
    one_trial = cogs_for_usage(
        overheads.trial_hours_consumed, overheads.trial_clips_published, 0, model
    )
    trial_burn = trials_per_paid * one_trial

    contribution = revenue - usage - fee - support - trial_burn
    lifetime = 1 / overheads.monthly_churn if overheads.monthly_churn else float("inf")
    ltv = contribution * lifetime

    return UnitResult(
        plan=plan.code,
        revenue_usd=round(revenue, 2),
        usage_cogs_usd=round(usage, 2),
        payment_fee_usd=round(fee, 2),
        support_usd=round(support, 2),
        # Amortised over the customer's life, not charged in month one: the
        # trial is a one-off, and expensing it monthly understates LTV.
        trial_burn_usd=round(trial_burn / lifetime, 2),
        contribution_usd=round(contribution + trial_burn - trial_burn / lifetime, 2),
        contribution_margin=round(
            (contribution + trial_burn - trial_burn / lifetime) / revenue, 4
        ) if revenue else 0.0,
        lifetime_months=round(lifetime, 1),
        ltv_usd=round(ltv, 2),
        cac_usd=overheads.cac_usd + round(trial_burn, 2),
        ltv_to_cac=round(ltv / (overheads.cac_usd + trial_burn), 2)
        if (overheads.cac_usd + trial_burn) else float("inf"),
        months_to_recover_cac=(
            round((overheads.cac_usd + trial_burn) / contribution, 1)
            if contribution > 0 else None
        ),
    )


# ---------------------------------------------------------------------------
# Worst case
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class StressResult:
    plan: str
    scenario: str
    revenue_usd: float
    cost_usd: float
    profit_usd: float

    @property
    def loses_money(self) -> bool:
        return self.profit_usd < 0


def stress(plan_code: str, overheads: Overheads = DEFAULT_OVERHEADS,
           costs: CostModel | None = None) -> list[StressResult]:
    """The customers who could sink a plan.

    Averages hide the shape that kills you. What matters is whether the single
    most expensive customer a plan *permits* is still profitable, because at
    small scale one of them is a meaningful fraction of the book.
    """
    plan = get_plan(plan_code)
    model = costs or CostModel()
    revenue = plan.price_monthly_cents / 100
    fee = revenue * overheads.payment_percent + overheads.payment_fixed_usd
    support = overheads.support_minutes_per_customer / 60 * overheads.support_hourly_usd

    def result(name: str, hours: float, clips: float, gb: float,
               extra_revenue: float = 0.0) -> StressResult:
        cost = cogs_for_usage(hours, clips, gb, model) + fee + support
        return StressResult(plan.code, name, round(revenue + extra_revenue, 2),
                            round(cost, 2), round(revenue + extra_revenue - cost, 2))

    return [
        result("Full allowance", plan.monitored_hours, plan.published_clips,
               plan.storage_gb),
        # Overage is capped, so past the cap the customer keeps consuming while
        # revenue stops. This is the shape of the worst legitimate customer.
        result("At the overage cap",
               plan.monitored_hours,
               plan.published_clips + plan.overage_cap_cents / plan.clip_overage_cents
               if plan.clip_overage_cents else plan.published_clips,
               plan.storage_gb,
               extra_revenue=plan.overage_cap_cents / 100),
        # Monitoring never hard-stops, so a source live around the clock is
        # permitted by design. 730 hours is the ceiling for one source.
        result("One source live 24/7", min(730, plan.monitored_hours * 3),
               plan.published_clips, plan.storage_gb),
        # Free rejections are capped at 3x, but that still means paying to
        # render three times the allowance and being paid for one.
        result("Rejects everything to the cap",
               plan.monitored_hours,
               plan.published_clips * plan.free_reject_multiplier,
               plan.storage_gb),
    ]


# ---------------------------------------------------------------------------
# Whole business
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BusinessResult:
    customers: int
    mix: dict[str, float]
    mrr_usd: float
    variable_cost_usd: float
    fixed_cost_usd: float
    profit_usd: float
    contribution_per_customer_usd: float
    breakeven_customers: int | None


def business(
    customers: int,
    mix: dict[str, float] | None = None,
    *,
    utilisation: float = 0.55,
    overheads: Overheads = DEFAULT_OVERHEADS,
    costs: CostModel | None = None,
) -> BusinessResult:
    """The whole thing at a given customer count.

    Default utilisation is 55%, not 100%: designing allowances against full
    consumption is correct, and modelling revenue against it is pessimistic to
    the point of being wrong. Both numbers are reported so neither hides.
    """
    mix = mix or {"rail": 0.70, "control_room": 0.25, "network": 0.05}
    if abs(sum(mix.values()) - 1.0) > 1e-6:
        raise ValueError(f"mix must sum to 1.0, got {sum(mix.values())}")

    mrr = variable = 0.0
    for code, share in mix.items():
        n = customers * share
        unit = unit_economics(code, utilisation=utilisation,
                              overheads=overheads, costs=costs)
        mrr += n * unit.revenue_usd
        variable += n * (unit.revenue_usd - unit.contribution_usd)

    contribution = mrr - variable
    per_customer = contribution / customers if customers else 0.0
    breakeven = (
        int(-(-overheads.fixed_platform_usd // per_customer))
        if per_customer > 0 else None
    )

    return BusinessResult(
        customers=customers,
        mix=mix,
        mrr_usd=round(mrr, 2),
        variable_cost_usd=round(variable, 2),
        fixed_cost_usd=overheads.fixed_platform_usd,
        profit_usd=round(contribution - overheads.fixed_platform_usd, 2),
        contribution_per_customer_usd=round(per_customer, 2),
        breakeven_customers=breakeven,
    )


def sensitivity(
    customers: int = 300, *, overheads: Overheads = DEFAULT_OVERHEADS
) -> dict[str, dict]:
    """Which assumption, if wrong, hurts most.

    The answer decides what to measure first once there is production traffic,
    which is more useful than any single point estimate.
    """
    base = business(customers, overheads=overheads).profit_usd
    out = {}
    for label, changed in {
        "ASR is a hosted API, not self-hosted":
            (overheads, CostModel(asr_per_candidate_hour=0.36)),
        "Trials convert at 10%, not 25%":
            (replace(overheads, trial_conversion_rate=0.10), None),
        "Churn is 10%/mo, not 6%":
            (replace(overheads, monthly_churn=0.10), None),
        "Fixed platform is $2,500, not $900":
            (replace(overheads, fixed_platform_usd=2500.0), None),
        "Support is 40 min/customer, not 12":
            (replace(overheads, support_minutes_per_customer=40.0), None),
        "Customers use 100% of allowance, not 55%":
            (overheads, None),
    }.items():
        oh, cm = changed
        util = 1.0 if "100%" in label else 0.55
        profit = business(customers, utilisation=util, overheads=oh, costs=cm).profit_usd
        out[label] = {
            "profit_usd": profit,
            "delta_usd": round(profit - base, 2),
            "still_profitable": profit > 0,
        }
    return dict(sorted(out.items(), key=lambda kv: kv[1]["delta_usd"]))
