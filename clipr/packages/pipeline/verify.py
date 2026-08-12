"""Independently re-check what `make demo` produced.

    python -m packages.pipeline.verify --dir demo_output

Separate from the demo on purpose. A pipeline that grades its own homework in
the same process, from the same in-memory objects, can report success on files
it never re-opened -- which is precisely how a clip nobody could see anything
in came to be described as a completed demo.

This reads the directory from disk with no knowledge of how it was made, opens
every file, decodes frames out of every clip, and exits non-zero if any promise
in demo_report.json is not backed by bytes.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from packages.media.probe import MediaError, validate_output

REQUIRED = ("demo_report.json", "source_info.json")


def verify(out_dir: Path) -> tuple[bool, list[str], list[str]]:
    problems: list[str] = []
    notes: list[str] = []

    if not out_dir.is_dir():
        return False, [f"{out_dir} does not exist. Run `make demo INPUT=...` first."], []

    for name in REQUIRED:
        if not (out_dir / name).exists():
            problems.append(f"missing {name}")
    if problems:
        return False, problems, notes

    report = json.loads((out_dir / "demo_report.json").read_text())
    clips = report.get("clips", [])
    if not clips:
        problems.append("demo_report.json lists no clips")
        return False, problems, notes

    source_has_audio = bool(report.get("source", {}).get("has_audio", True))

    for clip in clips:
        path = Path(clip["path"])
        if not path.exists():
            problems.append(f"clip {clip['index']}: promised file is missing ({path})")
            continue
        try:
            result = validate_output(
                path, min_seconds=10.0, expect_audio=source_has_audio,
            )
        except MediaError as exc:
            problems.append(f"clip {clip['index']}: {exc}")
            continue

        if result.passed:
            notes.append(
                f"clip {clip['index']}: {result.width}x{result.height} "
                f"{result.duration_seconds}s "
                f"luma {[s['mean_luma'] for s in result.frame_samples]} OK"
            )
        else:
            for failure in result.failures:
                problems.append(f"clip {clip['index']}: {failure}")

        debug = Path(clip.get("debug_path", ""))
        if debug.name and not debug.exists():
            problems.append(f"clip {clip['index']}: debug version missing ({debug})")

    for extra in ("contact_sheet.jpg", "before_after.mp4"):
        target = out_dir / extra
        if not target.exists():
            problems.append(f"missing {extra}")
        elif target.stat().st_size < 5_000:
            problems.append(f"{extra} is only {target.stat().st_size} bytes")

    if report.get("human_quality_verified"):
        problems.append(
            "demo_report.json claims human_quality_verified. Nothing in this "
            "pipeline is allowed to set that; only a person who watched the "
            "clips can."
        )

    return not problems, problems, notes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m packages.pipeline.verify")
    parser.add_argument("--dir", type=Path, default=Path("demo_output"))
    args = parser.parse_args(argv)

    ok, problems, notes = verify(args.dir)

    print(f"Verifying {args.dir.resolve()}\n")
    for note in notes:
        print(f"  OK    {note}")
    for problem in problems:
        print(f"  FAIL  {problem}")

    print()
    if ok:
        print("TECHNICALLY VALID — every promised file exists, decodes, and has "
              "visible frames.")
        print("HUMAN QUALITY VERIFIED — still false. Watch the clips.")
        return 0

    print(f"{len(problems)} problem(s). The demo is not deliverable.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
