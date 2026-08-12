"""The machinery for acquiring the evidence the audit is waiting on.

None of this can produce evidence. What it can do is make recording real
evidence cheap, and make recording fake evidence obviously fake -- which is the
only honest way to move a readiness score.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from packages.ai import labeler
from packages.analytics.events import (
    ANONYMOUS_ALLOWED,
    Analytics,
    Attribution,
    Event,
    UnknownEvent,
    hash_ip,
)
from packages.audit.evidence import (
    Invalid,
    require_artifact,
    require_past_date,
    require_person,
)
from packages.billing.plans import DEFAULT_COST_MODEL
from packages.observability.ledger import DEFAULT_PRICES, Category, Ledger


def run(coro):
    return asyncio.run(coro)


class RecordingSink:
    def __init__(self, fail=False):
        self.rows: list[tuple] = []
        self.fail = fail

    async def execute(self, sql, *args):
        if self.fail:
            raise RuntimeError("warehouse is down")
        self.rows.append(args)

    async def fetch(self, sql, *args):
        return [{"cost_category": "rendering", "total": 12.0}]


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

def test_the_taxonomy_is_rich_enough_to_be_a_funnel():
    """The audit wants 20+ event types, as a proxy for the funnel actually
    being instrumented rather than one page-view event firing a lot."""
    assert len(Event) >= 20


def test_unknown_event_names_are_refused():
    """Four spellings of one event is how a funnel silently under-counts."""
    with pytest.raises(UnknownEvent, match="not in the taxonomy"):
        Analytics(RecordingSink()).build("clipApproved", workspace_id="ws")


def test_identified_events_require_a_workspace():
    with pytest.raises(ValueError, match="requires a workspace"):
        Analytics(RecordingSink()).build(Event.CLIP_PUBLISHED, anonymous_id="anon")


def test_pre_signup_events_may_be_anonymous():
    record = Analytics(RecordingSink()).build(Event.LANDING_VIEWED, anonymous_id="anon")
    assert record.workspace_id is None


def test_every_anonymous_allowed_event_happens_before_an_account_exists():
    identified = {Event.CLIP_PUBLISHED, Event.SUBSCRIPTION_ACTIVATED,
                  Event.STREAM_MONITOR_STARTED}
    assert not (ANONYMOUS_ALLOWED & identified)


def test_an_event_with_no_identity_at_all_is_refused():
    with pytest.raises(ValueError, match="anonymous id"):
        Analytics(RecordingSink()).build(Event.LANDING_VIEWED)


@pytest.mark.parametrize("field", ["email", "access_token", "phone", "card"])
def test_secrets_and_pii_are_refused_at_the_warehouse_door(field):
    """Analytics is the database everyone eventually gets read access to."""
    with pytest.raises(ValueError, match="Refusing to write"):
        Analytics(RecordingSink()).build(
            Event.SIGNUP_COMPLETED, workspace_id="ws", properties={field: "x"})


def test_ip_addresses_are_hashed_not_stored():
    record = Analytics(RecordingSink(), ip_salt="s").build(
        Event.LANDING_VIEWED, anonymous_id="a", ip="203.0.113.9")
    assert record.ip_hash and "203.0.113" not in record.ip_hash


def test_the_same_address_hashes_consistently_and_the_salt_changes_it():
    assert hash_ip("1.2.3.4", "salt") == hash_ip("1.2.3.4", "salt")
    assert hash_ip("1.2.3.4", "salt") != hash_ip("1.2.3.4", "other")
    assert hash_ip(None, "salt") is None


def test_a_failing_warehouse_does_not_break_the_product():
    """Losing a funnel row is survivable. Failing a creator's publish because a
    metrics insert timed out is not."""
    record = run(Analytics(RecordingSink(fail=True)).emit(
        Event.CLIP_PUBLISHED, workspace_id="ws"))
    assert record.event_name == "clip_published"


def test_attribution_is_carried_through():
    sink = RecordingSink()
    run(Analytics(sink).emit(Event.LANDING_VIEWED, anonymous_id="a",
                             attribution=Attribution(utm_source="reddit")))
    assert "reddit" in sink.rows[0]


# ---------------------------------------------------------------------------
# Cost ledger
# ---------------------------------------------------------------------------

def test_the_ledger_writes_what_the_reader_reads():
    """cost.py computed unit economics from a table nothing wrote to."""
    sink = RecordingSink()
    run(Ledger(sink).watch(workspace_id="ws", stream_session_id="s", cpu_seconds=3600))
    assert sink.rows and sink.rows[0][0] == "ws"
    assert str(Category.COMPUTE) in sink.rows[0]


def test_cost_is_derived_from_physical_units():
    sink = RecordingSink()
    entry = run(Ledger(sink).render(workspace_id="ws", stream_session_id="s",
                                    clip_id="c", gpu_seconds=15, output_bytes=15_000_000))
    assert entry.amount_usd == pytest.approx(15 * DEFAULT_PRICES.gpu_second)
    assert entry.unit_name == "gpu_second"


def test_negative_costs_are_refused():
    with pytest.raises(ValueError, match="never negative"):
        run(Ledger(RecordingSink())._write(
            __import__("packages.observability.ledger", fromlist=["Entry"]).Entry(
                Category.OTHER, -1.0, 1, "unit", {}), workspace_id="ws"))


def test_the_ledger_and_the_margin_model_agree_on_storage():
    """The margin model and the ledger disagreeing is how you get a healthy
    dashboard and an unhealthy bank balance."""
    assert DEFAULT_PRICES.storage_gb_month == DEFAULT_COST_MODEL.storage_per_gb_month


def test_transcription_records_its_realtime_factor():
    """The number that decides whether self-hosted ASR is actually cheaper."""
    sink = RecordingSink()
    entry = run(Ledger(sink).transcribe(workspace_id="ws", stream_session_id="s",
                                        job_id="j", audio_seconds=3600, gpu_seconds=144))
    assert entry.detail["realtime_factor"] == pytest.approx(25.0)


def test_reconciliation_calls_out_a_wrong_price_book():
    result = run(Ledger(RecordingSink()).reconcile(
        invoice_total_usd=100.0, since=__import__("datetime").datetime.now()))
    assert result["drift"] == pytest.approx(-0.88)
    assert "price book is wrong" in result["verdict"]


def test_reconciliation_accepts_a_close_enough_model():
    result = run(Ledger(RecordingSink()).reconcile(
        invoice_total_usd=12.5, since=__import__("datetime").datetime.now()))
    assert "close enough" in result["verdict"]


# ---------------------------------------------------------------------------
# Labeler
# ---------------------------------------------------------------------------

@pytest.fixture
def vod(tmp_path) -> Path:
    path = tmp_path / "vod.json"
    path.write_text(json.dumps({
        "vod_id": "v1", "media_path": "", "duration_seconds": 900,
        "transcript": [{"start": 300, "end": 330, "text": "no way he hit that"}],
        "chat_events": [{"t": 300 + i * 0.05} for i in range(200)]
                       + [{"t": 10.0}, {"t": 600.0}],
    }))
    return path


def test_proposals_come_from_the_cascade(vod):
    session = labeler.propose(labeler.load_vod(vod), blind=False)
    assert any(c.source == "detector" for c in session.candidates)
    assert all(c.transcript is not None for c in session.candidates)


def test_blind_spans_are_a_minority_not_a_flood(vod):
    """The generator compared a count against a set that grows as it inserts, so
    the difference never reached the target and it added spans until it ran out
    of attempts -- 20 blind candidates for 2 real ones."""
    session = labeler.propose(labeler.load_vod(vod), blind=True, seed=7)
    blind = sum(1 for c in session.candidates if c.source == "blind")
    detector = len(session.candidates) - blind
    assert 0 < blind <= max(1, detector)


def test_a_dataset_without_blind_sampling_is_marked_recall_biased(vod):
    """Labeling only what the detector proposed measures precision honestly and
    inflates recall, because a miss can never be labeled."""
    session = labeler.propose(labeler.load_vod(vod), blind=False)
    for c in session.candidates:
        c.verdict, c.category = "good", "reaction"
    assert labeler.export([session])["lines"][0]["recall_biased"] is True


def test_a_blind_sampled_dataset_is_not_recall_biased(vod):
    session = labeler.propose(labeler.load_vod(vod), blind=True, seed=1)
    for c in session.candidates:
        c.verdict, c.category = "good", "reaction"
    assert labeler.export([session])["lines"][0]["recall_biased"] is False


def test_exported_labels_are_not_marked_synthetic(vod):
    """These came off a real stream. The synthetic flag is for fixtures, and
    conflating the two would make real labeling worthless to the gate."""
    session = labeler.propose(labeler.load_vod(vod), blind=True, seed=1)
    for c in session.candidates:
        c.verdict, c.category = "good", "reaction"
    assert "synthetic" not in labeler.export([session])["lines"][0]


def test_a_small_dataset_is_not_ready_to_gate(vod):
    session = labeler.propose(labeler.load_vod(vod), blind=True, seed=1)
    for c in session.candidates:
        c.verdict, c.category = "good", "reaction"
    assert labeler.export([session])["ready_for_gate"] is False


def test_span_adjustments_win_over_the_proposal(vod):
    session = labeler.propose(labeler.load_vod(vod), blind=False)
    c = session.candidates[0]
    c.verdict, c.category = "good", "reaction"
    c.adjusted_start, c.adjusted_end = 111.0, 155.0
    label = labeler.export([session])["lines"][0]["labels"][0]
    assert (label["start"], label["end"]) == (111.0, 155.0)


def test_rejected_candidates_do_not_become_labels(vod):
    session = labeler.propose(labeler.load_vod(vod), blind=False)
    for c in session.candidates:
        c.verdict = "bad"
    assert labeler.export([session])["labeled_moments"] == 0


# ---------------------------------------------------------------------------
# Evidence intake validation
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("name", ["me", "n/a", "test", "tbd", "-", ""])
def test_placeholder_names_are_rejected(name):
    """A row nobody can follow up on is indistinguishable from one typed to move
    a number."""
    with pytest.raises(Invalid, match="real name"):
        require_person(name, "--by")


def test_a_real_name_passes():
    assert require_person("Sam Rivera", "--by") == "Sam Rivera"


@pytest.mark.parametrize("artifact", ["notes", "see slack", "", "later"])
def test_evidence_without_a_link_is_rejected(artifact):
    with pytest.raises(Invalid, match="link to the recording"):
        require_artifact(artifact, "--observation")


@pytest.mark.parametrize("artifact", [
    "https://drive.example/rec/1", "s3://bucket/session.mp4", "/srv/notes/p1.md",
])
def test_a_real_artifact_passes(artifact):
    assert require_artifact(artifact, "--observation") == artifact


def test_future_dated_evidence_is_rejected():
    with pytest.raises(Invalid, match="future"):
        require_past_date("2099-01-01", "--date")


def test_malformed_dates_are_rejected():
    with pytest.raises(Invalid, match="YYYY-MM-DD"):
        require_past_date("last tuesday", "--date")
