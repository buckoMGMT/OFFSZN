"""Authentication.

This module had no tests at all, which is the wrong place in a codebase to have
none. Every test here corresponds to a way the previous version could be
bypassed or a way it crashed.

Skipped if bcrypt/PyJWT are unavailable, because a machine without them cannot
say anything about this code either way. CI installs them, so a skip there is a
failure (see infra/ci/quality-gates.yml).
"""

from __future__ import annotations

import time

import pytest

pytest.importorskip("bcrypt")
pytest.importorskip("jwt")

import jwt as pyjwt  # noqa: E402

from packages.auth.auth import (  # noqa: E402
    ROLE_SQL,
    SET_WORKSPACE_SQL,
    CurrentUser,
    TokenError,
    constant_time_eq,
    establish_context,
    generate_2fa_secret,
    has_role,
    hash_password,
    hash_token,
    issue_access_token,
    issue_refresh_token,
    verify_2fa,
    verify_access_token,
    verify_password,
)

SECRET = "a" * 48
WS = "11111111-1111-1111-1111-111111111111"
UID = "22222222-2222-2222-2222-222222222222"


@pytest.fixture(autouse=True)
def secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)


# --- the secret ------------------------------------------------------------

def test_a_missing_secret_fails_loudly(monkeypatch):
    """Read at call time and validated. Importing cleanly and then signing with
    "" is a total authentication bypass that looks like a working service."""
    monkeypatch.delenv("JWT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="at least 32"):
        issue_access_token(UID, WS)


def test_a_short_secret_is_refused(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "too-short")
    with pytest.raises(RuntimeError, match="openssl rand"):
        issue_access_token(UID, WS)


# --- passwords -------------------------------------------------------------

def test_password_round_trip():
    h = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", h)
    assert not verify_password("Correct horse battery staple", h)


def test_hash_is_salted():
    assert hash_password("same") != hash_password("same")


def test_long_passphrases_keep_their_entropy():
    """bcrypt silently truncates past 72 bytes, so two passphrases sharing a
    73-character prefix would otherwise be the same password."""
    base = "x" * 72
    assert not verify_password(base + "B", hash_password(base + "A"))


def test_empty_password_is_rejected_at_hash_time():
    with pytest.raises(ValueError):
        hash_password("")


@pytest.mark.parametrize("garbage", ["", "not-a-hash", "$2b$12$short"])
def test_verifying_against_a_corrupt_hash_returns_false(garbage):
    """Must not raise: a malformed row in the database is a login failure, not
    a 500 that tells an attacker they found something."""
    assert verify_password("anything", garbage) is False


# --- tokens ----------------------------------------------------------------

def test_access_token_round_trip():
    payload = verify_access_token(issue_access_token(UID, WS))
    assert payload["sub"] == UID and payload["ws"] == WS


def test_token_signed_with_another_secret_is_rejected(monkeypatch):
    token = issue_access_token(UID, WS)
    monkeypatch.setenv("JWT_SECRET", "b" * 48)
    with pytest.raises(TokenError):
        verify_access_token(token)


def test_the_none_algorithm_is_rejected():
    """The classic JWT bypass: forge a header of alg=none and sign nothing."""
    forged = pyjwt.encode({"sub": UID, "ws": WS, "typ": "access",
                           "iat": int(time.time()), "exp": int(time.time()) + 600},
                          key="", algorithm="none")
    with pytest.raises(TokenError):
        verify_access_token(forged)


def test_expired_tokens_are_rejected():
    expired = pyjwt.encode(
        {"sub": UID, "ws": WS, "typ": "access",
         "iat": int(time.time()) - 7200, "exp": int(time.time()) - 3600},
        SECRET, algorithm="HS256",
    )
    with pytest.raises(TokenError):
        verify_access_token(expired)


def test_a_refresh_token_is_not_accepted_as_an_access_token():
    """Without the typ check, the long-lived credential works everywhere the
    short-lived one does, and the 30-minute TTL means nothing."""
    wrong_type = pyjwt.encode(
        {"sub": UID, "ws": WS, "typ": "refresh",
         "iat": int(time.time()), "exp": int(time.time()) + 600},
        SECRET, algorithm="HS256",
    )
    with pytest.raises(TokenError, match="wrong token type"):
        verify_access_token(wrong_type)


def test_a_token_with_no_workspace_is_rejected():
    """A token that verifies but carries no workspace would establish a NULL
    RLS context -- which fails closed, but as a confusing empty account rather
    than an auth error."""
    no_ws = pyjwt.encode(
        {"sub": UID, "typ": "access",
         "iat": int(time.time()), "exp": int(time.time()) + 600},
        SECRET, algorithm="HS256",
    )
    with pytest.raises(TokenError, match="no workspace"):
        verify_access_token(no_ws)


def test_access_tokens_are_short_lived():
    """Revocation is the refresh token's job. A seven-day access token means a
    week between removing someone and them losing access."""
    payload = verify_access_token(issue_access_token(UID, WS))
    assert payload["exp"] - payload["iat"] <= 1800


def test_tokens_are_unique_per_issue():
    assert issue_access_token(UID, WS) != issue_access_token(UID, WS)


def test_refresh_token_is_stored_only_as_a_hash():
    raw, stored = issue_refresh_token()
    assert raw != stored
    assert stored == hash_token(raw)
    assert len(raw) >= 40


def test_constant_time_compare_still_compares():
    assert constant_time_eq("abc", "abc")
    assert not constant_time_eq("abc", "abd")


# --- 2FA -------------------------------------------------------------------

def test_2fa_secret_generation_does_not_raise():
    """The previous version called pyotp with no import in scope, so this raised
    NameError for every user who tried to enable 2FA."""
    pytest.importorskip("pyotp")
    secret = generate_2fa_secret()
    assert len(secret) >= 16


def test_2fa_round_trip():
    pyotp = pytest.importorskip("pyotp")
    secret = generate_2fa_secret()
    assert verify_2fa(secret, pyotp.TOTP(secret).now())
    assert not verify_2fa(secret, "000000")


# --- request context -------------------------------------------------------

class FakeConn:
    """Records the SQL it is asked to run."""

    def __init__(self, *, in_transaction=True, role="owner"):
        self.in_transaction = in_transaction
        self.role = role
        self.executed: list[tuple[str, tuple]] = []

    async def execute(self, sql, *args):
        self.executed.append((sql, args))

    async def fetchval(self, sql, *args):
        if "pg_current_xact_id_if_assigned" in sql:
            return self.in_transaction
        if "FROM memberships" in sql:
            return self.role
        return None


def run(coro):
    import asyncio
    return asyncio.run(coro)


def test_context_sets_the_workspace_with_a_bound_parameter():
    """`SET LOCAL app.current_workspace_id = $1` is a syntax error -- SET does
    not take bind parameters. set_config() is a function and does."""
    conn = FakeConn()
    run(establish_context(conn, issue_access_token(UID, WS)))
    sql, args = conn.executed[0]
    assert sql == SET_WORKSPACE_SQL
    assert "set_config" in sql and args == (WS,)
    assert "SET LOCAL app.current_workspace_id" not in sql


def test_context_outside_a_transaction_is_an_error():
    """set_config(..., true) is transaction-scoped. Outside a transaction it
    applies to one statement, so every later query in the request runs with no
    workspace -- which under these policies looks like an empty account, not an
    error."""
    conn = FakeConn(in_transaction=False)
    with pytest.raises(RuntimeError, match="inside a transaction"):
        run(establish_context(conn, issue_access_token(UID, WS)))


def test_role_is_read_from_the_database_not_the_token():
    """A demoted admin keeps admin rights until their token expires otherwise."""
    conn = FakeConn(role="viewer")
    forged = pyjwt.encode(
        {"sub": UID, "ws": WS, "typ": "access", "role": "owner",
         "iat": int(time.time()), "exp": int(time.time()) + 600},
        SECRET, algorithm="HS256",
    )
    user = run(establish_context(conn, forged))
    assert user.role == "viewer"
    assert any("FROM memberships" in sql for sql, _ in conn.executed + [(ROLE_SQL, ())])


def test_revoked_membership_is_rejected():
    conn = FakeConn(role=None)
    with pytest.raises(TokenError, match="no active membership"):
        run(establish_context(conn, issue_access_token(UID, WS)))


# --- roles -----------------------------------------------------------------

@pytest.mark.parametrize("role,minimum,expected", [
    ("owner", "admin", True),
    ("admin", "admin", True),
    ("editor", "admin", False),
    ("viewer", "editor", False),
    ("editor", "viewer", True),
])
def test_role_ranking(role, minimum, expected):
    assert has_role(CurrentUser(UID, WS, role), minimum) is expected


def test_unknown_role_requirement_is_a_programming_error():
    """`role in ("admin", "owner")` has to be updated at every call site when a
    role is added, and the one that gets missed is a privilege bug. Ranking
    fails loudly on a typo instead."""
    with pytest.raises(ValueError, match="unknown role"):
        has_role(CurrentUser(UID, WS, "owner"), "superadmin")
