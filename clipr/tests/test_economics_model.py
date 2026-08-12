"""Whole-business economics.

The question these lock is not "what is the margin" but "can this lose money".
Gross margin always looks good; a business dies on fixed cost, support load and
CAC payback, none of which a per-customer margin can see.
"""

from dataclasses import replace

import pytest

from packages.billing.economics import (
    DEFAULT_OVERHEADS,
    business,
    sensitivity,
    stress,
    unit_economics,
)
from packages.billing.plans import PLANS, REFERENCE_CLIPS_PER_HOUR, UNLIMITED, get_plan

PAID = ["rail", "control_room", "network"]


# --- the meters agree with each other --------------------------------------

@pytest.mark.parametrize("code", PAID)
def test_the_advertised_hours_are_the_binding_limit(code):
    """Rail once said 60 monitored hours while an 80-clip cap stopped you at 32.
    Publishing a headline number that a second meter silently overrides is the
    exact trick this product exists to stop other people playing."""
    plan = get_plan(code)
    implied = plan.monitored_hours * REFERENCE_CLIPS_PER_HOUR
    assert plan.published_clips >= implied, (
        f"{code}: {plan.published_clips} clips runs out at "
        f"{plan.published_clips / REFERENCE_CLIPS_PER_HOUR:.0f}h, "
        f"before the advertised {plan.monitored_hours}h"
    )


@pytest.mark.parametrize("code", PAID)
def test_the_clip_allowance_is_not_absurdly_generous_either(code):
    """The other failure: a clip cap so high it is decorative, which turns the
    plan into unmetered rendering."""
    plan = get_plan(code)
    implied = plan.monitored_hours * REFERENCE_CLIPS_PER_HOUR
    assert plan.published_clips <= implied * 1.5


# --- no permitted customer loses money -------------------------------------

@pytest.mark.parametrize("code", PAID)
def test_no_customer_a_plan_permits_can_lose_money(code):
    """Averages hide the shape that kills you. What matters is the single most
    expensive customer each plan *allows* — at small scale, one of them is a
    meaningful fraction of the book."""
    for scenario in stress(code):
        assert not scenario.loses_money, (
            f"{code}/{scenario.scenario}: revenue ${scenario.revenue_usd} "
            f"against ${scenario.cost_usd} cost"
        )


def test_a_source_live_around_the_clock_is_still_profitable():
    """Monitoring never hard-stops, so this is permitted by design rather than
    by accident. It has to be survivable."""
    worst = next(s for s in stress("rail") if "24/7" in s.scenario)
    assert worst.profit_usd > 0


def test_rejecting_everything_to_the_cap_is_still_profitable():
    """'Rejected clips are free' is the best line in the pricing and the most
    obvious way to abuse it."""
    worst = next(s for s in stress("rail") if "Rejects" in s.scenario)
    assert worst.profit_usd > 0


def test_the_overage_cap_never_inverts_the_economics():
    """Past the cap the customer keeps consuming while revenue stops. That is
    deliberate, and it must still be profitable."""
    for code in PAID:
        capped = next(s for s in stress(code) if "overage cap" in s.scenario)
        assert capped.profit_usd > 0


# --- per-customer health ---------------------------------------------------

@pytest.mark.parametrize("code", PAID)
def test_every_plan_has_a_positive_contribution_margin(code):
    assert unit_economics(code, utilisation=1.0).contribution_usd > 0


@pytest.mark.parametrize("code", PAID)
def test_cac_pays_back_within_a_year(code):
    payback = unit_economics(code, utilisation=1.0).months_to_recover_cac
    assert payback is not None and payback <= 12


def test_support_costs_more_than_infrastructure_on_the_entry_plan():
    """The finding that should change where effort goes. Everyone worries about
    the GPU bill; on Rail, human minutes cost more than every machine combined,
    and support load is the largest sensitivity in the whole model."""
    u = unit_economics("rail", utilisation=1.0)
    assert u.support_usd > u.usage_cogs_usd


# --- whole business --------------------------------------------------------

def test_breakeven_is_a_reachable_number_of_customers():
    """If breakeven needed thousands, the fixed-cost base would be wrong for
    the stage and this should not be started as designed."""
    b = business(300)
    assert b.breakeven_customers is not None
    assert b.breakeven_customers <= 60


def test_the_business_loses_money_below_breakeven_and_makes_it_above():
    b = business(300)
    assert business(b.breakeven_customers - 10).profit_usd < 0
    assert business(b.breakeven_customers + 10).profit_usd > 0


def test_an_unbalanced_mix_is_rejected_rather_than_silently_normalised():
    with pytest.raises(ValueError, match="sum to 1.0"):
        business(100, {"rail": 0.9, "network": 0.4})


def test_a_rail_only_book_still_works():
    """The pessimistic mix: nobody upgrades. If this were loss-making the entry
    plan would be a trap rather than a funnel."""
    assert business(300, {"rail": 1.0}).profit_usd > 0


# --- what to measure first -------------------------------------------------

def test_support_load_is_the_largest_single_risk():
    """Sensitivity ranking decides what to instrument first once there is
    traffic, which is worth more than any point estimate."""
    ranked = list(sensitivity(300).items())
    assert "Support" in ranked[0][0]


def test_the_business_survives_every_single_assumption_being_wrong():
    """Individually, at least. All of them at once is a different question, and
    the answer to that one is the runway."""
    for label, result in sensitivity(300).items():
        assert result["still_profitable"], f"{label} alone makes it loss-making"


def test_hosted_asr_is_survivable_at_scale_even_though_it_halves_margin():
    """The margin model says self-hosted ASR is the business. At 300 customers
    the fixed base is spread far enough that hosted ASR is merely expensive."""
    assert sensitivity(300)["ASR is a hosted API, not self-hosted"]["still_profitable"]


# --- guards ----------------------------------------------------------------

def test_utilisation_of_zero_is_pure_profit_not_a_crash():
    u = unit_economics("rail", utilisation=0.0)
    assert u.contribution_usd > 0


def test_no_paid_plan_is_unlimited_on_a_metered_resource():
    for code in PAID:
        plan = get_plan(code)
        assert plan.monitored_hours != UNLIMITED
        assert plan.published_clips != UNLIMITED


def test_trial_burn_is_carried_by_the_customers_who_convert():
    """A 25% conversion rate means every paying customer funds three who left.
    Ignoring that is how a free trial quietly becomes the largest line item."""
    generous = replace(DEFAULT_OVERHEADS, trial_conversion_rate=0.05)
    assert (unit_economics("rail", overheads=generous).cac_usd
            > unit_economics("rail").cac_usd)


def test_the_plan_table_and_the_economics_model_read_the_same_prices():
    for code in PAID:
        assert (unit_economics(code).revenue_usd
                == PLANS[code].price_monthly_cents / 100)
