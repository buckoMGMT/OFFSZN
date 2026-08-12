"""End-to-end pipeline demo on real video.

What this is: a synthetic stream, generated with ffmpeg, pushed through the
*real* detection cascade, the *real* reframer, the *real* safety screening and
the *real* cost ledger. The audio analysis is genuine ffmpeg output, the clip
that comes out is a genuine H.264 file you can play.

What this is not: a demo on a live Twitch stream. There is no Twitch
credential here, no HLS ingest, and no publishing. Those are the parts that are
stubbed, and this demo cannot tell you anything about them.

The value is that it proves the middle of the pipeline works on real media
rather than on fixtures, and it produces the first real cost numbers this
project has ever had -- measured GPU-less wall time, not estimates.

    python -m packages.pipeline.demo --out /tmp/clipr-demo
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
import time
from dataclasses import asdict
from pathlib import Path

from packages.ai.crop import Reframer
from packages.ai.detector import MomentDetector, ffmpeg_loudness_envelope
from packages.ai.safety import screen
from packages.ai.subject import to_regions, track_subject

# Where the interesting moments actually are, so detection can be scored rather
# than admired. The generator puts real audio energy here.
PLANTED = [
    {"at": 95, "label": "big reaction"},
    {"at": 240, "label": "clutch play"},
    {"at": 430, "label": "chat explodes"},
]
DURATION = 540  # nine minutes


def ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if path is None:
        raise RuntimeError("ffmpeg not found on PATH")
    return path


def synthesize_stream(path: Path, duration: int = DURATION) -> None:
    """Build a video whose audio is quiet except at the planted moments.

    The detector reads real dBFS off this file, so the loud sections have to be
    genuinely louder -- not annotated as loud. That is the whole point of
    running the demo on media instead of on a dict.
    """
    # Shaped like a stream rather than like a test card: a dark scene, a bright
    # subject that moves, a facecam box in the corner, and a burned-in clock so
    # you can tell from the output which part of the source a clip came from.
    # A colour-bar source proves the plumbing and shows a viewer nothing.
    bursts = "+".join(
        f"between(t,{m['at'] - 12},{m['at'] + 14})" for m in PLANTED
    )
    # The subject sweeps across the frame and bobs, so a crop that follows it is
    # visibly different from a centre crop -- which is the whole point.
    sub_x = "640+520*sin(t/9)"
    sub_y = "300+120*sin(t/3.5)"

    # `overlay` rather than `drawbox`: drawbox in ffmpeg 6.1 has no `eval`
    # option and fixes its coordinates at init, so a "moving" box is pinned at
    # its t=0 position for the whole file. overlay evaluates x/y per frame,
    # which is the difference between a subject to track and a still image.
    filtergraph = (
        f"color=c=0x0d1117:s=1280x720:r=24:d={duration}[bg];"
        # the subject: a bright square that actually moves
        "color=c=0xff4b32:s=110x110:d=1[subject];"
        f"[bg][subject]overlay=x='{sub_x}-55':y='{sub_y}-55':eval=frame[a1];"
        # facecam, static, bottom right -- and a good test that a bright static
        # element does not capture the tracker
        "[a1]drawbox=x=980:y=470:w=260:h=200:color=0x1f2933@1.0:t=fill[a2];"
        "[a2]drawbox=x=980:y=470:w=260:h=200:color=0x3fc9de@0.9:t=3[a3];"
        "[a3]drawtext=text='FACECAM':x=1012:y=492:fontsize=22:fontcolor=0x3fc9de[a4];"
        # burned clock, so a clip's position in the source is visible in the output
        "[a4]drawtext=text='%{pts\\:hms}':x=40:y=40:fontsize=44:"
        "fontcolor=white:box=1:boxcolor=0x000000@0.6:boxborderw=12[v]"
    )

    subprocess.run(
        [
            ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", f"sine=frequency=220:duration={duration}",
            "-filter_complex",
            filtergraph + f";[0:a]volume='if({bursts},0.35,0.008)':eval=frame[a]",
            "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
            "-c:a", "aac", "-b:a", "64k", "-shortest",
            str(path),
        ],
        check=True, capture_output=True, timeout=900,
    )


def synthetic_chat(duration: int = DURATION) -> list[dict]:
    """A chat log with bursts at the planted moments and a quiet baseline."""
    events = [{"t": float(t)} for t in range(0, duration, 7)]      # ~1 msg / 7s
    for moment in PLANTED:
        events += [{"t": moment["at"] + i * 0.12} for i in range(90)]
    return sorted(events, key=lambda e: e["t"])


def transcript_for(duration: int = DURATION) -> list[dict]:
    lines = {
        95: "oh my god he actually hit that, chat did you see it",
        240: "no way, no way, that was frame perfect",
        430: "okay okay everyone calm down, my email is not going in the clip",
    }
    out = []
    for t in range(0, duration, 30):
        text = next((v for k, v in lines.items() if abs(k - t) < 20), "so anyway as I was saying")
        out.append({"start": t, "end": t + 30, "text": text})
    return out


def matched(moment, tolerance: float = 25.0) -> str | None:
    for planted in PLANTED:
        if moment.start - tolerance <= planted["at"] <= moment.end + tolerance:
            return planted["label"]
    return None


def run(out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    source = out_dir / "stream.mp4"
    report: dict = {"stages": []}

    def stage(name: str, fn):
        started = time.perf_counter()
        value = fn()
        elapsed = time.perf_counter() - started
        report["stages"].append({"stage": name, "seconds": round(elapsed, 2)})
        print(f"  {name:<28} {elapsed:>6.2f}s")
        return value

    print("\n1. INGEST — synthesising a 9-minute stream with real audio")
    stage("generate source", lambda: synthesize_stream(source))
    size_mb = source.stat().st_size / 1e6
    print(f"     {source} · {size_mb:.1f} MB · {DURATION}s")

    print("\n2. DETECT — real ffmpeg loudness envelope, one pass")
    envelope = stage("loudness envelope", lambda: ffmpeg_loudness_envelope(str(source)))
    finite = [v for v in envelope if v > -100]
    print(f"     {len(envelope)} samples · "
          f"range {min(finite):.1f} to {max(finite):.1f} dBFS")

    chat = synthetic_chat()
    transcript = transcript_for()

    print("\n3. CASCADE — chat velocity + audio, then rank")
    detector = MomentDetector(loudness_provider=lambda _: envelope)
    result = stage("detect", lambda: detector.detect(
        str(source), duration_seconds=DURATION,
        transcript=transcript, chat_events=chat))
    print(f"     {result.windows_examined} windows examined, "
          f"{result.windows_promoted} promoted "
          f"({result.windows_promoted / result.windows_examined:.0%})")

    print("\n4. RANKING — top moments, and whether they are the planted ones")
    hits = 0
    for moment in result.moments[:6]:
        label = matched(moment)
        hits += bool(label)
        mark = f"HIT  {label}" if label else "miss"
        print(f"     {moment.start:>6.0f}-{moment.end:<6.0f} score {moment.score:>5.1f}  "
              f"{mark:<22} {'; '.join(moment.reasons)[:52]}")
    top3 = sum(1 for m in result.moments[:3] if matched(m))
    print(f"     recall {hits}/{len(PLANTED)} planted moments; "
          f"{top3}/3 of the top three are real")

    print("\n5. REFRAME — real 9:16 render with a moving crop track")
    reframer = Reframer(1280, 720, 1080, 1920)
    best = result.moments[0]
    clip_path = out_dir / "clip.mp4"

    # Real tracking off the actual pixels: ffmpeg decodes small greyscale
    # frames and the subject is the centroid of what is bright and moving. No
    # OpenCV on this machine, and a centre crop on gameplay is close to useless,
    # so this is the fallback that had to exist.
    clip_seconds = min(45.0, best.end - best.start)
    subject = stage("track subject", lambda: track_subject(
        str(source), best.start, clip_seconds, fps=4.0))
    regions = to_regions(subject, 1280, 720)
    track = reframer.smooth(
        [reframer.crop_box(r, t=i / subject.fps) for i, r in enumerate(regions)],
        window=5, max_step=34,
    )
    tracked = sum(1 for c in subject.confidence if c > 0.05)
    print(f"     {len(subject)} samples, subject located in {tracked} "
          f"({tracked / max(1, len(subject)):.0%})")
    stage("render clip", lambda: reframer.render(
        str(source), str(clip_path), track,
        start=best.start, duration=clip_seconds))

    probe = subprocess.run(
        [shutil.which("ffprobe"), "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,nb_frames,duration",
         "-of", "json", str(clip_path)],
        capture_output=True, text=True, check=True,
    )
    meta = json.loads(probe.stdout)["streams"][0]
    print(f"     {clip_path} · {meta['width']}x{meta['height']} · "
          f"{float(meta.get('duration', 0)):.1f}s · "
          f"{clip_path.stat().st_size / 1e6:.2f} MB")
    moves = reframer.sendcmd_script(track).strip().count(";")
    print(f"     crop moved {moves} times across the clip")

    print("\n6. SCREEN — rights and safety, before anything publishes")
    text = " ".join(s["text"] for s in transcript)
    screening = screen(transcript_text=text + " reach me at streamer@example.com")
    for flag in screening.flags:
        print(f"     {flag.severity.upper():<7} {flag.flag_type:<18} {flag.message}")
    print(f"     autopilot blocked: {screening.blocks_autopilot}")

    report.update({
        "source_mb": round(size_mb, 2),
        "windows_examined": result.windows_examined,
        "windows_promoted": result.windows_promoted,
        "promotion_rate": round(result.windows_promoted / result.windows_examined, 4),
        "planted": len(PLANTED),
        "planted_found": hits,
        "top3_precision": round(top3 / 3, 2),
        "clip": {"path": str(clip_path), "width": meta["width"],
                 "height": meta["height"], "crop_moves": moves},
        "safety_flags": [f.flag_type for f in screening.flags],
        "moments": [asdict(m) for m in result.moments[:6]],
    })
    (out_dir / "report.json").write_text(json.dumps(report, indent=2))
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path,
                        default=Path(tempfile.gettempdir()) / "clipr-demo")
    args = parser.parse_args(argv)

    print("=" * 72)
    print("ClipR pipeline demo — synthetic stream, real media, real code")
    print("Not a live Twitch stream: ingest and publishing are not exercised.")
    print("=" * 72)

    report = run(args.out)
    total = sum(s["seconds"] for s in report["stages"])

    print("\n" + "=" * 72)
    print(f"Processed {DURATION / 60:.0f} minutes of video in {total:.1f}s "
          f"({DURATION / total:.0f}x realtime on CPU alone)")
    print(f"Report: {args.out / 'report.json'}")
    print(f"Clip:   {report['clip']['path']}")
    print("=" * 72)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
