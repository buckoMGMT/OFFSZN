"""`make audit` — print the readiness report.

Exit code is 0 whatever the score. This is a status report, not a gate; wiring
it to a non-zero exit creates pressure to inflate it, which is the one thing the
engine exists to prevent.

Runs over asyncpg when it is installed and falls back to psql otherwise, so
reading your own readiness never depends on a compiled driver being available.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys

from packages.audit.runner import REQUIREMENTS, AuditRunner


def _psql_path() -> str:
    """Absolute path to psql; a bare name is resolved through PATH at call time."""
    path = shutil.which("psql")
    if path is None:
        raise RuntimeError("psql not found on PATH")
    return path


class PsqlConnection:
    """Minimal read-only asyncpg-shaped adapter over the psql client.

    Read-only by construction: it exposes fetchval and fetchrow and nothing that
    writes, so the audit engine cannot modify the evidence it is scoring even by
    mistake.
    """

    def __init__(self, dsn: str):
        self.dsn = dsn

    def _run(self, sql: str, args: tuple) -> list[list[str]]:
        # Positional placeholders become psql variables rather than being
        # formatted into the SQL text. The audit's own arguments are literals
        # today, but the engine that judges the codebase does not get to be the
        # one place that builds SQL by string formatting.
        params = {}
        # Descending: replacing $1 before $10 would rewrite the $1 inside it and
        # leave a stray 0 in the SQL. Harmless today at one parameter, wrong the
        # first time a query takes ten.
        for i in range(len(args), 0, -1):
            params[f"p{i}"] = args[i - 1]
            sql = sql.replace(f"${i}", f":'p{i}'")

        cmd = [_psql_path(), self.dsn, "-X", "-q", "-A", "-t", "-F", "\x1f",
               "-v", "ON_ERROR_STOP=1"]
        for name, value in params.items():
            cmd += ["-v", f"{name}={value}"]
        # -f - rather than -c: psql only interpolates :'name' in input read from
        # a file or stdin, never in a -c command string.
        cmd += ["-f", "-"]

        proc = subprocess.run(cmd, input=sql, capture_output=True, text=True, timeout=60)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip())
        return [line.split("\x1f") for line in proc.stdout.strip().splitlines() if line]

    async def fetchval(self, sql: str, *args):
        rows = self._run(sql, args)
        if not rows or not rows[0]:
            return None
        value = rows[0][0]
        if value == "":
            return None
        if value in ("t", "f"):
            return value == "t"
        if value.startswith("{") and value.endswith("}"):   # text[]
            inner = value[1:-1]
            return [v.strip('"') for v in inner.split(",")] if inner else []
        try:
            return int(value)
        except ValueError:
            pass
        try:
            return float(value)
        except ValueError:
            return value

    async def fetchrow(self, sql: str, *args):
        """Returns a dict keyed by the column aliases in the query."""
        import re
        rows = self._run(sql, args)
        if not rows:
            return None
        select = re.split(r"\bFROM\b", sql, maxsplit=1, flags=re.I)[0]
        select = re.sub(r"^\s*SELECT\s+", "", select, flags=re.I | re.S)
        names, depth, current = [], 0, ""
        for ch in select:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            if ch == "," and depth == 0:
                names.append(current)
                current = ""
            else:
                current += ch
        names.append(current)

        keys = []
        for raw in names:
            token = raw.strip().split()[-1] if raw.strip() else ""
            keys.append(token.split(".")[-1].strip('"'))

        values = []
        for value in rows[0]:
            if value == "":
                values.append(None)
            elif value in ("t", "f"):
                values.append(value == "t")
            else:
                try:
                    values.append(int(value))
                except ValueError:
                    try:
                        values.append(float(value))
                    except ValueError:
                        values.append(value)
        return dict(zip(keys, values, strict=False))


async def connect(dsn: str):
    try:
        import asyncpg
    except ImportError:
        return PsqlConnection(dsn), None
    conn = await asyncpg.connect(dsn)
    return conn, conn


BAR_WIDTH = 24
GLYPH = {"verified": "██", "code_complete": "▓░", "insufficient_data": "░░",
         "not_started": "░░"}


def render(report: dict) -> str:
    lines = []
    width = max(len(s["sector"]) for s in report["sectors"])

    lines.append("")
    lines.append(f"{'SECTOR':<{width}}  {'SCORE':>5}  STATE")
    lines.append("-" * (width + 40))
    for s in report["sectors"]:
        filled = round(s["score"] / 10 * BAR_WIDTH)
        bar = "█" * filled + "·" * (BAR_WIDTH - filled)
        lines.append(f"{s['sector']:<{width}}  {s['score']:>2}/10  {bar}  {s['state']}")
        lines.append(f"{'':<{width}}         {s['evidence']}")
        if s["blocker"]:
            lines.append(f"{'':<{width}}         needs: {s['blocker']}")
        lines.append("")

    lines.append("-" * (width + 40))
    lines.append(f"weighted score      {report['weighted_score']} / 10")
    lines.append(f"verified sectors    {report['verified_sectors']} of {report['total_sectors']}")
    lines.append("")

    if report["remaining"]:
        lines.append("What the remaining points are waiting on, by who has to do it:")
        for actor, sectors in report["remaining_by_actor"].items():
            lines.append(f"  {actor}:")
            for sector in sectors:
                lines.append(f"    - {sector}: {REQUIREMENTS[sector][0]}")
        lines.append("")
        lines.append(
            f"Reachable by writing code: {report['points_reachable_by_engineering']} points. "
            f"The rest needs people, money, time or counsel."
        )
    return "\n".join(lines)


async def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Readiness report, computed from evidence.")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--dsn", default=os.environ.get("DATABASE_URL")
                        or os.environ.get("CLIPR_TEST_DSN"))
    args = parser.parse_args(argv)

    if not args.dsn:
        print("Set DATABASE_URL or CLIPR_TEST_DSN.", file=sys.stderr)
        return 2

    conn, closable = await connect(args.dsn)
    try:
        report = await AuditRunner(conn).run()
    finally:
        if closable is not None:
            await closable.close()

    print(json.dumps(report, indent=2) if args.json else render(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
