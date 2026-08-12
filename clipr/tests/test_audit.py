"""The audit engine, tested against a fake database.

The property under test is that the score cannot be talked up: a fresh install
with no users must not score well, and a partial audit must fail loudly rather
than average over the sectors it managed to compute.
"""

import pytest

from packages.audit.runner import AuditRunner, SCORE, State, WEIGHTS


class FakeDb:
    """Answers by matching a fragment of the SQL. Crude, but it keeps the tests
    about the audit's logic instead of about a query builder."""

    def __init__(self, **answers):
        self.answers = answers
        self.missing_tables: set[str] = answers.pop("missing_tables", set())

    async def fetchval(self, sql: str, *args):
        if "to_regclass" in sql:
            return args[0].split(".")[-1] not in self.missing_tables
        for fragment, value in self.answers.items():
            if fragment in sql.replace("\n", " "):
                return value
        return 0

    async def fetchrow(self, sql: str, *args):
        return self.answers.get("__row__")


# pytest-asyncio is not a dependency; the coroutines are driven directly.
def run(coro):
    import asyncio
    return asyncio.run(coro)


# --- weights ---------------------------------------------------------------

def test_weights_sum_to_one():
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)


def test_code_complete_cannot_reach_ten():
    """The gap between built and verified is the whole point of the exercise."""
    assert SCORE[State.CODE_COMPLETE] == 6
    assert SCORE[State.VERIFIED] == 10


# --- honest defaults -------------------------------------------------------

def test_fresh_install_scores_poorly():
    report = run(AuditRunner(FakeDb()).run())
    assert report["verified_sectors"] == 0
    assert report["weighted_score"] < 5.0


def test_every_sector_is_reported():
    report = run(AuditRunner(FakeDb()).run())
    assert {s["sector"] for s in report["sectors"]} == set(WEIGHTS)


def test_missing_table_reads_as_broken_not_as_zero():
    """`or 0` on a missing table turns a failed migration into a bad score.

    The distinction matters: one is a product gap, the other is an outage.
    """
    db = FakeDb(missing_tables={"interviews"})
    result = run(AuditRunner(db).problem_and_market())
    assert result.state is State.NOT_STARTED
    assert "missing" in result.evidence


def test_interviews_verify_the_market_sector():
    db = FakeDb(missing_tables=set())
    db.answers["count(*) FROM interviews"] = 12
    result = run(AuditRunner(db).problem_and_market())
    assert result.state is State.VERIFIED


# --- AI quality ------------------------------------------------------------

def test_no_eval_run_is_code_complete_not_zero():
    result = run(AuditRunner(FakeDb()).ai_quality())
    assert result.state is State.CODE_COMPLETE


def test_null_metrics_do_not_crash():
    """`float(row['f1_score'])` on a nullable column raised TypeError."""
    db = FakeDb(__row__={"f1_score": None, "publishable_rate": None,
                         "labeled_moment_count": 100, "pipeline_version": "v1"})
    assert run(AuditRunner(db).ai_quality()).state is State.CODE_COMPLETE


def test_good_metrics_on_a_tiny_dataset_do_not_verify():
    db = FakeDb(__row__={"f1_score": 0.99, "publishable_rate": 0.99,
                         "labeled_moment_count": 8, "pipeline_version": "v1"})
    result = run(AuditRunner(db).ai_quality())
    assert result.state is State.INSUFFICIENT
    assert "not enough" in result.evidence


def test_strong_metrics_on_a_real_dataset_verify():
    db = FakeDb(__row__={"f1_score": 0.81, "publishable_rate": 0.66,
                         "labeled_moment_count": 200, "pipeline_version": "v1"})
    assert run(AuditRunner(db).ai_quality()).state is State.VERIFIED


# --- economics and security ------------------------------------------------

def test_economics_needs_production_data():
    result = run(AuditRunner(FakeDb()).ai_economics())
    assert result.state is State.CODE_COMPLETE
    assert "nothing has been processed" in result.evidence


def test_measured_cost_above_the_model_is_not_verified():
    # $100 of spend over 100 monitored hours: $1.00/hour, ten times the model.
    db = FakeDb(**{"SUM(amount_usd)": 100.0, "monitored_seconds": 100.0})
    result = run(AuditRunner(db).ai_economics())
    assert result.state is State.CODE_COMPLETE
    assert "exceeds" in result.blocker


def test_unforced_rls_fails_the_security_sector():
    db = FakeDb(**{"NOT c.relforcerowsecurity": 3})
    result = run(AuditRunner(db).security())
    assert result.state is State.NOT_STARTED


def test_forced_rls_is_still_only_code_complete():
    """Isolation being provable does not make the product penetration-tested."""
    result = run(AuditRunner(FakeDb()).security())
    assert result.state is State.CODE_COMPLETE
    assert "penetration test" in result.blocker


def test_legal_can_never_be_verified_from_a_database():
    result = run(AuditRunner(FakeDb()).legal())
    assert result.state is State.INSUFFICIENT
    assert "Cannot be built" in result.blocker
