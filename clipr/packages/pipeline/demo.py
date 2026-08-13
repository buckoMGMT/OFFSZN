"""ClipR on a real video file.

    python -m packages.pipeline.demo --input /path/to/video.mp4
    make demo INPUT=/path/to/video.mp4

A local file is the only requirement. No Twitch, TikTok, Instagram or YouTube
credentials; no Postgres, Redis or Stripe; no dashboard. If any of those were
needed to see whether the clips are good, they would be in the way.

The output is the point of this program, not the log it prints. It writes real
MP4 files to a directory that stays put, and the question it exists to let
somebody answer is: would I post this?

What this program will not do:

* invent a transcript when speech recognition cannot run
* describe a clip as good, funny, or postable
* report success on a file it has not decoded and inspected

The last section of the report separates TECHNICALLY VALID from HUMAN QUALITY
VERIFIED, because everything above it is machine-checkable and nothing above it
establishes that a clip is worth posting.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path

from packages.ai import captions as C
from packages.ai.reframe import decide
from packages.ai.safety import screen
from packages.ai.signals import MAX_CLIP_SECONDS, find_candidates, snap_to_speech
from packages.ai.transcribe import (
    Transcript,
    TranscriptionUnavailable,
    available_engines,
    transcribe,
)
from packages.ai.transcribe import (
    save as save_transcript,
)
from packages.media.probe import (
    SILENT_DBFS,
    MediaError,
    audio_rms_dbfs,
    probe,
    validate_output,
)
from packages.pipeline.render import (
    before_after,
    contact_sheet,
    render_clip,
    render_debug,
    write_json,
)

DEFAULT_CLIPS = 3
RULE = "=" * 74


@dataclass
class Stage:
    name: str
    seconds: float
    detail: str = ""


@dataclass
class DemoReport:
    input_path: str
    output_dir: str
    stages: list[Stage] = field(default_factory=list)
    source: dict = field(default_factory=dict)
    transcript: dict = field(default_factory=dict)
    candidates: list[dict] = field(default_factory=list)
    clips: list[dict] = field(default_factory=list)
    validation: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    technically_valid: bool = False
    human_quality_verified: bool = False

    def to_dict(self) -> dict:
        return {
            "input": self.input_path,
            "output_dir": self.output_dir,
            "source": self.source,
            "transcript": self.transcript,
            "candidates": self.candidates,
            "clips": self.clips,
            "validation": self.validation,
            "warnings": self.warnings,
            "verdict": {
                "technically_valid": self.technically_valid,
                "human_quality_verified": self.human_quality_verified,
                "what_technically_valid_means": (
                    "Every clip decodes, is 1080x1920, has non-blank frames, "
                    "and carries audio when the source did."
                ),
                "what_it_does_not_mean": (
                    "Nothing here establishes that a clip is interesting, funny, "
                    "well-timed, or worth posting. Only a person watching it can "
                    "establish that, and no automated check in this pipeline is "
                    "allowed to claim it."
                ),
            },
            "stages": [{"stage": s.name, "seconds": round(s.seconds, 2),
                        "detail": s.detail} for s in self.stages],
        }


class Timer:
    def __init__(self, report: DemoReport) -> None:
        self.report = report

    def run(self, name: str, fn, detail: str = ""):
        started = time.perf_counter()
        value = fn()
        elapsed = time.perf_counter() - started
        self.report.stages.append(Stage(name, elapsed, detail))
        print(f"  {name:<30} {elapsed:>7.2f}s  {detail}")
        return value


def _markdown(report: DemoReport) -> str:
    d = report.to_dict()
    lines = [
        "# ClipR demo report",
        "",
        f"**Input:** `{d['input']}`  ",
        f"**Output:** `{d['output_dir']}`",
        "",
        "## Source",
        "",
        "| field | value |",
        "| --- | --- |",
    ]
    for k, v in d["source"].items():
        lines.append(f"| {k} | {v} |")

    t = d["transcript"]
    lines += [
        "", "## Transcription", "",
        f"- Engine: **{t.get('engine', 'none')}** ({t.get('model', '-')})",
        f"- Quality: **{t.get('quality', 'n/a')}**",
        f"- Words: {t.get('word_count', 0)}",
        f"- Trustworthy for caption accuracy: **{t.get('trustworthy', False)}**",
        "", "## Clips", "",
        "| # | start | end | strategy | captions | file |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for clip in d["clips"]:
        lines.append(
            f"| {clip['index']} | {clip['start']}s | {clip['end']}s | "
            f"{clip['strategy']} | {clip['caption_cues']} cues | "
            f"`{Path(clip['path']).name}` |"
        )

    lines += ["", "## Why these moments", ""]
    for clip in d["clips"]:
        lines.append(f"**Clip {clip['index']}** — score {clip['score']} — {clip['reason']}")
        lines.append("")

    lines += ["## Verdict", ""]
    v = d["verdict"]
    lines += [
        f"- TECHNICALLY VALID: **{v['technically_valid']}** — {v['what_technically_valid_means']}",
        f"- HUMAN QUALITY VERIFIED: **{v['human_quality_verified']}**",
        "",
        f"> {v['what_it_does_not_mean']}",
        "",
        "Open the clips and answer these yourself:",
        "",
        "1. Was this actually a good moment?",
        "2. Did ClipR choose the right beginning?",
        "3. Did ClipR choose the right ending?",
        "4. Is the speaker or action visible?",
        "5. Are the captions correct?",
        "6. Does the vertical crop look good?",
        "7. Would you actually post this?",
    ]
    if d["warnings"]:
        lines += ["", "## Warnings", ""] + [f"- {w}" for w in d["warnings"]]
    return "\n".join(lines) + "\n"


def run(input_path: Path, out_dir: Path, *, clips_wanted: int = DEFAULT_CLIPS,
        engine: str = "auto", clip_seconds: float | None = None) -> DemoReport:
    out_dir.mkdir(parents=True, exist_ok=True)
    report = DemoReport(input_path=str(input_path.resolve()),
                        output_dir=str(out_dir.resolve()))
    timer = Timer(report)

    # --- 1. input -----------------------------------------------------------
    print(f"\n{RULE}\nCLIPR DEMO\n{RULE}")
    print("\n1. INPUT")
    info = timer.run("probe", lambda: probe(input_path))
    print(info.describe())
    report.source = info.to_dict()
    write_json(out_dir / "source_info.json", info.to_dict())

    if not info.has_audio:
        report.warnings.append(
            "Source has no audio track. Detection falls back to visual signals "
            "only, and there will be no captions."
        )
        print("\n  ! No audio stream. Continuing on visual signals alone.")

    # --- 2. transcript ------------------------------------------------------
    print("\n2. TRANSCRIPTION")
    transcript: Transcript | None = None

    # A file can carry a real audio stream containing digital silence. Running
    # speech recognition over it is worse than pointless: Whisper hallucinates
    # on silence, and a real 2-minute clip of nothing produced twelve segments
    # reading "(buzzing)". That is invented text reaching the captions, which
    # is the exact failure this pipeline refuses to commit.
    source_rms = audio_rms_dbfs(input_path) if info.has_audio else None
    source_audible = source_rms is not None and source_rms > SILENT_DBFS
    if info.has_audio and not source_audible:
        report.warnings.append(
            f"Source has an audio stream but it is silent ({source_rms} dBFS). "
            f"Transcription was skipped -- speech recognition on silence "
            f"invents text. Detection falls back to visual signals."
        )
        print(f"     ! audio stream is silent ({source_rms} dBFS) — skipping ASR")

    if info.has_audio and source_audible:
        try:
            transcript = timer.run(
                "transcribe",
                lambda: transcribe(input_path, engine=engine, work_dir=out_dir),
            )
        except TranscriptionUnavailable as exc:
            print(f"\n  TRANSCRIPTION FAILED\n{exc}\n")
            print("  Engines seen: " + json.dumps(available_engines(), indent=2))
            raise

        save_transcript(transcript, out_dir)
        report.transcript = {
            k: v for k, v in transcript.to_dict().items() if k != "segments"
        }
        print(f"     engine {transcript.engine} ({transcript.model}), "
              f"{transcript.word_count} words, quality={transcript.quality}")
        if not transcript.trustworthy:
            report.warnings.append(
                f"Transcript came from {transcript.engine}, whose accuracy is "
                f"'{transcript.quality}'. Captions will contain wrong words. "
                f"Install faster-whisper for usable captions."
            )
            print(f"     ! quality is '{transcript.quality}' — captions will be wrong")
    else:
        report.transcript = {
            "engine": None,
            "reason": ("source has no audio" if not info.has_audio
                       else "source audio is silent; ASR skipped"),
        }

    # --- 3. detection -------------------------------------------------------
    print("\n3. DETECTION — real media signals, no planted moments")
    candidates, context = timer.run(
        "find candidates",
        lambda: find_candidates(input_path.as_posix(), info.duration_seconds,
                                transcript=transcript, top_n=max(8, clips_wanted * 3)),
    )
    print(f"     {context['windows_examined']} windows examined, "
          f"{context['windows_scored']} scored, {len(candidates)} after overlap "
          f"suppression")
    print(f"     baseline {context['baseline_dbfs']} dBFS, "
          f"{context['scene_changes']} scene changes")

    if not candidates:
        report.warnings.append(
            "No candidate moments scored above zero. The file may be uniformly "
            "quiet and static; there is nothing to clip."
        )
        print("\n  No moments found. Nothing to render.")
        _finish(report, out_dir)
        return report

    candidates = [snap_to_speech(c, transcript, info.duration_seconds)
                  for c in candidates]
    write_json(out_dir / "candidates.json",
               {"context": context, "candidates": [c.to_dict() for c in candidates]})
    report.candidates = [c.to_dict() for c in candidates]

    for c in candidates[:clips_wanted]:
        print(f"     {c.describe()}")

    # --- 4. render ----------------------------------------------------------
    print("\n4. REFRAME + CAPTIONS + RENDER")

    def build_clip(i: int, cand) -> dict:
        """Everything for one clip. Independent of every other clip."""
        duration = min(cand.duration, clip_seconds or MAX_CLIP_SECONDS)
        decision = decide(input_path.as_posix(), cand.start, duration,
                          info.width, info.height)

        ass_path = None
        cue_count = 0
        caption_warnings: list[str] = []
        if transcript is not None:
            cap = C.prepare(transcript, cand.start, cand.start + duration,
                            out_dir / f".clip_{i:02d}.ass")
            ass_path = cap.ass_path if cap.rendered_anything else None
            cue_count = cap.cue_count
            caption_warnings = [f"clip {i}: {w}" for w in cap.warnings
                                if "overflow" in w or "no captions" in w]

        clip_path = out_dir / f"clip_{i:02d}.mp4"
        render_clip(input_path.as_posix(), clip_path, start=cand.start,
                    duration=duration, decision=decision, source_w=info.width,
                    source_h=info.height, ass_path=ass_path,
                    has_audio=info.has_audio)

        debug_path = out_dir / f"clip_{i:02d}_debug.mp4"
        render_debug(input_path.as_posix(), debug_path, clip_path,
                     start=cand.start, duration=duration, candidate=cand,
                     decision=decision, source_w=info.width, source_h=info.height)

        return {
            "index": i,
            "path": str(clip_path.resolve()),
            "debug_path": str(debug_path.resolve()),
            "start": round(cand.start, 2),
            "end": round(cand.start + duration, 2),
            "score": round(cand.score, 2),
            "reason": "; ".join(cand.reasons),
            "strategy": str(decision.strategy),
            "framing": decision.to_dict(),
            "caption_cues": cue_count,
            "_warnings": caption_warnings,
            "_reason": decision.reason,
        }

    chosen = candidates[:clips_wanted]
    # Clips share nothing, and each one spends nearly all its time waiting on
    # an ffmpeg subprocess, so they overlap almost perfectly. Capped at the
    # core count because the encoders are the thing competing, not Python.
    workers = max(1, min(len(chosen), os.cpu_count() or 2))
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(build_clip, i, c): i
                   for i, c in enumerate(chosen, start=1)}
        results = {futures[f]: f.result() for f in as_completed(futures)}

    elapsed = time.perf_counter() - started
    report.stages.append(Stage(f"build {len(chosen)} clips ({workers} at once)",
                               elapsed))
    print(f"  {'build clips':<30} {elapsed:>7.2f}s  "
          f"({len(chosen)} clips, {workers} in parallel)")

    # Report in clip order, not completion order.
    rendered: list[dict] = []
    clip_paths: list[Path] = []
    for i in sorted(results):
        entry = results[i]
        print(f"     clip {i} -> {entry['strategy']}: {entry['_reason']}")
        report.warnings.extend(entry.pop("_warnings"))
        entry.pop("_reason")
        rendered.append(entry)
        clip_paths.append(Path(entry["path"]))

    report.clips = rendered

    # --- 5. validation ------------------------------------------------------
    print("\n5. VALIDATION — decoding what we produced")
    all_valid = True
    for clip in rendered:
        result = validate_output(
            clip["path"], min_seconds=min(10.0, info.duration_seconds),
            expect_audio=info.has_audio, expect_audible=source_audible,
        )
        report.validation.append(result.to_dict())
        mark = "OK  " if result.passed else "FAIL"
        print(f"     {mark} {Path(clip['path']).name}  "
              f"{result.width}x{result.height}  {result.duration_seconds}s  "
              f"luma {[s['mean_luma'] for s in result.frame_samples]}")
        for failure in result.failures:
            print(f"          {failure}")
            report.warnings.append(f"{Path(clip['path']).name}: {failure}")
        all_valid &= result.passed

    report.technically_valid = all_valid and bool(rendered)
    # Never set by this program. It is here to be false until a person says so.
    report.human_quality_verified = False

    # --- 6. comparison artifacts -------------------------------------------
    print("\n6. INSPECTION ARTIFACTS")
    try:
        timer.run("contact sheet",
                  lambda: contact_sheet(clip_paths, out_dir / "contact_sheet.jpg"))
    except Exception as exc:  # noqa: BLE001
        report.warnings.append(f"contact sheet failed: {exc}")
        print(f"     ! contact sheet failed: {exc}")

    try:
        first = rendered[0]
        timer.run(
            "before/after",
            lambda: before_after(input_path.as_posix(), Path(first["path"]),
                                 out_dir / "before_after.mp4",
                                 start=first["start"],
                                 duration=first["end"] - first["start"]),
        )
    except Exception as exc:  # noqa: BLE001
        report.warnings.append(f"before/after failed: {exc}")
        print(f"     ! before/after failed: {exc}")

    # --- 7. safety ----------------------------------------------------------
    if transcript is not None and not transcript.is_empty:
        screening = screen(transcript_text=transcript.text)
        if screening.flags:
            print("\n7. SCREENING")
            for flag in screening.flags:
                print(f"     {flag.severity.upper():<7} {flag.flag_type:<16} {flag.message}")
            print(f"     autopilot blocked: {screening.blocks_autopilot}")

    _finish(report, out_dir)
    return report


def _finish(report: DemoReport, out_dir: Path) -> None:
    for tmp in out_dir.glob(".clip_*.ass"):
        tmp.unlink(missing_ok=True)
    for tmp in out_dir.glob(".*.asr.wav"):
        tmp.unlink(missing_ok=True)
    write_json(out_dir / "demo_report.json", report.to_dict())
    (out_dir / "demo_report.md").write_text(_markdown(report))


def _print_paths(report: DemoReport, out_dir: Path) -> bool:
    """Print every artifact's absolute path, and verify each one exists."""
    print(f"\n{RULE}\nCLIPR DEMO COMPLETE\n{RULE}")
    print(f"\nInput:\n  {report.input_path}")

    missing: list[str] = []

    def show(label: str, path: Path) -> None:
        exists = path.exists()
        if not exists:
            missing.append(str(path))
        print(f"  {'' if exists else '[MISSING] '}{path.resolve()}")

    if report.clips:
        print("\nGenerated clips:")
        for clip in report.clips:
            show("clip", Path(clip["path"]))
        print("\nDebug versions:")
        for clip in report.clips:
            show("debug", Path(clip["debug_path"]))

    print("\nBefore/After:")
    show("before_after", out_dir / "before_after.mp4")
    print("\nContact sheet:")
    show("contact_sheet", out_dir / "contact_sheet.jpg")
    print("\nTranscript:")
    show("transcript", out_dir / "transcript.txt")
    print("\nReport:")
    show("report", out_dir / "demo_report.md")

    print(f"\n{RULE}")
    print(f"TECHNICALLY VALID:      {report.technically_valid}")
    print("HUMAN QUALITY VERIFIED: False  <- only you can set this")
    print(RULE)
    print(
        "\nAutomated checks establish that the clips decode, are 1080x1920, are\n"
        "not blank, and carry audio. They establish nothing about whether the\n"
        "moments are good. Open the clips and answer:\n"
        "  1. Was this actually a good moment?\n"
        "  2. Did ClipR choose the right beginning?\n"
        "  3. Did ClipR choose the right ending?\n"
        "  4. Is the speaker/action visible?\n"
        "  5. Are captions correct?\n"
        "  6. Does the vertical crop look good?\n"
        "  7. Would you actually post this?"
    )

    if report.warnings:
        print("\nWarnings:")
        for w in report.warnings:
            print(f"  - {w}")

    if missing:
        print(f"\n{len(missing)} promised file(s) do not exist:")
        for m in missing:
            print(f"  {m}")
        return False
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m packages.pipeline.demo",
        description="Run ClipR over a local video file and write watchable clips.",
    )
    parser.add_argument("--input", "-i", type=Path, required=True,
                        help="A local video file (mp4, mov, mkv, webm).")
    parser.add_argument("--out", "-o", type=Path, default=Path("demo_output"),
                        help="Output directory (default: ./demo_output)")
    parser.add_argument("--clips", "-n", type=int, default=DEFAULT_CLIPS)
    parser.add_argument("--engine", default="auto",
                        choices=["auto", "faster-whisper", "pocketsphinx"])
    parser.add_argument("--clip-seconds", type=float, default=None,
                        help="Cap each clip's length.")
    args = parser.parse_args(argv)

    try:
        report = run(args.input, args.out, clips_wanted=args.clips,
                     engine=args.engine, clip_seconds=args.clip_seconds)
    except MediaError as exc:
        print(f"\nINPUT REJECTED\n  {exc}\n", file=sys.stderr)
        return 2
    except TranscriptionUnavailable:
        # Already reported in full where it happened.
        return 3

    ok = _print_paths(report, args.out)
    if not report.clips:
        return 4
    return 0 if (ok and report.technically_valid) else 1


if __name__ == "__main__":
    raise SystemExit(main())
