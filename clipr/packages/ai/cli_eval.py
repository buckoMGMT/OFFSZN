"""`make eval` — run the detector over a labeled dataset and print the result.

Exit codes:
    0  ran, and either passed the gate or the gate abstained
    1  a real regression against the recorded baseline
    2  could not run (missing or malformed dataset)

The gate abstains on a synthetic dataset, so `make eval` out of the box proves
the harness executes without letting a fixture masquerade as a quality result.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from packages.ai.detector import PIPELINE_VERSION, PROMPT_VERSION, MomentDetector
from packages.ai.evaluation import check_regression, evaluate

DEFAULT_DATASET = Path("tests/ai/datasets/smoke.jsonl")


def build_detect_fn(detector: MomentDetector):
    def detect(sample: dict):
        return detector.detect(
            sample.get("media_path", ""),
            duration_seconds=sample["duration_seconds"],
            transcript=sample.get("transcript"),
            chat_events=sample.get("chat_events"),
            native_clip_events=sample.get("native_clip_events"),
        ).moments
    return detect


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the detection eval harness.")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--baseline", type=Path, help="A previous result JSON to gate against.")
    parser.add_argument("--json", action="store_true", help="Print the raw result.")
    args = parser.parse_args(argv)

    # No media and no LLM: the loudness provider yields nothing, so the cascade
    # runs on chat and clip events alone. That is a real degraded mode, and
    # exercising it here means the fallback path is covered by every eval run.
    detector = MomentDetector(loudness_provider=lambda _: [])

    try:
        result = evaluate(
            build_detect_fn(detector), args.dataset,
            pipeline_version=PIPELINE_VERSION, prompt_version=PROMPT_VERSION,
        )
    except (FileNotFoundError, ValueError) as exc:
        print(exc, file=sys.stderr)
        return 2

    baseline = None
    if args.baseline and args.baseline.exists():
        from packages.ai.evaluation import EvalResult
        baseline = EvalResult(**json.loads(args.baseline.read_text()))

    verdict = check_regression(result, baseline)

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
    else:
        tag = " [SYNTHETIC]" if result.synthetic else ""
        print(f"dataset            {result.dataset_name}{tag}")
        print(f"sha256             {result.dataset_sha256[:16]}")
        print(f"samples / labels   {result.sample_count} / {result.labeled_moment_count}")
        print(f"detected           {result.detected_count}")
        print(f"precision          {result.precision}")
        print(f"recall             {result.recall}")
        print(f"f1                 {result.f1}")
        print(f"publishable rate   {result.publishable_rate}")
        print(f"boundary error     {result.boundary_error_seconds}s")
        print(f"caption WER        {result.caption_wer if result.caption_wer is not None else 'not measured'}")
        print(f"crop accuracy      {result.crop_accuracy if result.crop_accuracy is not None else 'not measured'}")
        print()
        print("gate:", "BLOCKED" if verdict.blocks_deploy
              else ("abstained" if verdict.abstained else "passed"))
        for reason in verdict.reasons:
            print(" -", reason)

    return 1 if verdict.blocks_deploy else 0


if __name__ == "__main__":
    raise SystemExit(main())
