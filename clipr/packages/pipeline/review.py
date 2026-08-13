"""The review queue: the only place a Publishable Rate can come from.

    python -m packages.pipeline.review --dir demo_output

Prints each clip with the score, the dimension breakdown and the reason it was
chosen, then records keep/reject and *why*. The rate tells you something is
wrong; the reasons tell you what — "bad crop" and "missing context" send you to
completely different parts of the codebase.

This is the loop that makes the product better over time, and it is the one
thing no amount of engineering can substitute for. Everything upstream of it is
a guess until a creator says yes or no.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from packages.ai.clip_eval import band, record_review

REASONS = {
    "1": "too long",
    "2": "too short",
    "3": "bad moment",
    "4": "bad crop",
    "5": "bad captions",
    "6": "missing context",
    "7": "duplicate",
    "8": "not my style",
}


def show(clip: dict, index: int, total: int) -> None:
    print("\n" + "=" * 74)
    print(f"CLIP {index} of {total}   —   clip_score {clip.get('clip_score', '?')}/100")
    print("=" * 74)
    print(f"  {clip['start']}s → {clip['end']}s "
          f"({clip['end'] - clip['start']:.0f}s)   {clip.get('strategy', '')}")
    print(f"  {clip['path']}")

    dims = clip.get("dimensions", {})
    if dims:
        print("\n  Score breakdown")
        for name, value in sorted(dims.items(), key=lambda kv: -kv[1]):
            bar = "#" * int(value / 5)
            print(f"    {name:<13} {value:>5.0f}  {bar}")

    why = clip.get("why", {})
    if why:
        print("\n  Why ClipR picked it")
        for name, note in why.items():
            if note:
                print(f"    {name:<13} {note}")

    notes = clip.get("boundary_notes", [])
    if notes:
        print("\n  Where it cut")
        for note in notes:
            print(f"    - {note}")

    hook = (clip.get("hook_text") or "").strip()
    if hook:
        print(f"\n  Opens with: \"{hook[:70]}\"")


def ask(clip_name: str, interactive: bool) -> dict:
    if not interactive:
        return {"clip": clip_name, "verdict": "unreviewed", "reasons": []}

    print("\n  [p] post   [m] maybe   [r] reject   [s] skip")
    verdict_key = input("  verdict > ").strip().lower()[:1]
    verdict = {"p": "post", "m": "maybe", "r": "reject"}.get(verdict_key)
    if verdict is None:
        return {"clip": clip_name, "verdict": "unreviewed", "reasons": []}

    reasons: list[str] = []
    if verdict != "post":
        print("  why? " + "  ".join(f"[{k}] {v}" for k, v in REASONS.items()))
        picked = input("  reasons (comma separated) > ").strip()
        reasons = [REASONS[p.strip()] for p in picked.split(",")
                   if p.strip() in REASONS]

    return {"clip": clip_name, "verdict": verdict, "reasons": reasons}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m packages.pipeline.review")
    parser.add_argument("--dir", type=Path, default=Path("demo_output"))
    parser.add_argument("--no-input", action="store_true",
                        help="Print the queue without asking for verdicts.")
    args = parser.parse_args(argv)

    report_path = args.dir / "demo_report.json"
    if not report_path.exists():
        print(f"No demo_report.json in {args.dir}. Run `make demo INPUT=...` first.",
              file=sys.stderr)
        return 2

    report = json.loads(report_path.read_text())
    clips = report.get("clips", [])
    if not clips:
        print("This run offered no clips. Nothing to review.")
        print("That is a real result: ClipR abstains rather than manufacturing "
              "clips it does not rate.")
        return 0

    for i, clip in enumerate(clips, start=1):
        show(clip, i, len(clips))

    interactive = not args.no_input and sys.stdin.isatty()
    if not interactive:
        print("\n" + "=" * 74)
        print("Not an interactive terminal — no verdicts recorded.")
        print("Run this attached to a terminal to record post/maybe/reject.")
        return 0

    decisions = [ask(Path(c["path"]).name, interactive) for i, c in enumerate(clips, 1)]
    reviewed = [d for d in decisions if d["verdict"] != "unreviewed"]
    if not reviewed:
        print("\nNothing reviewed.")
        return 0

    result = record_review(args.dir / "reviews.json",
                           report.get("input", str(args.dir)), reviewed)

    print("\n" + "=" * 74)
    print(f"PUBLISHABLE RATE: {result['publishable_rate']:.0%} "
          f"({result['posted']}/{result['offered']})  —  {band(result['publishable_rate'])}")
    if result["top_reasons"]:
        print("\nWhy clips were rejected:")
        for reason, count in result["top_reasons"]:
            print(f"  {count:>2}x  {reason}")
    print(f"\nRecorded in {(args.dir / 'reviews.json').resolve()}")
    print("\nOne session is an anecdote. The rate means something after a "
          "few hundred clips across several creators.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
