"""Billing rules: the ones that decide whether we get paid, and whether a
customer can get the product for free."""

import pytest

from packages.billing.plans import (
    PLANS, UNLIMITED, Decision, Meter, Usage, check, cogs_for_usage, get_plan,
    margin_for_plan, next_plan_up, quote_overage, rule_on_rejection,
)


# --- plan table ------------------------------------------------------------

def test_plan_codes_match_the_pricing_page():
    assert set(PLANS) == {"trial", "rail", "control_room", "network"}


@pytest.mark.parametrize("code", ["rail", "control_room", "network"])
def test_annual_is_ten_months(code):
    plan = get_plan(code)
    assert plan.price_annual_cents == plan.price_monthly_cents * 10


def test_unknown_plan_names_the_valid_ones():
    with pytest.raises(ValueError, match="rail"):
        get_plan("starter")


def test_next_plan_up_terminates():
    assert next_plan_up("rail").code == "control_room"
    assert next_plan_up("network") is None


# --- overage ---------------------------------------------------------------

def test_no_overage_inside_allowance():
    assert quote_overage("rail", 80).charged_cents == 0


def test_overage_is_priced_per_clip():
    q = quote_overage("rail", 90)
    assert q.billable_clips == 10
    assert q.charged_cents == 350


def test_overage_never_exceeds_the_next_plan():
    # 1,000 clips over on Rail would be $350 uncapped.
    q = quote_overage("rail", 1080)
    assert q.raw_cents == 35_000
    assert q.charged_cents == get_plan("rail").overage_cap_cents
    assert q.capped
    assert q.savings_from_upgrade_cents > 0


def test_overage_suggests_the_upgrade_once_it_is_cheaper():
    assert quote_overage("rail", 1080).upgrade_hint == "control_room"


def test_every_plan_is_metered_on_clips():
    """No tier gets UNLIMITED clips.

    Clips carry a real marginal cost (render plus egress to each destination),
    so an unlimited clip tier is an unbounded liability. Accounts and seats are
    unlimited because they cost nothing to add; that asymmetry is deliberate.
    """
    for plan in PLANS.values():
        assert plan.published_clips != UNLIMITED
        assert plan.connected_accounts == UNLIMITED


def test_no_overage_at_exactly_the_allowance():
    for code, plan in PLANS.items():
        if plan.published_clips:
            assert quote_overage(code, plan.published_clips).charged_cents == 0, code


# --- the free-rejection hole ----------------------------------------------

def test_rejection_before_egress_is_free():
    assert rule_on_rejection("rail", had_egress=False, free_rejections_used=0).refunded


def test_rejection_after_download_is_not_free():
    """The abuse path: pull the render over the API, then reject to avoid the
    charge. Without this the clip allowance is decorative."""
    ruling = rule_on_rejection("rail", had_egress=True, free_rejections_used=0)
    assert not ruling.refunded
    assert "downloaded" in ruling.reason


def test_free_rejections_are_capped_even_without_egress():
    cap = int(get_plan("rail").published_clips * 3.0)
    assert rule_on_rejection("rail", had_egress=False, free_rejections_used=cap - 1).refunded
    assert not rule_on_rejection("rail", had_egress=False, free_rejections_used=cap).refunded


# --- entitlements ----------------------------------------------------------

def test_hard_limits_block():
    d = check("rail", Meter.LIVE_SOURCES, Usage(live_sources=1))
    assert not d.allowed and not d.billable_overage


def test_soft_limits_keep_running_and_bill():
    d = check("rail", Meter.PUBLISHED_CLIPS, Usage(clips_published=80))
    assert d.allowed and d.billable_overage


def test_monitoring_never_stops_mid_stream():
    """An always-on product whose failure mode is silence has no product."""
    d = check("rail", Meter.MONITORED_HOURS, Usage(monitored_seconds=40 * 3600 * 10))
    assert d.allowed is True


def test_seat_limit_message_is_singular_for_one_seat():
    d = check("rail", Meter.SEATS, Usage(seats=1))
    assert "1 seat." in d.message


def test_no_tier_has_unmetered_monitoring():
    """Twelve sources against an unmetered watcher is the one shape in the plan
    table that can run a negative margin. Network is generous (600 hours, 50 per
    source) but bounded, and going over bills rather than stops."""
    assert get_plan("network").monitored_hours == 600
    d = check("network", Meter.MONITORED_HOURS, Usage(monitored_seconds=700 * 3600))
    assert d.allowed and d.billable_overage


# --- margins ---------------------------------------------------------------

@pytest.mark.parametrize("code", ["rail", "control_room", "network"])
def test_every_paid_tier_clears_the_margin_floor(code):
    """The audit's open question, now a test.

    The published allowances were set so that a customer consuming 100% of them
    still leaves a defensible margin. If a future pricing change breaks that,
    this fails before the pricing page ships, not after the invoices land.
    """
    m = margin_for_plan(code)
    assert m["gross_margin"] >= 0.70, m


def test_cost_model_is_dominated_by_monitored_hours():
    """Sanity check on the model's shape: if clips ever dominate, the meter is
    on the wrong thing and the pricing story stops being true."""
    hours_only = cogs_for_usage(100, 0)
    clips_only = cogs_for_usage(0, 100)
    assert hours_only > clips_only
