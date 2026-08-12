"""The audit engine, tested against a fake database.

Two properties are under test, and they pull against each other on purpose:

* The score cannot be talked up. A fresh install must score badly, a fixture
  dataset must not verify AI quality, and a partial audit must fail loudly
  rather than average over the sectors it managed to compute.
* The score is *reachable*. Every sector must have some database state that
  verifies it. The previous engine failed this for three sectors -- Product,
  Growth and Landing Page were capped at 6 by construction, so 20% of the
  weight was unreachable for reasons unrelated to evidence. A bar nobody can
  clear is not rigour, it is a broken instrument.
"""

import asyncio

import pytest

from packages.audit.runner import REQUIREMENTS, SCORE, WEIGHTS, AuditRunner, State


class FakeDb:
    """Answers by matching a fragment of the SQL.

    Crude, but it keeps these tests about the audit's logic rather than about a
    query builder.
    """

    def __init__(self, **answers):
        self.missing_tables: set[str] = answers.pop("missing_tables", set())
        self.rows: dict[str, dict] = answers.pop("rows", {})
        self.answers = answers

    async def fetchval(self, sql: str, *args):
        if "to_regclass" in sql:
            return args[0].split(".")[-1] not in self.missing_tables
        flat = " ".join(sql.split())
        # Longest match wins. "count(*) FROM usability_sessions" is a substring
        # of the "... WHERE completed_task" query, so first-match would answer
        # both with the same number and quietly make every session a pass.
        matches = [(f, v) for f, v in self.answers.items() if f in flat]
        return max(matches, key=lambda m: len(m[0]))[1] if matches else 0

    async def fetchrow(self, sql: str, *args):
        flat = " ".join(sql.split())
        for fragment, row in self.rows.items():
            if fragment in flat:
                return row
        return None


def run(coro):
    return asyncio.run(coro)


def fully_evidenced() -> FakeDb:
    """A database state in which every sector's bar is cleared.

    Used to prove each sector is reachable at all, and as the base for the
    one-thing-missing cases below.
    """
    return FakeDb(
        **{
            "count(*) FROM interviews": 12,
            "FROM subscriptions WHERE status = 'active'": 3,
            "count(*) FROM usability_sessions": 6,
            "FROM usability_sessions WHERE completed_task": 6,
            "count(*) FROM processing_jobs": 5000,
            "count(*) FROM dead_letter_jobs": 4,
            "NOT c.relforcerowsecurity": 0,
            "NOT EXISTS (SELECT 1 FROM pg_policy": 0,
            "SUM(amount_usd)": 40.0,
            "monitored_seconds": 900.0,
            "count(*) FROM analytics_events": 50_000,
            "count(DISTINCT event_name)": 26,
            "count(*) FROM referrals": 40,
            "FROM referral_conversions WHERE converted_to_paid_at": 7,
            "FROM analytics_events WHERE occurred_at <": 120,
            "a.workspace_id IN": 70,
            "FROM legal_reviews": ["entity_formation", "ip_assignment",
                                   "terms_and_privacy", "platform_tos",
                                   "incident_response"],
        },
        rows={
            "FROM ai_evaluations": {
                "f1_score": 0.81, "publishable_rate": 0.66,
                "labeled_moment_count": 240, "pipeline_version": "clipr-ai-v2",
                "synthetic": False,
            },
            "FROM load_test_runs": {
                "operations": 1366, "concurrency": 8, "error_rate": 0.0,
                "p95_ms": 109.2, "provenance": "load_test",
                "scenario": "queue claim/complete/retry/dead-letter",
            },
            "FROM landing_page_daily": {"sessions": 4200, "signups": 190},
            "FROM security_assessments": {
                "vendor": "an external firm", "critical_findings_open": 0,
                "high_findings_open": 0, "completed_at": "2026-08-01",
            },
        },
    )


# --- shape of the instrument ----------------------------------------------

def test_weights_sum_to_one():
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)


def test_code_complete_cannot_reach_ten():
    """The gap between built and verified is the whole point of the exercise."""
    assert SCORE[State.CODE_COMPLETE] == 6
    assert SCORE[State.VERIFIED] == 10


def test_every_sector_has_a_stated_requirement():
    assert set(REQUIREMENTS) == set(WEIGHTS)


