"""The new INSERT statements, executed against a real Postgres.

The analytics emitter and the cost ledger were both tested against a recording
fake, which proves the Python is right and says nothing about whether the SQL
parses, matches the column list, or satisfies the constraints. Every statement
in this codebase that has never run is a statement that does not work yet.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import uuid

import pytest

from packages.analytics.events import (
    ACTIVATION_FUNNEL_SQL,
    ROLLUP_SQL,
)
from packages.analytics.events import (
    INSERT_SQL as EVENT_INSERT,
)
from packages.observability.cost import (
    MARGIN_BY_PLAN_SQL,
    MONITORED_HOURS_SQL,
    SPEND_SQL,
    UNDERWATER_SQL,
)
from packages.observability.ledger import INSERT_SQL as COST_INSERT

DSN = os.environ.get("CLIPR_TEST_DSN")
pytestmark = pytest.mark.skipif(not DSN, reason="CLIPR_TEST_DSN not set")


_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
_TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}|$)")
_NUMERIC = re.compile(r"^-?\d+(\.\d+)?$")


def _cast_for(value) -> str:
    """Postgres type to cast a psql-substituted literal to.

    asyncpg infers parameter types from the prepared statement; psql variable
    substitution is plain text, so `incurred_at >= '2020-01-01'` fails with
    "operator does not exist: timestamp with time zone >= text". Inferring the
    cast from the value's shape keeps the production SQL unmodified, which is
    the point -- a test that has to edit the statement is not testing it.
    """
    if isinstance(value, (int, float)):
        return "::numeric"
    if isinstance(value, str):
        if _UUID.match(value):
            return "::uuid"
        if _TIMESTAMP.match(value):
            return "::timestamptz"
        if _NUMERIC.match(value):
            return "::numeric"
    return "::text"


def sql(query: str, *args) -> str:
    """Run a statement, binding $n placeholders through psql variables."""
    params = {}
    # Descending: replacing $1 first would also hit the $1 inside $10, so a
    # query with ten or more parameters silently corrupts.
    for i in range(len(args), 0, -1):
        arg = args[i - 1]
        if arg is None:
            # A bare NULL, not a cast empty string: Postgres infers an untyped
            # NULL from the target column, whereas ''::text into a uuid column
            # is a type error.
            query = query.replace(f"${i}", "NULL")
            continue
        params[f"p{i}"] = arg
        query = query.replace(f"${i}", f":'p{i}'{_cast_for(arg)}")

    cmd = ["psql", DSN, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"]
    for name, value in params.items():
        cmd += ["-v", f"{name}={value}"]
    cmd += ["-f", "-"]

    proc = subprocess.run(cmd, input=query, capture_output=True, text=True, timeout=60)
    if proc.returncode != 0:
        raise AssertionError(proc.stderr.strip())
    return proc.stdout.strip()


@pytest.fixture
def workspace():
    ws = str(uuid.uuid4())
    sql("INSERT INTO workspaces (id, name, plan) VALUES ($1, 'warehouse test', 'rail');", ws)
    yield ws
    sql("DELETE FROM workspaces WHERE id = $1;", ws)


# --- analytics -------------------------------------------------------------

def test_the_event_insert_is_valid_sql(workspace):
    sql(EVENT_INSERT, workspace, None, None, "clip_published",
        json.dumps({"platform": "tiktok"}), "sess-1",
        "reddit", "social", "launch", None, None, "/pricing",
        "test-agent", "abc123", "2026-08-12T10:00:00Z")
    assert sql("SELECT count(*) FROM analytics_events WHERE workspace_id = $1;",
               workspace) == "1"


def test_an_anonymous_event_can_be_written_with_no_workspace():
    """Pre-signup traffic has no account yet. The RLS policy permits the write
    and never permits reading it back."""
    # Prefixed rather than a bare uuid: anonymous_id is a text column, and the
    # cast heuristic above would read a uuid-shaped string as a uuid.
    anon = f"anon-{uuid.uuid4()}"
    sql(EVENT_INSERT, None, None, anon, "landing_viewed", "{}", "sess-2",
        None, None, None, None, None, "/", None, None, "2026-08-12T10:00:00Z")
    assert sql("SELECT count(*) FROM analytics_events WHERE anonymous_id = $1;",
               anon) == "1"
    sql("DELETE FROM analytics_events WHERE anonymous_id = $1;", anon)


def test_the_properties_column_accepts_the_json_we_send(workspace):
    sql(EVENT_INSERT, workspace, None, None, "clip_reviewed",
        json.dumps({"decision": "approved", "duration_ms": 1400, "nested": {"a": [1, 2]}}),
        None, None, None, None, None, None, None, None, None, "2026-08-12T10:00:00Z")
    assert sql("SELECT properties->>'decision' FROM analytics_events "
               "WHERE workspace_id = $1;", workspace) == "approved"


def test_the_landing_rollup_runs_and_is_idempotent(workspace):
    sql("DELETE FROM analytics_events WHERE occurred_at::date = '2026-08-12';")
    sql("DELETE FROM landing_page_daily WHERE day = '2026-08-12';")
    for name in ("landing_viewed", "signup_started", "signup_completed"):
        sql(EVENT_INSERT, None, None, "anon-roll", name, "{}", "sess-roll",
            None, None, None, None, None, "/", None, None, "2026-08-12T10:00:00Z")
    for _ in range(2):
        sql(ROLLUP_SQL, "2026-08-12", "2026-08-13")
    row = sql("SELECT sessions, signup_starts, signups_completed "
              "FROM landing_page_daily WHERE day = '2026-08-12';")
    assert row == "1|1|1"
    sql("DELETE FROM analytics_events WHERE anonymous_id = 'anon-roll';")
    sql("DELETE FROM landing_page_daily WHERE day = '2026-08-12';")


def test_the_activation_funnel_query_runs():
    """It uses FILTER, percentile_cont and a CTE -- worth executing once."""
    assert sql(ACTIVATION_FUNNEL_SQL + ";") is not None


# --- cost ledger -----------------------------------------------------------

def test_the_cost_insert_is_valid_sql(workspace):
    sql(COST_INSERT, workspace, None, None, None, "transcription",
        "0.032000", "3600", "audio_second",
        json.dumps({"gpu_seconds": 144}), "2026-08-12T10:00:00Z")
    assert sql("SELECT count(*) FROM processing_costs WHERE workspace_id = $1;",
               workspace) == "1"


def test_the_ledger_rejects_a_negative_amount_at_the_database_too(workspace):
    """Python refuses first; the CHECK constraint is the backstop for anything
    that writes to this table without going through the ledger."""
    with pytest.raises(AssertionError, match="violates check constraint"):
        sql(COST_INSERT, workspace, None, None, None, "rendering",
            "-1.0", "1", "gpu_second", "{}", "2026-08-12T10:00:00Z")


def test_an_unknown_cost_category_is_refused(workspace):
    with pytest.raises(AssertionError, match="violates check constraint"):
        sql(COST_INSERT, workspace, None, None, None, "vibes",
            "1.0", "1", "unit", "{}", "2026-08-12T10:00:00Z")


def test_cost_per_monitored_hour_needs_no_join(workspace):
    """The fan-out bug lived in a join between costs and vods. Spend and hours
    are two independent single-table aggregates now, and this proves both
    queries run and that neither multiplies the other."""
    connection = str(uuid.uuid4())
    sql("INSERT INTO stream_connections "
        "(id, workspace_id, platform, external_user_id, access_token_encrypted) "
        "VALUES ($1, $2, 'twitch', 'ext-1', '\\x00');", connection, workspace)
    session = str(uuid.uuid4())
    sql("INSERT INTO stream_sessions "
        "(id, workspace_id, stream_connection_id, monitored_seconds, ended_at) "
        "VALUES ($1, $2, $3, 7200, now());", session, workspace, connection)

    for _ in range(3):
        sql(COST_INSERT, workspace, session, None, None, "compute",
            "0.020000", "3600", "cpu_second", "{}", "2026-08-12T10:00:00Z")

    hours = float(sql(MONITORED_HOURS_SQL + ";", "2020-01-01", workspace))
    spend = sum(float(line.split("|")[1])
                for line in sql(SPEND_SQL + ";", "2020-01-01", workspace).splitlines())
    # Two hours of monitoring and three cost rows: hours must stay 2, not 6.
    assert hours == pytest.approx(2.0)
    assert spend == pytest.approx(0.06)
    assert spend / hours == pytest.approx(0.03)


def test_the_margin_and_underwater_queries_run():
    assert sql(MARGIN_BY_PLAN_SQL + ";", "2020-01-01") is not None
    assert sql(UNDERWATER_SQL + ";", "2020-01-01") is not None
