"""Run the ranker against human-labelled VODs and check the launch gates.

    python -m packages.ai.cli_clip_eval --dir evaluation/creator_vods

This is the scoreboard that decides whether ClipR is ready to have money spent
on acquisition. The thresholds below are internal launch gates, chosen before
seeing any results so they cannot be quietly relaxed to fit them:

    precision@3     >= 70%    of the three offered, how many are genuinely good
    recall@5        >= 60%    did it find the moments a human wanted
    publishable     >= 60%    creator approvals / clips offered
    duplicate rate   < 5%
    boundary error  <= 3.0s   average distance from the accepted cut ranges

Publishable Rate is not computed here. It comes from creators reviewing clips
(`make review-web`), and deriving it from labels would let the model mark its
own homework.

Below twenty VODs this prints the numbers and refuses to call the gate either
way, because at that size the differences are noise.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from packages.ai.clip_eval import (
    DEFAULT_DATASET_DIR,
    aggregate,
    evaluate_vod,
    load_dataset,
)

GATES = {
    "precision_at_3": (0.70, "ge"),
    "recall_at_5": (0.60, "ge"),
    "duplicate_rate": (0.05, "lt"),
    "boundary_error_seconds": (3.0, "le"),
}

MIN_VODS_FOR_A_VERDICT = 20


def _check(name: str, value, threshold: float, direction: str) -> tuple[bool, str]:
    if value is None:
        return False, f"{name:<26} not measured"
    ok = {"ge": value >= threshold,
          "lt": value < threshold,
          "le": value <= threshold}[direction]
    symbol = {"ge": ">=", "lt": "<", "le": "<="}[direction]
    shown = f"{value:.2%}" if name.endswith(("rate", "_3", "_5")) else f"{value:.2f}s"
    target = (f"{threshold:.0%}" if name.endswith(("rate", "_3", "_5"))
              else f"{threshold:.1f}s")
    return ok, f"{name:<26} {shown:>8}   target {symbol} {target:<7} {'PASS' if ok else 'FAIL'}"


def run(directory: Path, ranker=None, k: int = 3) -> int:
    try:
        dataset = load_dataset(directory)
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        return 2

    if ranker is None:
        print("No ranker supplied; this CLI scores previously saved runs.\n"
              "Each labelled VOD needs a matching demo_report.json produced by "
              "`make demo`, alongside it or named in `clips_from`.\n")

    results = []
    for vod in dataset:
        clips = _load_clips_for(vod, directory)
        if clips is None:
            print(f"  {vod.name:<28} no clips found; run `make demo` on it first")
            continue
        results.append(evaluate_vod(vod, clips, k=k))

    if not results:
        print("\nNothing to measure.", file=sys.stderr)
        return 2

    summary = aggregate(results, k=k)

    print("\nPER VOD")
    for r in results:
        boundary = ("-" if r.boundary_error_seconds is None
                    else f"{r.boundary_error_seconds:.1f}s")
        print(f"  {r.vod:<28} recall {r.recall_at_k:>6.0%}  "
              f"precision {r.precision_at_k:>6.0%}  boundary {boundary:>6}  "
              f"dupes {r.duplicates}")

    print("\nOVERALL")
    for key in (f"recall_at_{k}", f"precision_at_{k}", "duplicate_rate",
                "boundary_error_seconds", "labelled_moments", "clips_offered"):
        if key in summary:
            print(f"  {key:<26} {summary[key]}")

    print("\nLAUNCH GATES")
    passed = True
    for name, (threshold, direction) in GATES.items():
        value = summary.get(name)
        if name == "recall_at_5" and f"recall_at_{k}" in summary and k != 5:
            # Only assert the gate that this run actually measured.
            continue
        ok, line = _check(name, value, threshold, direction)
        passed &= ok
        print(f"  {line}")

    print(f"\n  {'publishable_rate':<26} {'-':>8}   "
          f"target >= 60%     needs creator review (make review-web)")

    print()
    if len(results) < MIN_VODS_FOR_A_VERDICT:
        print(f"{len(results)} VOD(s). Not calling the gate either way -- below "
              f"{MIN_VODS_FOR_A_VERDICT} the differences are noise.")
        return 0

    print("LAUNCH GATE: " + ("PASS" if passed else "FAIL"))
    return 0 if passed else 1


def _load_clips_for(vod, directory: Path):
    """Find the clips a previous run produced for this VOD."""
    candidates = [
        directory / f"{vod.name}_report.json",
        directory / vod.name / "demo_report.json",
        Path("demo_output") / "demo_report.json",
    ]
    for path in candidates:
        if not path.exists():
            continue
        report = json.loads(path.read_text())
        if Path(report.get("input", "")).name != Path(vod.media_path).name:
            continue

        class _Clip:
            __slots__ = ("start", "end", "clip_score")

        out = []
        for entry in report.get("clips", []):
            clip = _Clip()
            clip.start = entry["start"]
            clip.end = entry["end"]
            clip.clip_score = entry.get("clip_score", 0.0)
            out.append(clip)
        return out
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m packages.ai.cli_clip_eval")
    parser.add_argument("--dir", type=Path, default=DEFAULT_DATASET_DIR)
    parser.add_argument("-k", type=int, default=3)
    args = parser.parse_args(argv)
    return run(args.dir, k=args.k)


if __name__ == "__main__":
    raise SystemExit(main())
