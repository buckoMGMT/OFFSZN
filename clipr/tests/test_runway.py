"""Runway arithmetic.

These numbers get quoted in sales conversations, so they are locked the same way
the plan table is. The competitor half rests on one unverified assumption, and
there is a test whose only job is to keep that visible.
"""

import pytest

from packages.billing.runway import (
    CREDIT_PLANS,
    MINUTES_PER_CREDIT,
    breakeven_hours,
    clipr_runway,
    credit_runway,
    month_cost_clipr,
    month_cost_credits,
)

# --- the assumption everything rests on ------------------------------------

def test_the_credit_definition_is_a_named_unverified_constant():
    """If a credit is not one source minute, every competitor number here is
    wrong. It is a constant with a warning rather than a figure baked into a
    table, so the day someone confirms it there is one place to change."""
    assert MINUTES_PER_CREDIT == 1.0
    # The warning lives beside the constant, where someone changing it will
    # read it -- not only in the module docstring, which they will not.
    import inspect

    import packages.billing.runway as runway
    source = inspect.getsource(runway)
    marker = source.index("MINUTES_PER_CREDIT = 1.0")
    assert "UNVERIFIED" in source[max(0, marker - 400):marker]


def test_overage_estimates_carry_their_own_warning():
    """The exhaustion point is solid arithmetic. The dollar figure is not, and
    must never travel without saying so."""
    assert "estimate" in month_cost_credits("opus_starter", 100)["estimate_warning"].lower()


# --- runway ----------------------------------------------------------------

def test_a_150_credit_plan_covers_two_and_a_half_stream_hours():
    r = credit_runway("opus_starter")
    assert r.limit_hours == pytest.approx(2.5)
    assert "Hard stop" in r.what_happens


def test_credit_exhaustion_is_a_hard_stop_and_ours_is_not():
    """The difference that matters is not when you hit the wall, it is what the
    wall does. An always-on product whose failure mode is silence has no
    product."""
    assert "Hard stop" in credit_runway("opus_starter").what_happens
    assert "Keeps running" in clipr_runway("rail", 2.5).what_happens


def test_clips_bind_before_hours_on_rail_for_a_typical_stream():
    """Rail advertises 60 monitored hours, but at 2.5 clips an hour the 80-clip
    allowance runs out at 32. The headline number is not the binding one, which
    is a real pricing problem and not a rounding detail."""
    r = clipr_runway("rail", 2.5)
    assert r.limit_hours == pytest.approx(32.0)
    assert "clips" in r.binding_limit


def test_a_quiet_stream_is_bound_by_hours_instead():
    r = clipr_runway("rail", 1.0)
    assert r.limit_hours == pytest.approx(60.0)
    assert "monitored hours" in r.binding_limit


def test_the_more_clippable_the_stream_the_shorter_the_runway():
    runways = [clipr_runway("rail", cph).hours for cph in (1, 2, 3, 4)]
    assert runways == sorted(runways, reverse=True)


def test_rail_outlasts_starter_by_more_than_ten_times():
    theirs = credit_runway("opus_starter").hours
    ours = clipr_runway("rail", 2.5).hours
    assert ours / theirs > 10


# --- cost ------------------------------------------------------------------

def test_overage_on_rail_is_capped_at_the_next_plan():
    heavy = month_cost_clipr("rail", 200, 2.5)
    assert heavy["capped"]
    assert heavy["total_usd"] == pytest.approx(29 + 79)


def test_a_light_month_costs_the_sticker_price():
    assert month_cost_clipr("rail", 20, 2.5)["total_usd"] == pytest.approx(29.0)


def test_breakeven_is_low_because_150_credits_is_two_and_a_half_hours():
    """Corrects an earlier claim of ~15 hours. Starter's allowance is so small
    that a credit plan is behind almost immediately."""
    assert 3 <= breakeven_hours(2.5, 0.10) <= 8


@pytest.mark.parametrize("credit_price", [0.05, 0.08, 0.10, 0.15, 0.20])
def test_breakeven_stays_low_across_every_plausible_credit_price(credit_price):
    """The conclusion should not depend on the number we are least sure of."""
    assert breakeven_hours(2.5, credit_price) < 10


def test_known_plans_are_the_ones_we_actually_read_off_the_page():
    assert set(CREDIT_PLANS) == {"opus_starter", "opus_pro_annual"}
    assert CREDIT_PLANS["opus_starter"]["usd"] == 15.0
    assert CREDIT_PLANS["opus_pro_annual"]["credits"] == 3600
