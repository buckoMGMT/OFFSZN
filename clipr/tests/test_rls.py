"""Workspace isolation, proven against a real Postgres.

The original build asserted this through the HTTP layer with mocked fixtures,
which tests the API's WHERE clauses and nothing else. The claim being made is
stronger -- that isolation holds *at the database*, so a missing filter in a new
endpoint cannot leak -- and that claim can only be tested by connecting as the
application role and trying.

These tests are skipped rather than failed when no database is reachable, but
CI sets CLIPR_TEST_DSN and a skip there is treated as a failure (see
infra/ci/quality-gates.yml); a security test that quietly skips is worse than
no test.
"""

from __future__ import annotations

import os
import subprocess
import uuid

import pytest

DSN = os.environ.get("CLIPR_TEST_DSN")
pytestmark = pytest.mark.skipif(not DSN, reason="CLIPR_TEST_DSN not set")


def sql(query: str, *, role: str | None = None, workspace: str | None = None) -> str:
    """Run SQL as the application role, with an explicit workspace context.

    Everything runs in one transaction because `set_config(..., true)` is
    transaction-scoped -- the same property the application relies on.
    """
    prelude = ["BEGIN;"]
    if role:
        prelude.append(f"SET LOCAL ROLE {role};")
    if workspace is not None:
        # PERFORM inside DO rather than a bare SELECT, so setting the context
        # contributes no rows to the output being asserted on.
        prelude.append(
            f"DO $ctx$ BEGIN PERFORM set_config("
            f"'app.current_workspace_id', '{workspace}', true); END $ctx$;"
        )
    script = "\n".join(prelude) + f"\n{query}\nCOMMIT;"

    proc = subprocess.run(
        ["psql", DSN, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", script],
        capture_output=True, text=True, timeout=30,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr.strip())
    return proc.stdout.strip()


@pytest.fixture(scope="module")
def two_workspaces():
    """Two workspaces, each with one VOD. Created as the owner, bypassing RLS."""
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    vod_a, vod_b = str(uuid.uuid4()), str(uuid.uuid4())
    sql(f"""
        INSERT INTO workspaces (id, name, plan) VALUES
          ('{a}', 'workspace A', 'rail'), ('{b}', 'workspace B', 'rail');
        INSERT INTO vods (id, workspace_id, title, status) VALUES
          ('{vod_a}', '{a}', 'A stream', 'ready'),
          ('{vod_b}', '{b}', 'B stream', 'ready');
    """)
    yield {"a": a, "b": b, "vod_a": vod_a, "vod_b": vod_b}
    sql(f"DELETE FROM workspaces WHERE id IN ('{a}', '{b}');")


def test_owner_sees_its_own_vod(two_workspaces):
    out = sql(
        f"SELECT title FROM vods WHERE id = '{two_workspaces['vod_a']}';",
        role="clipr_app", workspace=two_workspaces["a"],
    )
    assert out == "A stream"


def test_workspace_a_cannot_read_workspace_b(two_workspaces):
    """The core claim. A direct primary-key lookup, no WHERE workspace_id."""
    out = sql(
        f"SELECT title FROM vods WHERE id = '{two_workspaces['vod_b']}';",
        role="clipr_app", workspace=two_workspaces["a"],
    )
    assert out == ""


def test_unfiltered_scan_returns_only_own_rows(two_workspaces):
    out = sql("SELECT count(*) FROM vods;", role="clipr_app", workspace=two_workspaces["a"])
    assert out == "1"


def test_no_workspace_context_returns_nothing(two_workspaces):
    """An endpoint that forgets to establish context must fail closed.

    current_setting(..., true) yields NULL, and `workspace_id = NULL` is never
    true, so the request sees an empty account rather than everyone's data.
    """
    out = sql("SELECT count(*) FROM vods;", role="clipr_app")
    assert out == "0"


def test_cannot_insert_into_another_workspace(two_workspaces):
    """WITH CHECK, not just USING.

    A USING-only policy filters reads but happily accepts a write that plants a
    row in someone else's workspace -- the more dangerous direction, since it
    lets an attacker inject content another customer will publish.
    """
    with pytest.raises(AssertionError, match="row-level security"):
        sql(
            f"INSERT INTO vods (workspace_id, title, status) "
            f"VALUES ('{two_workspaces['b']}', 'planted', 'ready');",
            role="clipr_app", workspace=two_workspaces["a"],
        )


def test_cannot_move_a_row_to_another_workspace(two_workspaces):
    with pytest.raises(AssertionError, match="row-level security"):
        sql(
            f"UPDATE vods SET workspace_id = '{two_workspaces['b']}' "
            f"WHERE id = '{two_workspaces['vod_a']}';",
            role="clipr_app", workspace=two_workspaces["a"],
        )


def test_rls_is_forced_not_merely_enabled():
    """Table owners bypass RLS unless FORCE is set.

    This is the bug that made the original schema's isolation entirely
    decorative: policies existed, RLS was ENABLEd, and the app connected as the
    owner -- so none of it applied.
    """
    out = sql("""
        SELECT count(*) FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND c.relrowsecurity AND NOT c.relforcerowsecurity;
    """)
    assert out == "0", "tables with RLS enabled but not FORCEd"


def test_every_rls_table_has_a_policy():
    """RLS with no policy denies everything -- a fail-closed outage that only
    appears under the application role."""
    out = sql("""
        SELECT coalesce(string_agg(c.relname, ','), '') FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
          AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);
    """)
    assert out == "", f"RLS enabled with no policy on: {out}"


def test_app_role_cannot_rewrite_the_price_list():
    with pytest.raises(AssertionError, match="permission denied"):
        sql("UPDATE plan_limits SET price_monthly_cents = 1 WHERE plan = 'rail';",
            role="clipr_app")
