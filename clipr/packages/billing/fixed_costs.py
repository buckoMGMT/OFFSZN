"""The $900 fixed base, line by line — and three breakevens, not one.

The single `fixed_platform_usd = 900` figure was doing far too much work. It is
now an itemised bill, because a number nobody can attack is a number nobody has
checked.

More importantly, "breakeven" was ambiguous in a way that flattered the answer.
A company can report a $1,000 monthly profit while a founder works 200 unpaid
hours to produce it. That is not a business, it is a job that pays $5/hour, and
the model should not be able to hide it.

So there are three, and they are very different numbers:

    INFRASTRUCTURE  the product pays its own technical bills
    OPERATING       the company pays its normal expenses too
    FOUNDER-REPLACEMENT   the company could pay someone else to run it

The first is the one worth celebrating early. The third is the one that means
the business exists independently of you.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Tier(StrEnum):
    INFRASTRUCTURE = "infrastructure"
    OPERATING = "operating"
    FOUNDER_REPLACEMENT = "founder_replacement"


@dataclass(frozen=True)
class LineItem:
    name: str
    monthly_usd: float
    tier: Tier
    note: str = ""
    # False when the figure is a real quoted price rather than an estimate.
    estimated: bool = True


# Every line is an estimate at a small-but-real scale: a managed Postgres with a
# replica, object storage in the low terabytes, a modest always-on fleet. Replace
# each with an invoice as it arrives -- `verify()` reports what is still guessed.
LINE_ITEMS: list[LineItem] = [
    # --- infrastructure: the product's own technical bills ------------------
    LineItem("Managed Postgres (primary + replica)", 190, Tier.INFRASTRUCTURE,
             "Small instance with PITR. The replica is not optional once "
             "anyone's clips live here."),
    LineItem("Redis / queue", 35, Tier.INFRASTRUCTURE),
    LineItem("Object storage baseline", 60, Tier.INFRASTRUCTURE,
             "Excludes per-customer storage, which is in the per-clip COGS."),
    LineItem("Always-on control plane + API", 120, Tier.INFRASTRUCTURE,
             "Two small instances. The watcher fleet scales with customers and "
             "is charged per monitored hour, not here."),
    LineItem("Idle GPU floor", 90, Tier.INFRASTRUCTURE,
             "One warm render node. Cold-starting a GPU per clip costs more in "
             "latency than the idle node costs in dollars."),
    LineItem("Metrics, logs, traces", 85, Tier.INFRASTRUCTURE,
             "Retention is the cost driver here, not ingest."),
    LineItem("Error tracking", 26, Tier.INFRASTRUCTURE),
    LineItem("CI minutes", 40, Tier.INFRASTRUCTURE),
    LineItem("Staging environment", 70, Tier.INFRASTRUCTURE,
             "A shrunk copy. Testing migrations in production is how you lose "
             "a customer's clips."),
    LineItem("Backups + restore testing", 45, Tier.INFRASTRUCTURE,
             "Storage plus the scratch database each restore test spins up."),
    LineItem("Domain, DNS, TLS, CDN", 35, Tier.INFRASTRUCTURE),
    LineItem("Transactional email", 30, Tier.INFRASTRUCTURE),
    LineItem("Push notifications", 15, Tier.INFRASTRUCTURE),
    LineItem("Secrets management", 20, Tier.INFRASTRUCTURE),

    # --- operating: what a company costs even with no servers ---------------
    LineItem("Accounting + bookkeeping", 180, Tier.OPERATING),
    LineItem("Sales tax / VAT compliance", 95, Tier.OPERATING,
             "Digital goods across jurisdictions. Ignored until it is a "
             "penalty."),
    LineItem("Business insurance (E&O, cyber)", 140, Tier.OPERATING,
             "A product that auto-publishes on someone's behalf wants this."),
    LineItem("Legal retainer, amortised", 250, Tier.OPERATING,
             "The five reviews the audit wants, spread over a year."),
    LineItem("Support desk + status page", 55, Tier.OPERATING),
    LineItem("Analytics + BI", 60, Tier.OPERATING),
    LineItem("Design / productivity SaaS", 70, Tier.OPERATING),
    LineItem("Corporate filings, registered agent", 25, Tier.OPERATING),
    LineItem("Music fingerprinting API minimum", 120, Tier.OPERATING,
             "Rights screening runs on every plan, so this is a floor, not a "
             "usage cost."),

    # --- founder replacement: what hiring out the work costs -----------------
    LineItem("Ops / support person (0.5 FTE loaded)", 3800, Tier.FOUNDER_REPLACEMENT,
             "The role that answers tickets, watches the queue and runs the "
             "publish handoffs."),
    LineItem("Engineering cover (0.5 FTE loaded)", 6200, Tier.FOUNDER_REPLACEMENT,
             "Someone who can fix the pipeline at 2am without you."),
]


@dataclass(frozen=True)
class Breakevens:
    infrastructure_usd: float
    operating_usd: float
    founder_replacement_usd: float
    customers_infrastructure: int
    customers_operating: int
    customers_founder_replacement: int
    contribution_per_customer_usd: float

    def as_rows(self) -> list[dict]:
        return [
            {"tier": "Infrastructure", "monthly_usd": self.infrastructure_usd,
             "customers": self.customers_infrastructure,
             "meaning": "The product pays its own technical bills."},
            {"tier": "Operating", "monthly_usd": self.operating_usd,
             "customers": self.customers_operating,
             "meaning": "The company pays its normal expenses too."},
            {"tier": "Founder replacement", "monthly_usd": self.founder_replacement_usd,
             "customers": self.customers_founder_replacement,
             "meaning": "Someone else could be paid to run it."},
        ]


def cost_for(tier: Tier) -> float:
    return sum(i.monthly_usd for i in LINE_ITEMS if i.tier is tier)


def cumulative(tier: Tier) -> float:
    """Each tier includes the ones beneath it."""
    order = [Tier.INFRASTRUCTURE, Tier.OPERATING, Tier.FOUNDER_REPLACEMENT]
    return sum(cost_for(t) for t in order[: order.index(tier) + 1])


def breakevens(contribution_per_customer_usd: float) -> Breakevens:
    if contribution_per_customer_usd <= 0:
        raise ValueError("contribution per customer must be positive to break even")

    def customers(total: float) -> int:
        return int(-(-total // contribution_per_customer_usd))

    infra = cumulative(Tier.INFRASTRUCTURE)
    operating = cumulative(Tier.OPERATING)
    founder = cumulative(Tier.FOUNDER_REPLACEMENT)
    return Breakevens(
        infrastructure_usd=round(infra, 2),
        operating_usd=round(operating, 2),
        founder_replacement_usd=round(founder, 2),
        customers_infrastructure=customers(infra),
        customers_operating=customers(operating),
        customers_founder_replacement=customers(founder),
        contribution_per_customer_usd=round(contribution_per_customer_usd, 2),
    )


def verify() -> dict:
    """How much of the bill is still guessed.

    Every line starts estimated. Flipping one to `estimated=False` should mean
    an invoice exists, and this reports how far from that the model is.
    """
    total = sum(i.monthly_usd for i in LINE_ITEMS)
    guessed = sum(i.monthly_usd for i in LINE_ITEMS if i.estimated)
    return {
        "total_monthly_usd": round(total, 2),
        "estimated_usd": round(guessed, 2),
        "estimated_share": round(guessed / total, 4) if total else 0.0,
        "lines_total": len(LINE_ITEMS),
        "lines_estimated": sum(1 for i in LINE_ITEMS if i.estimated),
        "status": (
            "Every line is an estimate. No figure here has been checked against "
            "an invoice, so treat the breakevens as modeled, not observed."
            if guessed == total else
            f"{guessed / total:.0%} of the bill is still estimated."
        ),
    }
