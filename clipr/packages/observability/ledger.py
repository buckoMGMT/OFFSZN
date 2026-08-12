"""Cost ledger writers.

`cost.py` computes unit economics from `processing_costs`. Nothing wrote to it.
The reader was careful, the query was fixed, the margin model was tested -- and
the table was empty, so the whole AI Economics sector was blocked on a producer
that did not exist.

Every entry is attributed to a stream session, which is what makes "$ per
monitored hour" a single-table aggregate rather than a join that fans out. Each
recording function takes the physical quantity actually consumed -- GPU seconds,
tokens, bytes -- and converts through one price book, so re-pricing a provider
is one edit rather than a search for arithmetic scattered through the pipeline.

The price book is estimates until real invoices land. `reconcile()` exists for
that day: it compares the ledger against a real bill and reports the drift,
because a cost model that is never checked against an invoice is a guess wearing
a number.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import Protocol


class Category(StrEnum):
    STORAGE = "storage"
    BANDWIDTH = "bandwidth"
    TRANSCRIPTION = "transcription"
    LLM_INFERENCE = "llm_inference"
    VISION = "vision"
    RENDERING = "rendering"
    COMPUTE = "compute"
    API = "api"
    OTHER = "other"


@dataclass(frozen=True)
class PriceBook:
    """USD per unit. Matches CostModel in packages/billing/plans.py.

    tests/test_ledger.py asserts the two stay consistent -- the margin model and
    the ledger disagreeing is how you get a healthy-looking dashboard and an
    unhealthy bank balance.
    """
    gpu_second: float = 0.00022          # ~$0.80/hour, L4 class
    cpu_second: float = 0.00001          # ~$0.036/hour, small container
    llm_input_per_1k: float = 0.00015
    llm_output_per_1k: float = 0.0006
    storage_gb_month: float = 0.021
    egress_gb: float = 0.09
    api_call: float = 0.0


DEFAULT_PRICES = PriceBook()

INSERT_SQL = """
INSERT INTO processing_costs
  (workspace_id, stream_session_id, job_id, clip_id, cost_category,
   amount_usd, units, unit_name, detail, incurred_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::timestamptz)
"""


class Db(Protocol):
    async def execute(self, sql: str, *args): ...
    async def fetch(self, sql: str, *args): ...


@dataclass
class Entry:
    category: Category
    amount_usd: float
    units: float
    unit_name: str
    detail: dict


class Ledger:
    def __init__(self, db: Db, prices: PriceBook = DEFAULT_PRICES):
        self.db = db
        self.prices = prices

    async def _write(
        self, entry: Entry, *, workspace_id: str,
        stream_session_id: str | None = None,
        job_id: str | None = None, clip_id: str | None = None,
    ) -> Entry:
        import json
        if entry.amount_usd < 0:
            raise ValueError("cost entries are never negative; use a credit category")
        await self.db.execute(
            INSERT_SQL, workspace_id, stream_session_id, job_id, clip_id,
            str(entry.category), round(entry.amount_usd, 6), entry.units,
            entry.unit_name, json.dumps(entry.detail),
            datetime.now(UTC).isoformat(),
        )
        return entry

    # -- the pipeline's cost surface --------------------------------------

    async def watch(self, *, workspace_id: str, stream_session_id: str,
                    cpu_seconds: float) -> Entry:
        """The always-on watcher. Charged even when a stream produces no clips,
        because it costs us either way -- and pretending otherwise is how a
        monitored-hour price ends up too low."""
        return await self._write(
            Entry(Category.COMPUTE, cpu_seconds * self.prices.cpu_second,
                  cpu_seconds, "cpu_second", {"stage": "watch"}),
            workspace_id=workspace_id, stream_session_id=stream_session_id)

    async def transcribe(self, *, workspace_id: str, stream_session_id: str,
                         job_id: str | None, audio_seconds: float,
                         gpu_seconds: float) -> Entry:
        return await self._write(
            Entry(Category.TRANSCRIPTION, gpu_seconds * self.prices.gpu_second,
                  audio_seconds, "audio_second",
                  {"gpu_seconds": gpu_seconds,
                   "realtime_factor": round(audio_seconds / gpu_seconds, 2)
                   if gpu_seconds else None}),
            workspace_id=workspace_id, stream_session_id=stream_session_id, job_id=job_id)

    async def rank(self, *, workspace_id: str, stream_session_id: str,
                   job_id: str | None, input_tokens: int, output_tokens: int,
                   model: str) -> Entry:
        amount = (input_tokens / 1000 * self.prices.llm_input_per_1k
                  + output_tokens / 1000 * self.prices.llm_output_per_1k)
        return await self._write(
            Entry(Category.LLM_INFERENCE, amount, input_tokens + output_tokens, "token",
                  {"model": model, "input_tokens": input_tokens,
                   "output_tokens": output_tokens}),
            workspace_id=workspace_id, stream_session_id=stream_session_id, job_id=job_id)

    async def render(self, *, workspace_id: str, stream_session_id: str,
                     clip_id: str, gpu_seconds: float, output_bytes: int) -> Entry:
        return await self._write(
            Entry(Category.RENDERING, gpu_seconds * self.prices.gpu_second,
                  gpu_seconds, "gpu_second",
                  {"output_mb": round(output_bytes / 1e6, 2)}),
            workspace_id=workspace_id, stream_session_id=stream_session_id, clip_id=clip_id)

    async def publish(self, *, workspace_id: str, clip_id: str,
                      bytes_out: int, destinations: int) -> Entry:
        gb = bytes_out * destinations / 1e9
        return await self._write(
            Entry(Category.BANDWIDTH, gb * self.prices.egress_gb, gb, "gb",
                  {"destinations": destinations}),
            workspace_id=workspace_id, clip_id=clip_id)

    async def store(self, *, workspace_id: str, gb_months: float) -> Entry:
        return await self._write(
            Entry(Category.STORAGE, gb_months * self.prices.storage_gb_month,
                  gb_months, "gb_month", {}),
            workspace_id=workspace_id)

    # -- reconciliation ----------------------------------------------------

    async def reconcile(self, *, invoice_total_usd: float, since: datetime) -> dict:
        """Compare the ledger to a real invoice.

        The ledger is only as good as its price book, and a price book nobody
        checks against a bill is a guess wearing a number. Run this monthly. A
        drift over ~10% means the model is wrong, and the plan allowances that
        were derived from it are wrong too.
        """
        rows = await self.db.fetch(
            "SELECT cost_category, SUM(amount_usd) AS total FROM processing_costs "
            "WHERE incurred_at >= $1 GROUP BY cost_category", since)
        ledger_total = sum(float(r["total"] or 0) for r in rows)
        drift = (ledger_total - invoice_total_usd) / invoice_total_usd if invoice_total_usd else None
        return {
            "ledger_total_usd": round(ledger_total, 2),
            "invoice_total_usd": round(invoice_total_usd, 2),
            "drift": round(drift, 4) if drift is not None else None,
            "by_category": {r["cost_category"]: round(float(r["total"] or 0), 2)
                            for r in rows},
            "verdict": (
                "unmeasurable" if drift is None else
                "price book is close enough" if abs(drift) <= 0.10 else
                "price book is wrong; the plan allowances derived from it need re-checking"
            ),
        }