def test_every_sector_can_actually_reach_verified():
    """The defect this replaces.

    Product, Growth and Landing Page had no database state that would verify
    them -- 20% of the weight was unreachable by construction. This fails the
    moment a sector is added or edited back into that shape.
    """
    report = run(AuditRunner(fully_evidenced()).run())
    unreachable = [s["sector"] for s in report["sectors"] if s["state"] != "verified"]
    assert unreachable == [], f"no evidence can verify: {unreachable}"
    assert report["weighted_score"] == pytest.approx(10.0)


# --- honest defaults -------------------------------------------------------

def test_fresh_install_scores_poorly():
    report = run(AuditRunner(FakeDb()).run())
    assert report["verified_sectors"] == 0
    assert report["weighted_score"] < 5.0


def test_every_sector_is_reported():
    report = run(AuditRunner(FakeDb()).run())
    assert {s["sector"] for s in report["sectors"]} == set(WEIGHTS)


def test_the_report_says_who_has_to_act():
    """The number on its own is a scold. The list of who has to do what is the
    part anyone can use."""
    report = run(AuditRunner(FakeDb()).run())
    assert {"founder", "market", "counsel", "vendor", "time"} <= set(report["remaining_by_actor"])
    remaining = report["remaining"]
    assert all(remaining[i]["weight_available"] >= remaining[i + 1]["weight_available"]
               for i in range(len(remaining) - 1))


def test_missing_table_reads_as_broken_not_as_zero():
    """`or 0` on a missing table turns a failed migration into a bad score. One
    is an outage, the other is a product gap, and they need different responses.
    """
    db = FakeDb(missing_tables={"interviews"})
    result = run(AuditRunner(db).problem_and_market())
    assert result.state is State.NOT_STARTED
    assert "missing" in result.evidence


def test_uncountable_table_is_a_programming_error():
    with pytest.raises(ValueError, match="not a countable table"):
        run(AuditRunner(FakeDb())._count("clips"))


# --- AI quality ------------------------------------------------------------

def test_no_eval_run_is_code_complete_not_zero():
    assert run(AuditRunner(FakeDb()).ai_quality()).state is State.CODE_COMPLETE


def test_null_metrics_do_not_crash():
    """`float(row['f1_score'])` on a nullable column raised TypeError."""
    db = FakeDb(rows={"FROM ai_evaluations": {
        "f1_score": None, "publishable_rate": None, "labeled_moment_count": 100,
        "pipeline_version": "v1", "synthetic": False}})
    assert run(AuditRunner(db).ai_quality()).state is State.CODE_COMPLETE


def test_good_metrics_on_a_tiny_dataset_do_not_verify():
    db = FakeDb(rows={"FROM ai_evaluations": {
        "f1_score": 0.99, "publishable_rate": 0.99, "labeled_moment_count": 8,
        "pipeline_version": "v1", "synthetic": False}})
    result = run(AuditRunner(db).ai_quality())
    assert result.state is State.INSUFFICIENT
    assert "not enough" in result.evidence


def test_a_synthetic_eval_run_cannot_verify_ai_quality():
    """`make eval` ships with a fixture that scores 1.0. If that could verify the
    sector, the audit would be self-congratulating out of the box."""
    db = FakeDb(rows={"FROM ai_evaluations": {
        "f1_score": 1.0, "publishable_rate": 1.0, "labeled_moment_count": 500,
        "pipeline_version": "v1", "synthetic": True}})
    result = run(AuditRunner(db).ai_quality())
    assert result.state is State.CODE_COMPLETE
    assert "synthetic" in result.evidence


# --- product ---------------------------------------------------------------

def test_product_needs_watched_sessions_not_signups():
    """The old version keyed this on user count and could never verify."""
    db = FakeDb(**{"count(*) FROM users": 10_000, "count(*) FROM usability_sessions": 0})
    result = run(AuditRunner(db).product())
    assert result.state is State.CODE_COMPLETE
    assert "5 usability sessions" in result.blocker


def test_product_sessions_that_mostly_fail_do_not_verify():
    db = FakeDb(**{"count(*) FROM usability_sessions": 5,
                   "FROM usability_sessions WHERE completed_task": 2})
    result = run(AuditRunner(db).product())
    assert result.state is State.CODE_COMPLETE
    assert "40%" in result.evidence


# --- engineering -----------------------------------------------------------

def test_a_small_load_run_does_not_verify_engineering():
    db = FakeDb(**{"count(*) FROM processing_jobs": 50, "count(*) FROM dead_letter_jobs": 0},
                rows={"FROM load_test_runs": {
                    "operations": 40, "concurrency": 2, "error_rate": 0.0,
                    "p95_ms": 5.0, "provenance": "load_test", "scenario": "smoke"}})
    result = run(AuditRunner(db).engineering())
    assert result.state is State.CODE_COMPLETE
    assert "only 40 operations" in result.blocker


