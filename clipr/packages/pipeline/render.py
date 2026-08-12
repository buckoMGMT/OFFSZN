"""Turning a decision into files a person can open.

Four outputs per run, and the split between them is the point:

    clip_NN.mp4        clean. What the creator would post. No overlays, ever.
    clip_NN_debug.mp4  the same moment with the machine's reasoning drawn on
                       it -- score, signals, and the crop window over the
                       original frame, so a bad choice can be diagnosed
                       instead of guessed at.
    contact_sheet.jpg  frames from every clip on one page, to spot a framing
                       failure without watching anything.
    before_after.mp4   source beside result, synchronised.

Keeping the clean render clean matters more than it sounds. Once debug text is
burned into the artifact the founder watches, nobody can answer "would I post
this?" -- which is the only question the demo exists to ask.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from packages.ai.captions import ass_filter
from packages.ai.crop import Reframer
from packages.ai.reframe import FramingDecision, Strategy, build_filter
from packages.ai.signals import Candidate
from packages.ai.subject import to_regions

TARGET_W, TARGET_H = 1080, 1920


class RenderError(RuntimeError):
    pass


def _bin(name: str) -> str:
    path = shutil.which(name)
    if path is None:
        raise RenderError(f"{name} not found on PATH")
    return path


def _run(cmd: list[str], timeout: int = 3600) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RenderError(
            f"ffmpeg failed ({proc.returncode}).\n"
            f"  {' '.join(cmd[:14])} ...\n"
            f"  {proc.stderr.strip()[-700:]}"
        )


def _escape_text(text: str) -> str:
    """drawtext eats colons, backslashes, quotes and percent signs."""
    return (text.replace("\\", "")
                .replace(":", "\\:")
                .replace("'", "")
                .replace("%", "")
                .replace(",", "\\,")
                .replace("[", "(").replace("]", ")"))


@dataclass
class RenderedClip:
    index: int
    path: Path
    debug_path: Path | None
    start: float
    end: float
    strategy: str
    caption_cues: int

    @property
    def duration(self) -> float:
        return self.end - self.start


def crop_track(decision: FramingDecision, source_w: int, source_h: int) -> list:
    """The smoothed crop boxes for a tracking decision, or an empty list.

    Shared by the clean render and the debug view so they cannot disagree about
    where the crop went -- a debug artifact that shows something other than
    what shipped is worse than none, because it sends the diagnosis the wrong
    way.
    """
    if decision.strategy not in (Strategy.FACE_TRACK, Strategy.MOTION_TRACK):
        return []
    if not decision.track:
        return []
    reframer = Reframer(source_w, source_h, TARGET_W, TARGET_H)
    regions = to_regions(decision.track, source_w, source_h)
    return reframer.smooth(
        [reframer.crop_box(r, t=i / decision.track.fps) for i, r in enumerate(regions)],
        window=5, max_step=34,
    )


def render_clip(
    source: str,
    out_path: Path,
    *,
    start: float,
    duration: float,
    decision: FramingDecision,
    source_w: int,
    source_h: int,
    ass_path: Path | None = None,
    has_audio: bool = True,
) -> Path:
    """Render one clean vertical clip: reframe, then captions, one pass."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sendcmd_path: Path | None = None
    first_box: tuple[int, int, int, int] | None = None

    track = crop_track(decision, source_w, source_h)
    if track:
        reframer = Reframer(source_w, source_h, TARGET_W, TARGET_H)
        sendcmd_path = out_path.with_suffix(".sendcmd")
        sendcmd_path.write_text(reframer.sendcmd_script(track))
        box = track[0]
        first_box = (box.x, box.y, box.w, box.h)

    graph = build_filter(
        decision, source_w, source_h,
        target_w=TARGET_W, target_h=TARGET_H,
        sendcmd_path=sendcmd_path, first_box=first_box,
    )
    if ass_path is not None and ass_path.exists():
        graph += f",{ass_filter(ass_path)}"
    graph += "[v]"

    cmd = [
        _bin("ffmpeg"), "-nostdin", "-y", "-v", "error",
        "-ss", f"{start}", "-t", f"{duration}", "-i", source,
        "-filter_complex", graph, "-map", "[v]",
    ]
    if has_audio:
        cmd += ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k"]
    cmd += [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(out_path),
    ]
    try:
        _run(cmd)
    finally:
        if sendcmd_path is not None:
            sendcmd_path.unlink(missing_ok=True)
    return out_path


