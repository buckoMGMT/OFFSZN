"""Trial economics, and the cash-flow trap inside them.

Fourteen days, full-featured, no card. The question that matters is not the
average trial cost — it is whether a *successful* growth month can create a cash
problem, because trial spend lands immediately and the revenue it buys arrives
over the following year.

Three user shapes, because the average hides the one that hurts:

    TYPICAL     tries it on a couple of streams, decides
    HEAVY       genuinely evaluating it, streams most of the fortnight
    EXTRACTIVE  arrives with a backlog, processes everything, exports, leaves

The extractive one is not hypothetical. A no-card trial on a product that turns
video into finished vertical clips is a free rendering service to anyone who
wants one, and the only thing between us and that is how much they can consume
in fourteen days.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from packages.billing.plans import CostModel, cogs_for_usage


@dataclass(frozen=True)
class TrialShape:
    name: str
    share: float                # fraction of trials that look like this
    monitored_hours: float
    clips_published: float
    storage_gb: float
    support_minutes: float
    converts_at: float          # conversion rate for this shape


# Shares sum to 1. The extractive slice is deliberately small and deliberately
# expensive -- that is the shape of the risk.
SHAPES: tuple[TrialShape, ...] = (
    TrialShape("typical", 0.70, monitored_hours=8, clips_published=10,
               storage_gb=3, support_minutes=6, converts_at=0.28),
    TrialShape("heavy evaluator", 0.25, monitored_hours=45, clips_published=60,
               storage_gb=18, support_minutes=20, converts_at=0.35),
    TrialShape("extractive", 0.05, monitored_hours=120, clips_published=300,
               storage_gb=90, support_minutes=2, converts_at=0.00),
)


@dataclass(frozen=True)
class TrialCost:
    shape: str
    compute_usd: float
    support_usd: float
    payment_usd: float
    total_usd: float


def cost_of(shape: TrialShape, *, support_hourly_usd: float = 45.0,
            costs: CostModel | None = None) -> TrialCost:
    model = costs or CostModel()
    compute = cogs_for_usage(shape.monitored_hours, shape.clips_published,
                             shape.storage_gb, model)
    support = shape.support_minutes / 60 * support_hourly_usd
    return TrialCost(shape.name, round(compute, 2), round(support, 2), 0.0,
                     round(compute + support, 2))


@dataclass(frozen=True)
class CohortResult:
    trials: int
    converted: int
    blended_conversion: float
    trial_spend_usd: float
    cac_spend_usd: float
    total_acquisition_usd: float
    mrr_added_usd: float
    months_to_repay: float | None
    worst_case_spend_usd: float
    by_shape: dict[str, dict]

    @property
    def cash_negative_months(self) -> float | None:
        return self.months_to_repay


def cohort(
    trials: int,
    *,
    contribution_per_customer_usd: float = 35.24,
    revenue_per_customer_usd: float = 46.5,
    cac_usd: float = 60.0,
    shapes: tuple[TrialShape, ...] = SHAPES,
    costs: CostModel | None = None,
) -> CohortResult:
    """Run a cohort of trials and report the cash hole it digs.

    `months_to_repay` is the number that matters: how long the cohort's own
    contribution takes to pay back what acquiring it cost. Anything beyond a
    few months means growth consumes cash faster than it produces it, which is
    survivable with funding and fatal without.
    """
    spend = converted = 0.0
    by_shape: dict[str, dict] = {}

    for shape in shapes:
        n = trials * shape.share
        cost = cost_of(shape, costs=costs)
        shape_spend = n * cost.total_usd
        shape_converted = n * shape.converts_at
        spend += shape_spend
        converted += shape_converted
        by_shape[shape.name] = {
            "trials": round(n),
            "cost_each_usd": cost.total_usd,
            "cost_total_usd": round(shape_spend, 2),
            "converted": round(shape_converted, 1),
            "share_of_spend": 0.0,   # filled below
        }

    for entry in by_shape.values():
        entry["share_of_spend"] = round(entry["cost_total_usd"] / spend, 4) if spend else 0.0

    cac_spend = converted * cac_usd
    total = spend + cac_spend
    mrr = converted * revenue_per_customer_usd
    monthly_contribution = converted * contribution_per_customer_usd

    # The worst case is not the average: it is every trial behaving like the
    # expensive shape. Not a forecast — a bound on how bad a launch can get.
    worst_each = max(cost_of(s, costs=costs).total_usd for s in shapes)

    return CohortResult(
        trials=trials,
        converted=round(converted),
        blended_conversion=round(converted / trials, 4) if trials else 0.0,
        trial_spend_usd=round(spend, 2),
        cac_spend_usd=round(cac_spend, 2),
        total_acquisition_usd=round(total, 2),
        mrr_added_usd=round(mrr, 2),
        months_to_repay=(round(total / monthly_contribution, 1)
                         if monthly_contribution > 0 else None),
        worst_case_spend_usd=round(trials * worst_each, 2),
        by_shape=by_shape,
    )


def non_converting_burn(trials: int, costs: CostModel | None = None) -> dict:
    """What the trials that never convert cost on their own.

    The question in plain terms: a thousand people try it, none of them pay —
    what did that cost? If the answer is survivable, a no-card trial is a
    marketing expense. If it is not, the trial needs a card or a cap.
    """
    burn = 0.0
    for shape in SHAPES:
        n = trials * shape.share * (1 - shape.converts_at)
        burn += n * cost_of(shape, costs=costs).total_usd
    return {
        "trials": trials,
        "never_converted": round(sum(trials * s.share * (1 - s.converts_at)
                                     for s in SHAPES)),
        "burn_usd": round(burn, 2),
        "burn_per_trial_usd": round(burn / trials, 2) if trials else 0.0,
    }


def with_card_required(shapes: tuple[TrialShape, ...] = SHAPES) -> tuple[TrialShape, ...]:
    """Trial shapes if a card is required up front.

    Requiring a card does not stop trials converting — it stops the trials that
    were never going to. Modelled as: the extractive shape mostly disappears,
    volume drops, and the people who remain convert far better.
    """
    return (
        replace(shapes[0], share=0.66, converts_at=0.45),
        replace(shapes[1], share=0.32, converts_at=0.55),
        replace(shapes[2], share=0.02, converts_at=0.05),
    )


def capped(hours: float = 10.0, clips: float = 25.0,
           shapes: tuple[TrialShape, ...] = SHAPES) -> tuple[TrialShape, ...]:
    """Trial shapes with a hard allowance cap instead of a card.

    Keeps the no-card funnel and bounds the damage. The heavy evaluator is the
    one who notices, which is the cost of this option: the person most likely
    to buy is the one you interrupted.
    """
    return tuple(
        replace(s,
                monitored_hours=min(s.monitored_hours, hours),
                clips_published=min(s.clips_published, clips),
                storage_gb=min(s.storage_gb, 12),
                # The heavy evaluator hits the wall mid-evaluation and some of
                # them leave rather than upgrade blind.
                converts_at=s.converts_at * (0.8 if s.monitored_hours > hours else 1.0))
        for s in shapes
    )
