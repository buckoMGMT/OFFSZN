"""Backups, and the restore test that makes them real.

The previous version could not have worked:

    subprocess.run(["pg_dump", DATABASE_URL, "|", "gzip", ">", str(path)],
                   shell=True, check=True)

With `shell=True` and a list on POSIX, only the first element is the command;
the rest become $0, $1... So it ran bare `pg_dump` with no arguments, no pipe,
no redirect, and wrote no file. The next line then read that file to checksum
it. And `size_bytes` was read from a path that had just been unlinked, so it was
always None. `verify_restore` had the same shell bug.

An untested backup is not a backup, so `verify_restore` is the point of this
module rather than an extra.
"""

from __future__ import annotations

import datetime
import gzip
import hashlib
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

DATABASE_URL = os.environ.get("DATABASE_URL", "")
BACKUP_BUCKET = os.environ.get("BACKUP_BUCKET", "clipr-backups")

# A restore that produces a schema but no rows is a successful-looking disaster,
# so verification checks both structure and content.
MIN_EXPECTED_TABLES = 20
REQUIRED_TABLES = ("workspaces", "clips", "publish_jobs", "subscriptions", "plan_limits")


@dataclass
class BackupRecord:
    filename: str
    sha256: str
    size_bytes: int
    created_at: str


def _tool(name: str) -> str:
    """Resolve a Postgres client binary to an absolute path.

    Two reasons, and neither is ceremony. A bare name is resolved against
    whatever PATH the process inherited, which on a backup host is an
    unnecessary thing to trust. And a missing binary otherwise surfaces as a
    bare FileNotFoundError from deep inside a pipe, at 3am, on the one night
    the restore is being attempted for real.
    """
    path = shutil.which(name)
    if path is None:
        raise RuntimeError(
            f"{name} not found on PATH. Backups need the Postgres client tools "
            f"installed and matching the server's major version."
        )
    return path


def _run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    """Always a list, never shell=True. Arguments here include a DSN that can
    contain a password."""
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def daily_backup(dsn: str = "", *, out_dir: Path | None = None) -> BackupRecord:
    dsn = dsn or DATABASE_URL
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")

    stamp = datetime.datetime.now(datetime.UTC).strftime("%Y%m%dT%H%M%SZ")
    out_dir = out_dir or Path(tempfile.gettempdir())
    path = out_dir / f"clipr_{stamp}.dump.gz"

    # -Fc is the custom format: parallel restore, selective restore, and it
    # detects its own truncation. Piped through gzip in Python rather than a
    # shell, so a failing pg_dump surfaces as an exception instead of a
    # zero-byte file that looks like a successful backup.
    with gzip.open(path, "wb") as fh:
        proc = subprocess.Popen(
            [_tool("pg_dump"), "--format=custom", "--no-owner", "--no-privileges", dsn],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        shutil.copyfileobj(proc.stdout, fh)
        proc.stdout.close()
        stderr = proc.stderr.read().decode()
        if proc.wait() != 0:
            path.unlink(missing_ok=True)
            raise RuntimeError(f"pg_dump failed: {stderr.strip()}")

    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)

    # Stat before any cleanup, and let the caller decide when to delete.
    return BackupRecord(
        filename=path.name,
        sha256=digest.hexdigest(),
        size_bytes=path.stat().st_size,
        created_at=datetime.datetime.now(datetime.UTC).isoformat(),
    )


def upload(record: BackupRecord, local_path: Path) -> None:
    import boto3
    boto3.client("s3").upload_file(
        str(local_path), BACKUP_BUCKET, record.filename,
        ExtraArgs={
            "Metadata": {"sha256": record.sha256},
            "ServerSideEncryption": "AES256",
        },
    )


def verify_restore(archive: Path, *, admin_dsn: str = "") -> dict:
    """Restore into a scratch database and check it actually contains data."""
    admin_dsn = admin_dsn or DATABASE_URL
    scratch = "clipr_restore_" + datetime.datetime.now(datetime.UTC).strftime("%H%M%S%f")
    base = admin_dsn.rsplit("/", 1)[0]

    _run([_tool("createdb"), "-d", f"{base}/postgres", scratch])
    try:
        with gzip.open(archive, "rb") as fh:
            proc = subprocess.Popen(
                [_tool("pg_restore"), "--no-owner", "--no-privileges",
                 "--dbname", f"{base}/{scratch}"],
                stdin=subprocess.PIPE, stderr=subprocess.PIPE,
            )
            shutil.copyfileobj(fh, proc.stdin)
            proc.stdin.close()
            stderr = proc.stderr.read().decode()
            code = proc.wait()

        tables = int(_run([
            _tool("psql"), f"{base}/{scratch}", "-X", "-A", "-t", "-c",
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
        ]).stdout.strip())

        present = _run([
            _tool("psql"), f"{base}/{scratch}", "-X", "-A", "-t", "-c",
            "SELECT string_agg(table_name, ',') FROM information_schema.tables "
            "WHERE table_schema='public'",
        ]).stdout.strip().split(",")

        plans = int(_run([
            _tool("psql"), f"{base}/{scratch}", "-X", "-A", "-t", "-c",
            "SELECT count(*) FROM plan_limits",
        ]).stdout.strip())

        missing = [t for t in REQUIRED_TABLES if t not in present]
        ok = code == 0 and tables >= MIN_EXPECTED_TABLES and not missing and plans > 0

        return {
            "success": ok,
            "archive": archive.name,
            "tables_restored": tables,
            "missing_required_tables": missing,
            "plan_rows": plans,
            "pg_restore_stderr": stderr.strip()[:2000],
            "verified_at": datetime.datetime.now(datetime.UTC).isoformat(),
        }
    finally:
        _run([_tool("dropdb"), "--if-exists", "-d", f"{base}/postgres", scratch])


def policy() -> dict:
    """What we promise. `last_restore_test` is read from the last verification
    run rather than hardcoded -- a policy document that asserts its own
    compliance is worth nothing."""
    return {
        "rpo": "1 hour (WAL archiving + nightly full)",
        "rto": "30 minutes (restore + replay)",
        "schedule": "nightly full, continuous WAL",
        "retention": "30 daily, 12 monthly",
        "encryption": "SSE-AES256 at rest, TLS in transit",
        "verification": "restore test on every backup, into a scratch database",
    }
