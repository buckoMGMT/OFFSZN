"""Turn a pile of creator verdicts into the next engineering sprint.

    python -m packages.pipeline.dataset --runs evaluation/runs

Reads every run directory containing a demo_report.json and a verdicts.json,
and answers three questions that decide what gets built next:

*How good is Ranking V1?* Publishable Rate over everything offered, with
maybes in the denominator -- they were recommended and not approved.

*What is it getting wrong?* Rejection reasons as a share of rejects. "36% of
rejects are bad moment selection" is an instruction. "Make ranking better" is
not.

*Which dimension actually predicts a keep?* The mean of each dimension for
kept clips against rejected ones. A dimension that scores the same either way
is carrying weight it has not earned -- and since every weight in V1 is a
prior nobody has validated, this is the first evidence about which of them
were guesses worth keeping.

It refuses to draw conclusions from a handful of clips, and it will not mix
ranking versions silently.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

from packages.ai.clip_eval import band

# Below this many judged clips the percentages move several points per verdict.
MIN_CLIPS_FOR_A_CONCLUSION = 100

JUDGED = ("post", "maybe", "reject")


def load_runs(root: Path) -> list[dict]:
    """Every run under `root` that has both a report and verdicts."""
    runs = []
    for report_path in sorted(root.rglob("demo_report.json")):
        verdicts_path = report_path.parent / "verdicts.json"
        if not verdicts_path.exists():
            continue
        report = json.loads(report_path.read_text())
        verdicts = json.loads(verdicts_path.read_text())
        by_file = {Path(c["path"]).name: c for c in report.get("clips", [])}
        rows = []
        for verdict in verdicts:
            if verdict.get("verdict") not in JUDGED:
                continue
            clip = by_file.get(verdict.get("clip"), {})
            rows.append({
                "run": report_path.parent.name,
                "source": Path(report.get("input", "?")).name,
                "clip": verdict.get("clip"),
                "verdict": verdict["verdict"],
                "reasons": verdict.get("reasons", []),
                "blind": verdict.get("blind", False),
                "ranking_version": verdict.get("ranking_version")
                                   or report.get("ranking_version", "unknown"),
                "clip_score": clip.get("clip_score"),
                "dimensions": clip.get("dimensions", {}),
                "strategy": clip.get("strategy"),
            })
        if rows:
            runs.append({"report": report_path.parent.name, "rows": rows})
    return runs


def analyse(rows: list[dict]) -> dict:
    kept = [r for r in rows if r["verdict"] == "post"]
    maybe = [r for r in rows if r["verdict"] == "maybe"]
    rejected = [r for r in rows if r["verdict"] == "reject"]

    reason_counts: dict[str, int] = {}
    for row in rejected:
        for reason in row["reasons"] or ["unspecified"]:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1

    dimensions = sorted({d for r in rows for d in (r["dimensions"] or {})})
    separation = {}
    for name in dimensions:
        keep_vals = [r["dimensions"][name] for r in kept
                     if name in (r["dimensions"] or {})]
        reject_vals = [r["dimensions"][name] for r in rejected
                       if name in (r["dimensions"] or {})]
        if len(keep_vals) >= 3 and len(reject_vals) >= 3:
            separation[name] = {
                "kept_mean": round(statistics.mean(keep_vals), 1),
                "rejected_mean": round(statistics.mean(reject_vals), 1),
                "gap": round(statistics.mean(keep_vals)
                             - statistics.mean(reject_vals), 1),
            }

    versions = sorted({r["ranking_version"] for r in rows})
    blind = [r for r in rows if r["blind"]]

    return {
        "judged": len(rows),
        "kept": len(kept),
        "maybe": len(maybe),
        "rejected": len(rejected),
        "publishable_rate": round(len(kept) / len(rows), 4) if rows else 0.0,
        "reason_counts": dict(sorted(reason_counts.items(),
                                     key=lambda kv: -kv[1])),
        "dimension_separation": dict(sorted(separation.items(),
                                            key=lambda kv: -abs(kv[1]["gap"]))),
        "ranking_versions": versions,
        "blind_share": round(len(blind) / len(rows), 3) if rows else 0.0,
        "sources": sorted({r["source"] for r in rows}),
    }


def report(root: Path) -> int:
    runs = load_runs(root)
    if not runs:
        print(f"No reviewed runs under {root}.\n\n"
              f"Each run needs a demo_report.json and a verdicts.json:\n"
              f"  make demo INPUT=/path/to/vod.mp4 OUT={root}/creator_a_vod1\n"
              f"  make review-web OUT={root}/creator_a_vod1", file=sys.stderr)
        return 2

    rows = [r for run in runs for r in run["rows"]]
    a = analyse(rows)

    print(f"\nCLIPR DATASET  —  {len(runs)} run(s), {len(a['sources'])} source video(s)")
    print("=" * 74)

    if len(a["ranking_versions"]) > 1:
        print(f"\n  ! Mixed ranking versions: {', '.join(a['ranking_versions'])}")
        print("    These are not comparable. Re-run the older ones before")
        print("    drawing any conclusion from the numbers below.")

    if a["blind_share"] < 1.0:
        print(f"\n  ! {1 - a['blind_share']:.0%} of verdicts were made with "
              f"ClipR's score visible.")
        print("    Those judgements are anchored and should not be treated as")
        print("    a clean baseline.")

    print(f"\nVERDICTS   {a['judged']} clips judged")
    for label, count in (("keep", a["kept"]), ("maybe", a["maybe"]),
                         ("reject", a["rejected"])):
        share = count / a["judged"] if a["judged"] else 0
        print(f"  {label:<8} {count:>4}   {share:>5.0%}  {'#' * int(share * 40)}")

    rate = a["publishable_rate"]
    print(f"\nPUBLISHABLE RATE   {rate:.0%}  ({a['kept']}/{a['judged']})  —  {band(rate)}")
    print("  approvals over everything offered; a 'maybe' counts as offered "
          "and not approved")

    if a["reason_counts"]:
        total_reasons = sum(a["reason_counts"].values())
        print(f"\nWHY CLIPS WERE REJECTED   ({a['rejected']} rejects)")
        for reason, count in a["reason_counts"].items():
            share = count / total_reasons
            print(f"  {reason:<18} {count:>4}   {share:>5.0%}  {'#' * int(share * 40)}")
        top = next(iter(a["reason_counts"]))
        print(f"\n  Next sprint: {a['reason_counts'][top] / total_reasons:.0%} of "
              f"rejections are \"{top}\".")
        print("  Fix that without regressing the other measured metrics.")

    if a["dimension_separation"]:
        print("\nWHICH DIMENSIONS PREDICT A KEEP")
        print(f"  {'dimension':<14}{'kept':>8}{'rejected':>10}{'gap':>8}")
        for name, stats in a["dimension_separation"].items():
            print(f"  {name:<14}{stats['kept_mean']:>8.1f}"
                  f"{stats['rejected_mean']:>10.1f}{stats['gap']:>+8.1f}")
        print("\n  A dimension with a gap near zero is not distinguishing good")
        print("  clips from bad ones and is carrying weight it has not earned.")
        print("  Every weight in V1 is a prior; this is the first evidence about")
        print("  which of those guesses were worth keeping.")
    else:
        print("\nWHICH DIMENSIONS PREDICT A KEEP")
        print("  Not enough kept and rejected clips yet (needs 3+ of each).")

    print("\n" + "=" * 74)
    if a["judged"] < MIN_CLIPS_FOR_A_CONCLUSION:
        print(f"{a['judged']} clips judged. Below {MIN_CLIPS_FOR_A_CONCLUSION} "
              f"these percentages move several points per verdict —")
        print("read them as a direction, not a result.")
    else:
        print(f"{a['judged']} clips across {len(a['sources'])} videos. "
              f"Ranking {', '.join(a['ranking_versions'])}.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m packages.pipeline.dataset")
    parser.add_argument("--runs", type=Path, default=Path("evaluation/runs"))
    parser.add_argument("--json", action="store_true",
                        help="Emit the analysis as JSON instead of a report.")
    args = parser.parse_args(argv)

    if args.json:
        runs = load_runs(args.runs)
        rows = [r for run in runs for r in run["rows"]]
        print(json.dumps(analyse(rows), indent=2))
        return 0
    return report(args.runs)


if __name__ == "__main__":
    raise SystemExit(main())