def test_a_high_dead_letter_rate_does_not_verify_engineering():
    """A queue can be fast and still be losing work. Throughput without the
    dead-letter rate is a vanity metric."""
    db = FakeDb(**{"count(*) FROM processing_jobs": 2000,
                   "count(*) FROM dead_letter_jobs": 300},
                rows={"FROM load_test_runs": {
                    "operations": 2000, "concurrency": 8, "error_rate": 0.0,
                    "p95_ms": 12.0, "provenance": "load_test", "scenario": "queue"}})
    result = run(AuditRunner(db).engineering())
    assert result.state is State.CODE_COMPLETE
    assert "dead-letter rate" in result.blocker


def test_an_erroring_load_run_does_not_verify_engineering():
    db = FakeDb(**{"count(*) FROM processing_jobs": 2000,
                   "count(*) FROM dead_letter_jobs": 1},
                rows={"FROM load_test_runs": {
                    "operations": 2000, "concurrency": 8, "error_rate": 0.05,
                    "p95_ms": 12.0, "provenance": "load_test", "scenario": "queue"}})
    assert run(AuditRunner(db).engineering()).state is State.CODE_COMPLETE


# --- security and legal ----------------------------------------------------

def test_unforced_rls_fails_the_security_sector():
    db = FakeDb(**{"NOT c.relforcerowsecurity": 3})
    assert run(AuditRunner(db).security()).state is State.NOT_STARTED


def test_isolation_alone_is_not_a_penetration_test():
    result = run(AuditRunner(FakeDb()).security())
    assert result.state is State.CODE_COMPLETE
    assert "penetration test" in result.blocker


def test_an_assessment_with_open_criticals_does_not_verify():
    db = FakeDb(rows={"FROM security_assessments": {
        "vendor": "a firm", "critical_findings_open": 2, "high_findings_open": 1,
        "completed_at": "2026-08-01"}})
    result = run(AuditRunner(db).security())
    assert result.state is State.CODE_COMPLETE
    assert "2 critical" in result.evidence


def test_partial_legal_review_does_not_verify():
    db = FakeDb(**{"FROM legal_reviews": ["entity_formation", "ip_assignment"]})
    result = run(AuditRunner(db).legal())
    assert result.state is State.CODE_COMPLETE
    assert "platform_tos" in result.blocker


def test_no_legal_review_is_insufficient_not_merely_incomplete():
    result = run(AuditRunner(FakeDb()).legal())
    assert result.state is State.INSUFFICIENT
    assert "Cannot be built" in result.blocker


# --- economics and retention ----------------------------------------------

def test_economics_needs_production_data():
    result = run(AuditRunner(FakeDb()).ai_economics())
    assert result.state is State.CODE_COMPLETE
    assert "nothing has been processed" in result.evidence


def test_measured_cost_above_the_model_is_not_verified():
    # $100 over 100 monitored hours is $1.00/hour, ten times the model.
    db = FakeDb(**{"SUM(amount_usd)": 100.0, "monitored_seconds": 100.0})
    result = run(AuditRunner(db).ai_economics())
    assert result.state is State.CODE_COMPLETE
    assert "exceeds" in result.blocker


def test_a_tiny_cohort_cannot_verify_retention():
    """D7 over three workspaces is not a retention rate, it is an anecdote."""
    db = FakeDb(**{"FROM analytics_events WHERE occurred_at <": 3, "a.workspace_id IN": 3})
    result = run(AuditRunner(db).retention())
    assert result.state is State.CODE_COMPLETE
    assert "cohort of 20+" in result.blocker


def test_low_volume_landing_traffic_cannot_verify_a_rate():
    db = FakeDb(rows={"FROM landing_page_daily": {"sessions": 40, "signups": 20}})
    result = run(AuditRunner(db).landing_page())
    assert result.state is State.CODE_COMPLETE
    assert "960 more sessions" in result.blocker


def test_referrals_without_conversions_do_not_verify_growth():
    db = FakeDb(**{"count(*) FROM referrals": 500,
                   "FROM referral_conversions WHERE converted_to_paid_at": 0})
    result = run(AuditRunner(db).growth())
    assert result.state is State.CODE_COMPLETE
    assert "One conversion" in result.blocker
