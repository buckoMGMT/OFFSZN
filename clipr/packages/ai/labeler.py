"""Labeling tool for building a real eval dataset.

AI Quality is the largest single blocker on the audit (0.15 weight, currently 6
of 10) and the requirement is 50+ moments labeled from real streams. That is
labeling work, not engineering work -- but how long the labeling takes is an
engineering decision, and unassisted it is a week of scrubbing timelines.

This makes it an afternoon. The cascade proposes candidates from signals that
cost nothing (chat velocity, viewer clip presses, audio level), a human accepts
or rejects each one, and the accepted spans become the dataset the harness
scores against.

The bias this introduces is real and is handled explicitly: labeling only what
the detector already proposed measures precision honestly but inflates recall,
because moments the detector never surfaced can never be labeled. `--blind`
mixes in random spans so misses are visible, and any dataset built without it is
marked `recall_biased` so the harness reports recall as unmeasured rather than
as a good number nobody should trust.

    python -m packages.ai.labeler propose --vod vod.json --out session.json
    python -m packages.ai.labeler review session.json
    python -m packages.ai.labeler export session.json --out tests/ai/datasets/real.jsonl
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

from packages.ai.detector import MomentDetector

# Random spans mixed in so the labeler sees moments the detector missed.
# Without them recall is measured only over what the detector already found,
# which is circular.
BLIND_FRACTION = 0.25
CONTEXT_SECONDS = 8


@dataclass
class Candidate:
    index: int
    start: float
    end: float
    source: str            # 'detector' or 'blind'
    score: float | None
    reasons: list[str] = field(default_factory=list)
    transcript: str = ""
    # Filled in by review
    verdict: str | None = None      # 'good' | 'bad' | 'skip'
    category: str | None = None
    adjusted_start: float | None = None
    adjusted_end: float | None = None

    @property
    def final_span(self) -> tuple[float, float]:
        return (self.adjusted_start if self.adjusted_start is not None else self.start,
                self.adjusted_end if self.adjusted_end is not None else self.end)


@dataclass
class Session:
    vod_id: str
    media_path: str
    duration_seconds: float
    blind: bool
    candidates: list[Candidate]
    transcript: list[dict] = field(default_factory=list)
    chat_events: list[dict] = field(default_factory=list)

    @property
    def reviewed(self) -> list[Candidate]:
        return [c for c in self.candidates if c.verdict]

    @property
    def accepted(self) -> list[Candidate]:
        return [c for c in self.candidates if c.verdict == "good"]


def load_vod(path: Path) -> dict:
    """A VOD descriptor: what an ingest job would produce.

    {"vod_id", "media_path", "duration_seconds", "transcript": [...],
     "chat_events": [{"t": 12.3}], "native_clip_events": [45.0]}
    """
    data = json.loads(path.read_text())
    for required in ("vod_id", "duration_seconds"):
        if required not in data:
            raise ValueError(f"{path} is missing {required!r}")
    return data


def propose(vod: dict, *, blind: bool, seed: int = 0) -> Session:
    detector = MomentDetector(loudness_provider=lambda _: [])
    result = detector.detect(
        vod.get("media_path", ""),
        duration_seconds=vod["duration_seconds"],
        transcript=vod.get("transcript"),
        chat_events=vod.get("chat_events"),
        native_clip_events=vod.get("native_clip_events"),
    )

    candidates = [
        Candidate(index=i, start=m.start, end=m.end, source="detector",
                  score=m.score, reasons=m.reasons)
        for i, m in enumerate(result.moments)
    ]

    if blind:
        rng = random.Random(seed)  # nosec B311
        proposed = {(round(c.start), round(c.end)) for c in candidates}
        wanted = max(1, int(len(candidates) * BLIND_FRACTION / (1 - BLIND_FRACTION)))
        # Count what has been added rather than deriving it from the span set,
        # which grows with every insert -- the difference never reaches `wanted`
        # and the loop only stops when it runs out of attempts.
        added = attempts = 0
        while added < wanted and attempts < wanted * 20:
            attempts += 1
            start = rng.uniform(0, max(1.0, vod["duration_seconds"] - 45))
            span = (round(start), round(start + 45))
            if span in proposed:
                continue
            proposed.add(span)
            candidates.append(Candidate(index=len(candidates), start=start,
                                        end=start + 45, source="blind", score=None))
            added += 1
        rng.shuffle(candidates)
        for i, c in enumerate(candidates):
            c.index = i

    session = Session(
        vod_id=vod["vod_id"], media_path=vod.get("media_path", ""),
        duration_seconds=vod["duration_seconds"], blind=blind,
        candidates=candidates, transcript=vod.get("transcript", []),
        chat_events=vod.get("chat_events", []),
    )
    attach_transcript(session)
    return session


def attach_transcript(session: Session) -> None:
    for c in session.candidates:
        lo, hi = c.start - CONTEXT_SECONDS, c.end + CONTEXT_SECONDS
        c.transcript = " ".join(
            seg.get("text", "") for seg in session.transcript
            if seg.get("start", 0) < hi and seg.get("end", 0) > lo
        ).strip()


def save(session: Session, path: Path) -> None:
    path.write_text(json.dumps(asdict(session), indent=2))


def load_session(path: Path) -> Session:
    raw = json.loads(path.read_text())
    raw["candidates"] = [Candidate(**c) for c in raw["candidates"]]
    return Session(**raw)


def review(session: Session, path: Path) -> None:
    """Walk the unreviewed candidates.

    The source of each candidate is deliberately hidden. A labeler who knows the
    detector proposed something is measurably more likely to accept it, and that
    bias lands directly in the number the deploy gate reads.
    """
    pending = [c for c in session.candidates if not c.verdict]
    if not pending:
        print("Everything reviewed. Export with: labeler export")
        return

    print(f"{len(pending)} to review. g=good  b=bad  s=skip  q=save and quit")
    print("After 'g' you can type a category, and start,end to tighten the span.\n")

    for n, c in enumerate(pending, start=1):
        span = f"{c.start:>8.1f} - {c.end:<8.1f}"
        print(f"[{n}/{len(pending)}] {span} ({c.end - c.start:.0f}s)")
        if c.transcript:
            print(f"  transcript: {c.transcript[:300]}")
        else:
            print("  transcript: (none)")

        answer = input("  verdict> ").strip().lower()
        if answer.startswith("q"):
            break
        if answer.startswith("g"):
            c.verdict = "good"
            c.category = input("  category (reaction/skill/bit/story/other)> ").strip() or "other"
            tighten = input(f"  span [{c.start:.1f},{c.end:.1f}]> ").strip()
            if "," in tighten:
                try:
                    a, b = (float(x) for x in tighten.split(",", 1))
                    if b > a:
                        c.adjusted_start, c.adjusted_end = a, b
                except ValueError:
                    print("  (unparseable, keeping the original span)")
        elif answer.startswith("b"):
            c.verdict = "bad"
        else:
            c.verdict = "skip"
        save(session, path)
        print()

    save(session, path)
    print(f"Saved. {len(session.accepted)} accepted of {len(session.reviewed)} reviewed.")


def export(sessions: list[Session]) -> dict:
    """Turn reviewed sessions into a dataset line plus a provenance summary."""
    lines, accepted, reviewed = [], 0, 0
    any_blind = all(s.blind for s in sessions) if sessions else False

    for s in sessions:
        labels = [
            {"start": round(c.final_span[0], 2), "end": round(c.final_span[1], 2),
             "category": c.category or "other"}
            for c in s.accepted
        ]
        accepted += len(labels)
        reviewed += len(s.reviewed)
        lines.append({
            "vod_id": s.vod_id,
            "media_path": s.media_path,
            "duration_seconds": s.duration_seconds,
            "transcript": s.transcript,
            "chat_events": s.chat_events,
            "labels": labels,
            # Not synthetic: these came off a real stream. But if the labeler
            # only ever saw detector proposals, recall is measured over what the
            # detector already found, so the harness must not report it as if it
            # were a real recall number.
            "recall_biased": not s.blind,
        })

    return {
        "lines": lines,
        "labeled_moments": accepted,
        "reviewed": reviewed,
        "blind_sampled": any_blind,
        "ready_for_gate": accepted >= 50 and any_blind,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("propose", help="Build a review session from a VOD")
    p.add_argument("--vod", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--no-blind", action="store_true",
                   help="Skip random spans. Makes recall unmeasurable.")
    p.add_argument("--seed", type=int, default=0)

    p = sub.add_parser("review", help="Label the candidates")
    p.add_argument("session", type=Path)

    p = sub.add_parser("export", help="Write a dataset from reviewed sessions")
    p.add_argument("sessions", type=Path, nargs="+")
    p.add_argument("--out", type=Path, required=True)

    args = parser.parse_args(argv)

    if args.command == "propose":
        session = propose(load_vod(args.vod), blind=not args.no_blind, seed=args.seed)
        save(session, args.out)
        detector_n = sum(1 for c in session.candidates if c.source == "detector")
        blind_n = len(session.candidates) - detector_n
        print(f"{len(session.candidates)} candidates "
              f"({detector_n} proposed, {blind_n} blind) -> {args.out}")
        if args.no_blind:
            print("No blind spans: recall will be reported as unmeasured.")
        return 0

    if args.command == "review":
        session = load_session(args.session)
        review(session, args.session)
        return 0

    result = export([load_session(p) for p in args.sessions])
    args.out.write_text("\n".join(json.dumps(line) for line in result["lines"]) + "\n")
    print(f"{result['labeled_moments']} labeled moments from {result['reviewed']} reviewed "
          f"-> {args.out}")
    if not result["ready_for_gate"]:
        need = max(0, 50 - result["labeled_moments"])
        why = []
        if need:
            why.append(f"{need} more labeled moments")
        if not result["blind_sampled"]:
            why.append("at least one blind-sampled session")
        print(f"Not yet enough to gate on: {', and '.join(why)}.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
