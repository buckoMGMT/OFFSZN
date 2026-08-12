"""Budget guard, reframe geometry, and plan-table parity.

`test_plan_parity` is the one that stops a whole class of billing bug: the
pricing page, the Python plan table and the database plan table are three copies
of the same numbers, and copies drift.
"""

import re
from pathlib import Path

import pytest

from packages.ai.crop import Crop, Reframer, Region
from packages.billing.plans import PLANS, UNLIMITED
from packages.observability.cost import GuardAction, evaluate_budget

ROOT = Path(__file__).resolve().parents[1]


# ---------------------------------------------------------------------------
# Plan parity
# ---------------------------------------------------------------------------

def parse_sql_plan_rows() -> dict[str, list[str]]:
    sql = (ROOT / "packages/db/migrations/0001_init.sql").read_text()
    block = sql.split("INSERT INTO plan_limits VALUES")[1].split(";")[0]
    rows = {}
    for line in block.splitlines():
        line = line.strip().lstrip("(").rstrip(",").rstrip(")")
        if not line.startswith("'"):
            continue
        fields = [f.strip().strip("'") for f in line.split(",")]
        rows[fields[0]] = fields
    return rows


def test_sql_and_python_plan_tables_agree():
    sql_rows = parse_sql_plan_rows()
    assert set(sql_rows) == set(PLANS)
    for code, plan in PLANS.items():
        f = sql_rows[code]
        assert f[1] == plan.display_name, code
        assert int(f[2]) == plan.live_sources, code
        assert int(f[3]) == plan.monitored_hours, code
        assert int(f[4]) == plan.published_clips, code
        assert int(f[5]) == plan.connected_accounts, code
        assert int(f[6]) == plan.seats, code
        assert int(f[8]) == plan.price_monthly_cents, code
        assert int(f[9]) == plan.price_annual_cents, code


def test_pricing_page_quotes_the_same_numbers():
    """The page is a third copy of the plan table. It drifts fastest, because
    marketing edits it and nothing tests it."""
    page = (ROOT / "index.html").read_text()
    for code in ("rail", "control_room", "network"):
        plan = PLANS[code]
        dollars = plan.price_monthly_cents // 100
        assert f'data-m="{dollars}"' in page, f"{code} monthly price missing from page"
        assert f"{plan.monitored_hours} / mo" in page, f"{code} monitored hours wrong on page"
        assert f"{plan.published_clips:,} / mo" in page or \
               f"{plan.published_clips} / mo" in page, f"{code} clip allowance wrong on page"


# ---------------------------------------------------------------------------
# Budget guard
# ---------------------------------------------------------------------------

def test_normal_spend_is_left_alone():
    d = evaluate_budget(spend_usd=10, plan_price_usd=79)
    assert d.action is GuardAction.CONTINUE


def test_approaching_the_ceiling_warns():
    d = evaluate_budget(spend_usd=250, plan_price_usd=79)     # ceiling 316
    assert d.action is GuardAction.WARN


def test_at_the_ceiling_it_throttles_rather_than_stopping():
    """For an always-on product, silence is the worst failure. The guard
    degrades the pipeline before it ever stops watching."""
    d = evaluate_budget(spend_usd=320, plan_price_usd=79)
    assert d.action is GuardAction.THROTTLE
    assert "continues" in d.message


def test_runaway_spend_detaches():
    d = evaluate_budget(spend_usd=5_000, plan_price_usd=79)
    assert d.action is GuardAction.DETACH
    assert "fault" in d.message


def test_an_explicit_ceiling_overrides_the_plan_default():
    d = evaluate_budget(spend_usd=60, plan_price_usd=79, ceiling_usd=50)
    assert d.action is GuardAction.THROTTLE


def test_zero_ceiling_does_not_divide_by_zero():
    d = evaluate_budget(spend_usd=100, plan_price_usd=0)
    assert d.action is GuardAction.CONTINUE and d.ratio == 0.0


# ---------------------------------------------------------------------------
# Reframe geometry
# ---------------------------------------------------------------------------

def test_landscape_source_crops_to_target_aspect():
    box = Reframer(1920, 1080, 1080, 1920).crop_box(None)
    assert box.h == 1080
    assert box.w == pytest.approx(1080 * 9 / 16, abs=2)


def test_crop_centres_on_the_subject():
    r = Reframer(1920, 1080)
    left = r.crop_box(Region(100, 400, 200, 200))
    right = r.crop_box(Region(1600, 400, 200, 200))
    assert left.x < right.x


def test_crop_never_leaves_the_frame():
    """An out-of-bounds crop fails the whole ffmpeg render, which in an
    unattended pipeline is a silent gap in someone's posting schedule."""
    r = Reframer(1920, 1080)
    for x in (-500, 0, 960, 1919, 5000):
        box = r.crop_box(Region(x, 540, 10, 10))
        assert 0 <= box.x and box.x + box.w <= 1920
        assert 0 <= box.y and box.y + box.h <= 1080


def test_crop_dimensions_are_even():
    """libx264 rejects odd dimensions."""
    box = Reframer(1919, 1081).crop_box(Region(500, 500, 50, 50))
    assert box.w % 2 == 0 and box.h % 2 == 0 and box.x % 2 == 0 and box.y % 2 == 0


def test_smoothing_clamps_how_far_the_frame_can_jump():
    """Averaging alone still lets the crop teleport when a second face appears."""
    r = Reframer(1920, 1080)
    track = [r.crop_box(Region(100, 540, 10, 10), t=0.0),
             r.crop_box(Region(1800, 540, 10, 10), t=0.5)]
    smoothed = r.smooth(track, window=1, max_step=24)
    assert abs(smoothed[1].x - smoothed[0].x) <= 24


def test_sendcmd_emits_only_actual_movement():
    """One command per sample on a 60-second clip is 120 no-ops in the filter
    graph."""
    r = Reframer(1920, 1080)
    static = [Crop(t=i * 0.5, x=420, y=0, w=608, h=1080, reason="center") for i in range(20)]
    assert r.sendcmd_script(static).strip().count(";") == 1


def test_sendcmd_is_valid_ffmpeg_syntax():
    r = Reframer(1920, 1080)
    track = [Crop(0.0, 100, 0, 608, 1080, "face"), Crop(1.0, 300, 0, 608, 1080, "face")]
    script = r.sendcmd_script(track)
    for line in script.strip().splitlines():
        assert re.fullmatch(r"\d+\.\d{3} crop x \d+, crop y \d+;", line), line


def test_render_without_a_track_refuses_rather_than_centre_cropping():
    """The bug this replaces: render() computed a smoothed track, discarded it,
    and applied one static centre crop -- so the entire detection pipeline was
    dead code and nobody could see it from the output."""
    with pytest.raises(ValueError, match="no crop track"):
        Reframer().render("in.mp4", "out.mp4", [])


def test_reframer_rejects_impossible_dimensions():
    with pytest.raises(ValueError):
        Reframer(0, 1080)
