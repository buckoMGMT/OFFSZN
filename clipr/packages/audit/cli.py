"""`make audit` — print the readiness report.

Exit code is 0 whatever the score. This is a status report, not a gate; wiring
it to a non-zero exit would create pressure to inflate it.
"""
import asyncio
import json
import os
import sys

from packages.audit.runner import AuditRunner


async def main() -> int:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL is not set.", file=sys.stderr)
        return 2
    import asyncpg
    conn = await asyncpg.connect(dsn)
    try:
        print(json.dumps(await AuditRunner(conn).run(), indent=2))
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
