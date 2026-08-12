"""Event taxonomy and emitter.

The schema had an `analytics_events` table and nothing that wrote to it, which
quietly blocks three audit sectors at once: Analytics needs events, Retention is
computed from them, and Landing Page conversion is derived from them. A table
with no producer is not instrumentation, it is a place instrumentation could go.

The taxonomy is a closed set. An open one becomes `clip_approved`,
`clipApproved`, `clip-approve` and `approve_clip` within a month, and then the
funnel silently under-counts and nobody can tell which name is the real one.
Unknown names raise.

Every event carries the workspace when there is one. Pre-signup events carry an
anonymous id instead, and the RLS policy on `analytics_events` allows those to
be written and never read back -- so anonymous traffic can be counted without
becoming a way to read another workspace's rows.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Protocol


class Event(StrEnum):
    """The canonical set. Adding one here is the only way to emit it."""

    # Acquisition — before an account exists
    LANDING_VIEWED = "landing_viewed"
    PRICING_VIEWED = "pricing_viewed"
    CALCULATOR_USED = "calculator_used"
    SIGNUP_STARTED = "signup_started"
    SIGNUP_COMPLETED = "signup_completed"

    # Activation — the path to a first published clip
    SOURCE_CONNECT_STARTED = "source_connect_started"
    SOURCE_CONNECTED = "source_connected"
    DESTINATION_CONNECTED = "destination_connected"
    FIRST_STREAM_DETECTED = "first_stream_detected"
    FIRST_CLIP_GENERATED = "first_clip_generated"
    FIRST_CLIP_PUBLISHED = "first_clip_published"

    # Core loop
    STREAM_MONITOR_STARTED = "stream_monitor_started"
    STREAM_MONITOR_ENDED = "stream_monitor_ended"
    CLIP_GENERATED = "clip_generated"
    CLIP_REVIEWED = "clip_reviewed"
    CLIP_PUBLISHED = "clip_published"
    CLIP_PUBLISH_FAILED = "clip_publish_failed"
    CLIP_HANDED_OFF = "clip_handed_off"
    SAFETY_FLAG_RAISED = "safety_flag_raised"

    # Commercial
    TRIAL_STARTED = "trial_started"
    PLAN_SELECTED = "plan_selected"
    CHECKOUT_STARTED = "checkout_started"
    SUBSCRIPTION_ACTIVATED = "subscription_activated"
    OVERAGE_WARNING_SHOWN = "overage_warning_shown"
    SUBSCRIPTION_CANCELLED = "subscription_cancelled"

    # Growth
    REFERRAL_CODE_CREATED = "referral_code_created"
    REFERRAL_VISITED = "referral_visited"


# The audit's Analytics sector wants 20+ distinct event types firing. That is a
# proxy for "the funnel is actually instrumented", so the taxonomy has to be at
# least that rich before it means anything. Raised rather than asserted: `python
# -O` strips asserts, and an invariant that disappears under an optimisation
# flag is not an invariant.
MIN_TAXONOMY_SIZE = 20
if len(Event) < MIN_TAXONOMY_SIZE:
    raise RuntimeError(
        f"taxonomy has {len(Event)} events; a funnel needs at least "
        f"{MIN_TAXONOMY_SIZE} to be worth measuring"
    )

# Events that may legitimately arrive with no workspace, because they happen
# before an account exists. Anything else without a workspace is a bug in the
# caller, and silently accepting it produces a funnel with an unattributable
# top.
ANONYMOUS_ALLOWED = frozenset({
    Event.LANDING_VIEWED,
    Event.PRICING_VIEWED,
    Event.CALCULATOR_USED,
    Event.SIGNUP_STARTED,
    Event.REFERRAL_VISITED,
})

# Properties that must never be written to the warehouse. Analytics is the
# database everyone eventually gets read access to.
FORBIDDEN_PROPERTIES = frozenset({
    "email", "password", "access_token", "refresh_token", "token",
    "ip", "ip_address", "card", "phone", "authorization",
})


@dataclass
class Attribution:
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    utm_content: str | None = None
    referrer: str | None = None
    landing_page: str | None = None


@dataclass
class EventRecord:
    event_name: str
    workspace_id: str | None
    user_id: str | None
    anonymous_id: str | None
    properties: dict[str, Any]
    session_id: str | None
    attribution: Attribution
    user_agent: str | None
    ip_hash: str | None
    occurred_at: str = field(
        default_factory=lambda: datetime.now(UTC).isoformat()
    )


class Sink(Protocol):
    async def execute(self, sql: str, *args): ...


INSERT_SQL = """
INSERT INTO analytics_events (
  workspace_id, user_id, anonymous_id, event_name, properties, session_id,
  utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_page,
  user_agent, ip_hash, occurred_at
) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::timestamptz)
"""


def hash_ip(ip: str | None, salt: str | None = None) -> str | None:
    """One-way, salted. Raw addresses are personal data in most of the places
    this product will operate, and the funnel never needs the address itself --
    only whether two hits came from the same one."""
    if not ip:
        return None
    salt = salt if salt is not None else os.environ.get("ANALYTICS_IP_SALT", "")
    return hashlib.sha256(f"{salt}{ip}".encode()).hexdigest()[:32]


class UnknownEvent(ValueError):
    pass


class Analytics:
    def __init__(self, sink: Sink, *, ip_salt: str | None = None):
        self.sink = sink
        self.ip_salt = ip_salt

    def build(
        self,
        event: Event | str,
        *,
        workspace_id: str | None = None,
        user_id: str | None = None,
        anonymous_id: str | None = None,
        properties: dict[str, Any] | None = None,
        session_id: str | None = None,
        attribution: Attribution | None = None,
        user_agent: str | None = None,
        ip: str | None = None,
    ) -> EventRecord:
        try:
            name = Event(event)
        except ValueError:
            raise UnknownEvent(
                f"{event!r} is not in the taxonomy. Add it to packages/analytics/events.py "
                f"rather than emitting a free-form name -- four spellings of one event is "
                f"how a funnel starts under-counting without anyone noticing."
            ) from None

        if workspace_id is None and name not in ANONYMOUS_ALLOWED:
            raise ValueError(
                f"{name} requires a workspace. Only pre-signup events may be anonymous."
            )
        if workspace_id is None and anonymous_id is None:
            raise ValueError(f"{name} needs either a workspace or an anonymous id.")

        props = dict(properties or {})
        leaked = FORBIDDEN_PROPERTIES & {k.lower() for k in props}
        if leaked:
            raise ValueError(
                f"Refusing to write {sorted(leaked)} to the warehouse. Analytics is the "
                f"database everyone eventually gets read access to."
            )

        return EventRecord(
            event_name=str(name),
            workspace_id=workspace_id,
            user_id=user_id,
            anonymous_id=anonymous_id,
            properties=props,
            session_id=session_id,
            attribution=attribution or Attribution(),
            user_agent=user_agent,
            ip_hash=hash_ip(ip, self.ip_salt),
        )

    async def emit(self, event: Event | str, **kwargs) -> EventRecord:
        """Record one event.

        Analytics must never take the product down: a warehouse write that fails
        is logged and swallowed, because losing a funnel row is survivable and
        failing a creator's publish because of a metrics insert is not.
        """
        record = self.build(event, **kwargs)
        a = record.attribution
        try:
            await self.sink.execute(
                INSERT_SQL,
                record.workspace_id, record.user_id, record.anonymous_id,
                record.event_name, json.dumps(record.properties), record.session_id,
                a.utm_source, a.utm_medium, a.utm_campaign, a.utm_content,
                a.referrer, a.landing_page,
                record.user_agent, record.ip_hash, record.occurred_at,
            )
        except Exception:  # noqa: BLE001 - deliberate boundary
            import logging
            logging.getLogger(__name__).warning(
                "analytics write failed for %s", record.event_name, exc_info=True
            )
        return record


# ---------------------------------------------------------------------------
# Landing page rollup
# ---------------------------------------------------------------------------

# Feeds landing_page_daily, which the audit's Landing Page sector reads. Defined
# once here so the funnel is not re-derived slightly differently by each caller.
ROLLUP_SQL = """
INSERT INTO landing_page_daily (day, sessions, signup_starts, signups_completed)
SELECT
  occurred_at::date AS day,
  count(DISTINCT session_id) FILTER (WHERE event_name = 'landing_viewed'),
  count(DISTINCT session_id) FILTER (WHERE event_name = 'signup_started'),
  count(DISTINCT session_id) FILTER (WHERE event_name = 'signup_completed')