def _wrap_words(text: str, width: int, max_lines: int = 3) -> list[str]:
    """Wrap on spaces. Slicing by character count split words mid-syllable."""
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if current and len(candidate) > width:
            lines.append(current)
            current = word
            if len(lines) == max_lines:
                return lines
        else:
            current = candidate
    if current and len(lines) < max_lines:
        lines.append(current)
    return lines


def render_debug(
    source: str,
    out_path: Path,
    clip_path: Path,
    *,
    start: float,
    duration: float,
    candidate: Candidate,
    decision: FramingDecision,
    source_w: int,
    source_h: int,
) -> Path:
    """Source beside result, with the machine's reasoning drawn on.

    The first version of this drew a single static crop box on the source. For
    a tracking render that box is simply wrong -- the crop moves, and the box
    showed a window the subject spent half the clip outside of. A debug
    artifact that misrepresents the render is worse than none: it sends the
    diagnosis in the wrong direction, which is exactly the failure this whole
    exercise is about.

    So the left pane marks the *swept range* of the crop -- the full extent the
    window travelled, which is a true statement about a moving crop -- and the
    right pane is the actual rendered clip. Whatever really happened is on the
    right, at all times.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)

    track = crop_track(decision, source_w, source_h)
    if decision.strategy is Strategy.LETTERBOX_BLUR:
        box = None
        window_note = "no crop - whole frame kept"
    elif track:
        xs = [c.x for c in track]
        bw = track[0].w
        left, right = min(xs), max(xs) + bw
        box = (left, track[0].y, right - left, track[0].h)
        window_note = f"crop swept x {min(xs)}-{max(xs) + bw} of {source_w}"
    else:
        crop_w = min(source_w, int(source_h * TARGET_W / TARGET_H))
        crop_h = min(source_h, int(crop_w * TARGET_H / TARGET_W))
        centre = decision.signals.get("best_window_centre_x", 0.5)
        bx = max(0, min(int(centre * source_w - crop_w / 2), source_w - crop_w))
        box = (bx, max(0, (source_h - crop_h) // 2), crop_w, crop_h)
        window_note = f"fixed crop at x {bx}"

    half_w, half_h = 540, 960
    size = max(15, int(half_h * 0.026))

    # Wrap to what fits the pane, not to a guessed character count. DejaVu Sans
    # regular averages ~0.55em per glyph; at 24px in a 512px pane that is 38
    # characters, not the 46 a guess produced -- which ran the reasoning text
    # off the edge of the panel that exists to explain the decision.
    wrap_at = max(16, int((half_w - 28) / (size * 0.55)))

    header = [
        f"score {candidate.score:.1f}   {candidate.start:.1f}-{candidate.end:.1f}s",
        f"{decision.strategy}  conf {decision.confidence:.2f}  "
        f"conc {decision.concentration:.2f}",
        window_note,
    ]
    header += _wrap_words("; ".join(candidate.reasons), wrap_at, max_lines=3)

    left_chain = ["[0:v]"]
    if box is not None:
        bx, by, bw, bh = box
        left_chain.append(
            f"drawbox=x={bx}:y={by}:w={bw}:h={bh}:color=0x3FC9DE@0.95:t=5,"
        )
    else:
        left_chain.append("drawbox=x=2:y=2:w=iw-4:h=ih-4:color=0xFF4B32@0.9:t=5,")

    left_chain.append(
        f"scale={half_w}:{half_h}:force_original_aspect_ratio=decrease,"
        f"pad={half_w}:{half_h}:(ow-iw)/2:(oh-ih)/2:color=0x0A0D10,"
    )
    banner_h = 24 + len(header) * (size + 5)
    left_chain.append(f"drawbox=x=0:y=0:w=iw:h={banner_h}:color=0x000000@0.78:t=fill,")
    for i, line in enumerate(header):
        colour = "0x3FC9DE" if i == 0 else "0xFFFFFF"
        left_chain.append(
            f"drawtext=text='{_escape_text(line)}':x=14:y={12 + i * (size + 5)}:"
            f"fontsize={size}:fontcolor={colour},"
        )
    left_chain.append("null[a];")

    right_chain = (
        f"[1:v]scale={half_w}:{half_h}:force_original_aspect_ratio=decrease,"
        f"pad={half_w}:{half_h}:(ow-iw)/2:(oh-ih)/2:color=0x0A0D10,"
        f"drawbox=x=0:y=0:w=iw:h={size + 18}:color=0x000000@0.78:t=fill,"
        f"drawtext=text='CLIPR OUTPUT':x=14:y=8:fontsize={size}:"
        f"fontcolor=0x3FC9DE[b];[a][b]hstack=inputs=2[v]"
    )

    _run([
        _bin("ffmpeg"), "-nostdin", "-y", "-v", "error",
        "-ss", f"{start}", "-t", f"{duration}", "-i", source,
        "-i", str(clip_path),
        "-filter_complex", "".join(left_chain) + right_chain,
        "-map", "[v]", "-map", "1:a?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
        "-c:a", "aac", "-b:a", "96k", "-pix_fmt", "yuv420p",
        str(out_path),
    ])
    return out_path


def contact_sheet(clips: list[Path], out_path: Path, per_clip: int = 6) -> Path:
    """One page of frames per clip, so framing failures are visible at a glance."""
    if not clips:
        raise RenderError("No clips to build a contact sheet from.")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    rows: list[Path] = []

    from packages.media.probe import probe

    for i, clip in enumerate(clips):
        # Even spacing across the clip. `thumbnail` picks "representative"
        # frames, which clusters them and can miss the first and last seconds
        # entirely -- the two places framing most often goes wrong. Sampling at
        # a fixed fraction of the duration guarantees the whole clip is shown.
        #
        # The step has to be computed here rather than in the filter: framestep
        # takes a constant, and there is no frame-count variable available to
        # an expression inside it.
        row = out_path.parent / f".row_{i}.jpg"
        seconds = max(0.1, probe(clip).duration_seconds)
        rate = per_clip / seconds
        _run([
            _bin("ffmpeg"), "-nostdin", "-y", "-v", "error", "-i", str(clip),
            "-vf", (f"fps={rate:.6f},scale=270:480,"
                    f"tile={per_clip}x1:padding=6:color=0x101418"),
            "-frames:v", "1", "-update", "1", str(row),
        ])
        rows.append(row)

    if len(rows) == 1:
        shutil.move(str(rows[0]), str(out_path))
        return out_path

    inputs: list[str] = []
    for row in rows:
        inputs += ["-i", str(row)]
    stack = "".join(f"[{i}:v]" for i in range(len(rows)))
    _run([
        _bin("ffmpeg"), "-nostdin", "-y", "-v", "error", *inputs,
        "-filter_complex", f"{stack}vstack=inputs={len(rows)}[v]",
        "-map", "[v]", "-frames:v", "1", "-update", "1", str(out_path),
    ])
    for row in rows:
        row.unlink(missing_ok=True)
    return out_path


def before_after(source: str, clip: Path, out_path: Path, *,
                 start: float, duration: float) -> Path:
    """Source and result side by side, labelled, playing in sync."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    half_w, half_h = 540, 960
    label = max(20, int(half_h * 0.035))

    graph = (
        f"[0:v]scale={half_w}:{half_h}:force_original_aspect_ratio=decrease,"
        f"pad={half_w}:{half_h}:(ow-iw)/2:(oh-ih)/2:color=0x0A0D10,"
        f"drawbox=x=0:y=0:w=iw:h={label + 18}:color=0x000000@0.75:t=fill,"
        f"drawtext=text='ORIGINAL':x=20:y=10:fontsize={label}:fontcolor=0xFFFFFF[a];"
        f"[1:v]scale={half_w}:{half_h}:force_original_aspect_ratio=decrease,"
        f"pad={half_w}:{half_h}:(ow-iw)/2:(oh-ih)/2:color=0x0A0D10,"
        f"drawbox=x=0:y=0:w=iw:h={label + 18}:color=0x000000@0.75:t=fill,"
        f"drawtext=text='CLIPR':x=20:y=10:fontsize={label}:fontcolor=0x3FC9DE[b];"
        f"[a][b]hstack=inputs=2[v]"
    )
    _run([
        _bin("ffmpeg"), "-nostdin", "-y", "-v", "error",
        "-ss", f"{start}", "-t", f"{duration}", "-i", source,
        "-i", str(clip),
        "-filter_complex", graph, "-map", "[v]", "-map", "1:a?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(out_path),
    ])
    return out_path


def write_json(path: Path, payload: dict) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str))
    return path
