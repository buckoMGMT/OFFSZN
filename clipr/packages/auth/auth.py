"""Authentication, and the request-scoped workspace context that RLS depends on.

The important fix in this file is not cryptographic, it is one line of SQL:

    await db.execute("SET LOCAL app.current_workspace_id = $1", workspace_id)

`SET` does not accept bind parameters in Postgres. That call raises a syntax
error, and the previous code ran it inside `if hasattr(request.state, "db")` --
so on any path where the attribute was absent it silently did nothing at all,
and on any path where it was present it raised. Either way the RLS context was
never set, which (with the fixed policies in 0002_rls.sql) means every query
returns nothing, and without them means no isolation at all. The correct form is
`set_config(name, value, is_local)`, which is a function and takes parameters.

Two further changes worth naming:

* Role is no longer read from the JWT. A token minted before a demotion would
  keep its old role until expiry -- a seven-day window in which a removed admin
  is still an admin. Role is looked up per request.
* `generate_2fa_secret` called `pyotp` with no import in scope. It raised
  NameError for every user who tried to enable 2FA.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

import bcrypt
import jwt

JWT_ALG = "HS256"
ACCESS_TTL = timedelta(minutes=30)     # short: revocation is the refresh token's job
REFRESH_TTL = timedelta(days=30)
BCRYPT_ROUNDS = 12
MIN_SECRET_LEN = 32


def _secret() -> str:
    value = os.environ.get("JWT_SECRET", "")
    # Read at call time, not import time, and validated. A short or missing
    # secret is a total authentication bypass, so it fails loudly at the first
    # request rather than importing cleanly and signing with "".
    if len(value) < MIN_SECRET_LEN:
        raise RuntimeError(
            f"JWT_SECRET must be at least {MIN_SECRET_LEN} characters "
            f"(got {len(value)}). Generate one with: openssl rand -base64 48"
        )
    return value


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    if not password:
        raise ValueError("password must not be empty")
    # bcrypt silently truncates past 72 bytes; hashing first means a long
    # passphrase keeps all of its entropy instead of only the first 72 bytes.
    digest = hashlib.sha256(password.encode()).digest()
    return bcrypt.hashpw(digest, bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        digest = hashlib.sha256(password.encode()).digest()
        return bcrypt.checkpw(digest, hashed.encode())
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------


def issue_access_token(user_id: str, workspace_id: str) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": user_id,
            "ws": workspace_id,
            "iat": now,
            "exp": now + ACCESS_TTL,
            "typ": "access",
            "jti": secrets.token_urlsafe(12),
        },
        _secret(),
        algorithm=JWT_ALG,
    )


def issue_refresh_token() -> tuple[str, str]:
    """Returns (token to hand to the client, hash to store)."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_token(raw)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class TokenError(Exception):
    """Raised for any invalid token. Deliberately one type: distinguishing
    'expired' from 'malformed' to the caller is an oracle, and the client
    behaviour is identical either way."""


def verify_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, _secret(), algorithms=[JWT_ALG],  # never [] or from the header
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from None

    # Without this a refresh token would be accepted as an access token.
    if payload.get("typ") != "access":
        raise TokenError("wrong token type")
    if not payload.get("ws"):
        raise TokenError("token carries no workspace")
    return payload


def constant_time_eq(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


# ---------------------------------------------------------------------------
# 2FA
# ---------------------------------------------------------------------------


def generate_2fa_secret() -> str:
    import pyotp
    return pyotp.random_base32()


def verify_2fa(secret: str, code: str) -> bool:
    import pyotp
    # valid_window=1 tolerates one step of clock drift in either direction.
    return pyotp.TOTP(secret).verify(code, valid_window=1)


# ---------------------------------------------------------------------------
# Request context
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    workspace_id: str
    role: str


class Connection(Protocol):
    async def execute(self, sql: str, *args): ...
    async def fetchval(self, sql: str, *args): ...


SET_WORKSPACE_SQL = "SELECT set_config('app.current_workspace_id', $1, true)"
ROLE_SQL = """
SELECT role FROM memberships
WHERE user_id = $1::uuid AND workspace_id = $2::uuid AND accepted_at IS NOT NULL
"""


async def establish_context(db: Connection, token: str) -> CurrentUser:
    """Verify the token, bind the workspace to this transaction, resolve the role.

    `set_config(..., is_local => true)` is transaction-scoped, so the caller must
    already be inside a transaction; otherwise the setting applies to a single
    statement and every later query in the request runs with no workspace. Assert
    rather than assume, because the failure is invisible under a policy that
    treats NULL as "match nothing" -- it looks like an empty account.
    """
    payload = verify_access_token(token)
    user_id, workspace_id = payload["sub"], payload["ws"]

    in_transaction = await db.fetchval("SELECT pg_current_xact_id_if_assigned() IS NOT NULL")
    if in_transaction is False:
        raise RuntimeError(
            "establish_context must run inside a transaction; SET LOCAL outside one "
            "silently applies to a single statement."
        )

    await db.execute(SET_WORKSPACE_SQL, workspace_id)

    # Read the role now rather than trusting the token's copy of it.
    role = await db.fetchval(ROLE_SQL, user_id, workspace_id)
    if role is None:
        raise TokenError("no active membership for this workspace")

    return CurrentUser(user_id=user_id, workspace_id=workspace_id, role=role)


ROLE_RANK = {"viewer": 0, "editor": 1, "admin": 2, "owner": 3}


def has_role(user: CurrentUser, minimum: str) -> bool:
    """Rank comparison, not set membership.

    `role in ("admin", "owner")` has to be updated at every call site when a
    role is added, and the one that gets missed is a privilege bug.
    """
    try:
        return ROLE_RANK[user.role] >= ROLE_RANK[minimum]
    except KeyError:
        raise ValueError(f"unknown role: {minimum}") from None