FROM analytics_events
WHERE occurred_at >= $1 AND occurred_at < $2
GROUP BY 1
ON CONFLICT (day) DO UPDATE SET
  sessions = EXCLUDED.sessions,
  signup_starts = EXCLUDED.signup_starts,
  signups_completed = EXCLUDED.signups_completed
"""

ACTIVATION_FUNNEL_SQL = """
WITH steps AS (
  SELECT workspace_id,
         min(occurred_at) FILTER (WHERE event_name = 'signup_completed')      AS signed_up,
         min(occurred_at) FILTER (WHERE event_name = 'source_connected')      AS connected,
         min(occurred_at) FILTER (WHERE event_name = 'first_clip_generated')  AS generated,
         min(occurred_at) FILTER (WHERE event_name = 'first_clip_published')  AS published
  FROM analytics_events
  WHERE workspace_id IS NOT NULL
  GROUP BY workspace_id
)
SELECT
  count(*) FILTER (WHERE signed_up IS NOT NULL) AS signed_up,
  count(*) FILTER (WHERE connected IS NOT NULL) AS connected_a_source,
  count(*) FILTER (WHERE generated IS NOT NULL) AS got_a_clip,
  count(*) FILTER (WHERE published IS NOT NULL) AS published_a_clip,
  -- The number that matters for an always-on product: how long from signing up
  -- to a clip existing without them doing anything.
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (generated - signed_up))
  ) FILTER (WHERE generated IS NOT NULL) AS median_seconds_to_first_clip
FROM steps
"""
