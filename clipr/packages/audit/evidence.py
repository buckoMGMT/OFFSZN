"""Evidence intake.

Four of the remaining audit sectors are gated on things a person does offline:
interviews, usability sessions, a penetration test, legal reviews. The work is
theirs. Recording it should not also be work, so this is one command per kind,
with validation strict enough that a hollow record is rejected at the door.

    python -m packages.audit.evidence interview --handle @someone --platform twitch \\
        --hours-per-week 22 --pays-for-clipping no --date 2026-08-14 \\
        --by "your name" --notes "..."

Every intake requires the artifact that makes the record checkable later: who
did it, when, and where the evidence lives. That is not bureaucracy. A row
without them is indistinguishable from one somebody typed to move a number, and
the whole point of the engine is that those two things must not look alike.

Nothing here can be run by the application role -- `0003_evidence.sql` revokes
its write access on all of these tables.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from datetime import date

URL = re.compile(r"^(https?://|file://|s3://|/)")


class Invalid(ValueError):
    pass


def _psql_path() -> str:
    path = shutil.which("psql")
    if path is None:
        raise RuntimeError("psql not found on PATH")
    return path


def execute(dsn: str, sql: str, **params) -> str:
    cmd = [_psql_path(), dsn, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"]
    for name, value in params.items():
        cmd += ["-v", f"{name}={value}"]
    cmd += ["-f", "-"]
    proc = subprocess.run(cmd, input=sql, capture_output=True, text=True, timeout=60)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip())
    return proc.stdout.strip()


def require_person(value: str, field: str) -> str:
    """A name, not a placeholder.

    "me", "test" and "n/a" are how an evidence table quietly fills with rows
    nobody can follow up on.
    """
    value = (value or "").strip()
    if len(value) < 3 or value.lower() in {"me", "n/a", "na", "test", "tbd", "-"}:
        raise Invalid(f"{field} needs a real name -- someone you could ask about this later.")
    return value


def require_artifact(value: str, field: str) -> str:
    value = (value or "").strip()
    if not URL.match(value):
        raise Invalid(
            f"{field} needs a link to the recording, notes or report "
            f"(https://, s3://, file:// or an absolute path). "
            f"Evidence you cannot open later is a claim, not evidence."
        )
    return value


def require_past_date(value: str, field: str) -> date:
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise Invalid(f"{field} must be YYYY-MM-DD.") from None
    if parsed > date.today():
        raise Invalid(f"{field} is in the future.")
    return parsed


# ---------------------------------------------------------------------------
# Intakes
# ---------------------------------------------------------------------------

def add_interview(dsn: str, args) -> str:
    require_person(args.by, "--by")
    when = require_past_date(args.date, "--date")
    if not args.handle.strip():
        raise Invalid("--handle is required; it is how you find this person again.")
    execute(dsn, """
        INSERT INTO interviews
          (subject_handle, platform, avg_stream_hours_per_week,
           currently_pays_for_clipping, notes, conducted_at, conducted_by)
        VALUES (:'handle', :'platform', NULLIF(:'hours','')::numeric,
                NULLIF(:'pays','')::boolean, :'notes', :'date'::date, :'by');
    """, handle=args.handle, platform=args.platform or "",
         hours=args.hours_per_week or "", pays=_tri(args.pays_for_clipping),
         notes=args.notes or "", date=when.isoformat(), by=args.by)
    return f"Interview with {args.handle} recorded."


def add_usability(dsn: str, args) -> str:
    require_person(args.by, "--by")
    require_artifact(args.observation, "--observation")
    when = require_past_date(args.date, "--date")
    execute(dsn, """
        INSERT INTO usability_sessions
          (participant_ref, task, completed_task, time_to_first_clip_seconds,
           blocking_issues, observation_url, conducted_by, conducted_at)
        VALUES (:'ref', :'task', :'completed'::boolean,
                NULLIF(:'ttfc','')::int, :'issues', :'obs', :'by', :'date'::date);
    """, ref=args.participant, task=args.task, completed=str(args.completed).lower(),
         ttfc=args.seconds_to_first_clip or "", issues=args.blocking_issues or "",
         obs=args.observation, by=args.by, date=when.isoformat())
    return f"Usability session with {args.participant} recorded."


def add_pentest(dsn: str, args) -> str:
    vendor = require_person(args.vendor, "--vendor")
    if vendor.lower() in {"us", "internal", "self", "ourselves", "clipr"}:
        raise Invalid(
            "An internal review is not an external assessment. Record it as a "
            "code_audit if you like, but it cannot verify the security sector."
        )
    require_artifact(args.report, "--report")
    when = require_past_date(args.date, "--date")
    execute(dsn, """
        INSERT INTO security_assessments
          (assessment_type, vendor, scope, report_url,
           critical_findings_open, high_findings_open, completed_at)
        VALUES (:'type', :'vendor', :'scope', :'report',
                :'crit'::int, :'high'::int, :'date'::date);
    """, type=args.type, vendor=vendor, scope=args.scope, report=args.report,
         crit=args.criticals_open, high=args.highs_open, date=when.isoformat())
    return f"{args.type} by {vendor} recorded."


def add_legal(dsn: str, args) -> str:
    counsel = require_person(args.counsel, "--counsel")
    require_artifact(args.document, "--document")
    when = require_past_date(args.date, "--date")
    execute(dsn, """
        INSERT INTO legal_reviews
          (review_type, counsel_name, firm, document_url, completed_at, expires_at)
        VALUES (:'type', :'counsel', NULLIF(:'firm',''), :'doc',
                :'date'::date, NULLIF(:'expires','')::date)
        ON CONFLICT (review_type) DO UPDATE SET
          counsel_name = EXCLUDED.counsel_name,
          firm = EXCLUDED.firm,
          document_url = EXCLUDED.document_url,
          completed_at = EXCLUDED.completed_at,
          expires_at = EXCLUDED.expires_at;
    """, type=args.type, counsel=counsel, firm=args.firm or "",
         doc=args.document, date=when.isoformat(), expires=args.expires or "")
    return f"{args.type} reviewed by {counsel} recorded."


def _tri(value: str | None) -> str:
    if value is None:
        return ""
    return {"yes": "true", "y": "true", "no": "false", "n": "false"}.get(
        value.strip().lower(), "")


# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="evidence", description=__doc__)
    parser.add_argument("--dsn", default=None)
    sub = parser.add_subparsers(dest="kind", required=True)

    p = sub.add_parser("interview", help="Record a creator interview")
    p.add_argument("--handle", required=True)
    p.add_argument("--platform", choices=["twitch", "youtube", "kick", "other"])
    p.add_argument("--hours-per-week")
    p.add_argument("--pays-for-clipping", choices=["yes", "no"])
    p.add_argument("--notes")
    p.add_argument("--date", required=True)
    p.add_argument("--by", required=True)
    p.set_defaults(handler=add_interview)

    p = sub.add_parser("usability", help="Record a watched usability session")
    p.add_argument("--participant", required=True)
    p.add_argument("--task", default="connect a channel and publish one clip")
    p.add_argument("--completed", action="store_true")
    p.add_argument("--seconds-to-first-clip")
    p.add_argument("--blocking-issues")
    p.add_argument("--observation", required=True, help="Link to the recording or notes")
    p.add_argument("--date", required=True)
    p.add_argument("--by", required=True)
    p.set_defaults(handler=add_usability)

    p = sub.add_parser("pentest", help="Record an external security assessment")
    p.add_argument("--type", default="penetration_test",
                   choices=["penetration_test", "code_audit", "soc2", "vuln_scan"])
    p.add_argument("--vendor", required=True)
    p.add_argument("--scope", required=True)
    p.add_argument("--report", required=True)
    p.add_argument("--criticals-open", type=int, default=0)
    p.add_argument("--highs-open", type=int, default=0)
    p.add_argument("--date", required=True)
    p.set_defaults(handler=add_pentest)

    p = sub.add_parser("legal", help="Record a completed legal review")
    p.add_argument("--type", required=True,
                   choices=["entity_formation", "ip_assignment", "terms_and_privacy",
                            "platform_tos", "incident_response"])
    p.add_argument("--counsel", required=True)
    p.add_argument("--firm")
    p.add_argument("--document", required=True)
    p.add_argument("--date", required=True)
    p.add_argument("--expires")
    p.set_defaults(handler=add_legal)

    return parser


def main(argv: list[str] | None = None) -> int:
    import os
    args = build_parser().parse_args(argv)
    dsn = args.dsn or os.environ.get("DATABASE_URL") or os.environ.get("CLIPR_TEST_DSN")
    if not dsn:
        print("Set DATABASE_URL or pass --dsn.", file=sys.stderr)
        return 2
    try:
        print(args.handler(dsn, args))
    except Invalid as exc:
        print(f"Rejected: {exc}", file=sys.stderr)
        return 1
    print("Run `make audit` to see what it moved.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
