"""Fixed costs, trials, and the Publishable Rate.

Three things a per-customer margin cannot see, and the metric that decides
whether any of the rest matters.
"""

import pytest

from packages.ai.evaluation import PUBLISHABLE_BANDS, publishable_band, review_efficiency
from packages.billing.fixed_costs import (
    LINE_ITEMS,
    Tier,
    breakevens,
    cost_for,
    cumulative,
    verify,
)
from packages.billing.trials import (
    SHAPES,
    capped,
    cohort,
    cost_of,
    non_converting_burn,
    with_card_required,
)

CONTRIBUTION = 35.24


# --- three breakevens, not one ---------------------------------------------

def test_the_three_breakevens_are_ordered_and_distinct():
    """A company can report a profit while a founder works 200 unpaid hours to
    produce it. Reporting one breakeven lets that hide."""
    b = breakevens(CONTRIBUTION)
    assert (b.customers_infrastructure
            < b.customers_operating
            < b.customers_founder_replacement)


def test_founder_replacement_is_an_order_of_magnitude_harder():
    """The number that means the business exists without you. It should not be
    within touching distance of the infrastructure one, and if it looks like it
    is, the salary assumptions are wrong."""
    b = breakevens(CONTRIBUTION)
    assert b.customers_founder_replacement >= b.customers_infrastructure * 8


def test_the_old_flat_estimate_only_covered_infrastructure():
    """$900 was roughly right for servers and completely omitted the cost of
    being a company."""
    assert 700 <= cost_for(Tier.INFRASTRUCTURE) <= 1000
    assert cost_for(Tier.OPERATING) > 500


def test_tiers_are_cumulative_not_alternatives():
    assert cumulative(Tier.OPERATING) == cost_for(Tier.INFRASTRUCTURE) + cost_for(Tier.OPERATING)


def test_every_line_item_is_attributed_to_a_tier():
    assert all(isinstance(i.tier, Tier) for i in LINE_ITEMS)
    assert len(LINE_ITEMS) >= 20, "a fixed-cost base this thin has not been thought about"


def test_the_model_admits_the_whole_bill_is_still_estimated():
    """Nothing here has been checked against an invoice. The model has to say
    so rather than presenting estimates as findings."""
    v = verify()
    assert v["estimated_share"] == 1.0
    assert "modeled, not observed" in v["status"]


def test_breakeven_is_undefined_when_customers_lose_money():
    with pytest.raises(ValueError, match="positive"):
        breakevens(-1.0)


# --- trials ----------------------------------------------------------------

def test_trial_shapes_cover_the_whole_cohort():
    assert sum(s.share for s in SHAPES) == pytest.approx(1.0)


def test_the_extractive_shape_never_converts():
    """It is the shape that arrives with a backlog, processes everything,
    exports, and leaves. Modelling it as converting at all would hide it."""
    extractive = next(s for s in SHAPES if s.name == "extractive")
    assert extractive.converts_at == 0.0
    assert extractive.clips_published > 200


def test_a_thousand_non_converting_trials_is_survivable():
    """The cash question in plain terms: a thousand people try it, nobody pays.
    If that number were frightening, the no-card trial would have to go."""
    burn = non_converting_burn(1000)
    assert burn["burn_usd"] < 15_000
    assert burn["burn_per_trial_usd"] < 15


def test_the_honest_heavy_evaluator_costs_more_than_the_abuser():
    """The finding that changes the response. The extractive user is cheap in
    compute; the genuine evaluator costs more because they ask questions. Once
    again the expensive resource is human minutes, not GPUs -- so the fix is
    better onboarding, not a tighter trial."""
    heavy = cost_of(next(s for s in SHAPES if s.name == "heavy evaluator"))
    extractive = cost_of(next(s for s in SHAPES if s.name == "extractive"))
    assert heavy.total_usd > extractive.total_usd
    assert heavy.support_usd > extractive.support_usd


def test_payback_does_not_get_worse_as_the_cohort_grows():
    """Growth must not create a cash trap: if repayment stretched with volume,
    a successful launch would be the thing that killed us."""
    small = cohort(100, contribution_per_customer_usd=CONTRIBUTION).months_to_repay
    large = cohort(10_000, contribution_per_customer_usd=CONTRIBUTION).months_to_repay
    assert large == pytest.approx(small, abs=0.2)


def test_acquisition_spend_scales_linearly_and_is_a_real_working_capital_need():
    """2.6 months to repay is fine. Ten thousand trials still means a quarter
    of a million dollars leaves before it comes back."""
    big = cohort(10_000, contribution_per_customer_usd=CONTRIBUTION)
    assert big.total_acquisition_usd > 200_000
    assert big.mrr_added_usd > 100_000


def test_requiring_a_card_removes_the_extractive_slice():
    """A card does not stop trials converting. It stops trials that were never
    going to."""
    carded = with_card_required()
    extractive = next(s for s in carded if s.name == "extractive")
    assert extractive.share < 0.03
    assert cohort(1000, shapes=carded).blended_conversion > cohort(1000).blended_conversion


def test_capping_the_trial_bounds_the_damage_but_costs_conversions():
    """The trade this option makes: the heavy evaluator is the one who hits the
    wall, and they are the one most likely to buy."""
    limited = capped(hours=10, clips=25)
    heavy = next(s for s in limited if s.name == "heavy evaluator")
    assert heavy.monitored_hours == 10
    assert heavy.converts_at < next(s for s in SHAPES if s.name == "heavy evaluator").converts_at


# --- publishable rate ------------------------------------------------------

@pytest.mark.parametrize("rate,expected", [
    (0.05, "bad"), (0.35, "promising"), (0.55, "good"),
    (0.75, "excellent"), (0.92, "killer"),
])
def test_publishable_rate_bands(rate, expected):
    assert publishable_band(rate)[0] == expected


def test_the_bands_are_ordered_from_best_to_worst():
    floors = [b[0] for b in PUBLISHABLE_BANDS]
    assert floors == sorted(floors, reverse=True)


def test_a_high_rate_on_too_few_clips_is_not_a_good_product():
    """Publishable rate alone is gameable by generating fewer, safer clips.
    Two keepers an hour is not worth opening the app for."""
    assert review_efficiency(0.75, clips_per_hour=1, seconds_per_review=7)["verdict"] != "worth it"


def test_a_low_rate_means_the_creator_is_doing_the_sorting():
    """At 30% publishable they are still doing the job themselves, however few
    seconds each decision takes."""
    verdict = review_efficiency(0.30, clips_per_hour=8, seconds_per_review=7)["verdict"]
    assert "sorting" in verdict


def test_slow_review_ruins_an_excellent_rate():
    assert review_efficiency(0.90, clips_per_hour=8, seconds_per_review=20)["verdict"] != "worth it"


def test_the_target_experience_reads_as_worth_it():
    """Eight clips, six keepers, under a minute of reviewing after a stream.
    That is the product."""
    result = review_efficiency(0.75, clips_per_hour=8, seconds_per_review=7)
    assert result["verdict"] == "worth it"
    assert result["keepers_per_stream_hour"] >= 5
    assert result["review_seconds_per_stream_hour"] <= 60
