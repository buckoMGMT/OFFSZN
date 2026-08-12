"""Choosing how to get from 16:9 to 9:16 without destroying the content.

Cropping a 1920x1080 frame to 9:16 keeps 608 of 1920 columns. Sixty-eight
percent of the width is thrown away. For a person talking to camera that is
exactly right -- the discarded parts are wall. For a gameplay capture, a screen
recording, or anything with a HUD, it is a mutilation: the minimap, the health
bar, the scoreboard and the chat are all in the parts that get cut.

So the first question is not "where do I point the crop" but "should I crop at
all", and this module answers it by measurement rather than by hope. It builds
an energy map of the shot -- temporal motion plus spatial detail -- and asks
what fraction of that energy a 9:16 window can actually contain. High
concentration means one subject worth following. Low concentration means the
information is spread across the frame and cropping would delete most of it,
so the clip is letterboxed onto a blurred fill instead.

The hierarchy, in order:

    FACE_TRACK      OpenCV found faces. Follow them.
    MOTION_TRACK    No OpenCV, but energy is concentrated. Follow that.
    CENTER_CROP     Concentrated near the middle and barely moving.
    LETTERBOX_BLUR  Energy is spread out. Cropping would destroy the content,
                    so keep all of it and fill the rest.

Preferring preservation when confidence is low is deliberate: a letterboxed
clip looks slightly less native and loses nothing, while a confidently wrong
crop can cut the subject's head off.
"""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path

from packages.ai.subject import GRID_H, GRID_W, Track, _frames, track_subject

# Fraction of total energy a 9:16 window must capture before cropping is
# considered safe. Below this, too much of what matters lives outside any crop.
CONCENTRATION_CROP_FLOOR = 0.62
# Above this, the shot is clearly one subject and tracking is worth it.
CONCENTRATION_TRACK_FLOOR = 0.78
# Minimum mean tracker confidence before we trust a moving crop.
TRACK_CONFIDENCE_FLOOR = 0.10


class Strategy(StrEnum):
    FACE_TRACK = "face_track"
    MOTION_TRACK = "motion_track"
    CENTER_CROP = "center_crop"
    LETTERBOX_BLUR = "letterbox_blur"

    @property
    def preserves_full_frame(self) -> bool:
        return self is Strategy.LETTERBOX_BLUR


@dataclass
class FramingDecision:
    strategy: Strategy
    confidence: float
    reason: str
    concentration: float
    motion_spread: float
    track: Track | None = None
    signals: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "strategy": str(self.strategy),
            "confidence": round(self.confidence, 3),
            "reason": self.reason,
            "concentration": round(self.concentration, 3),
            "motion_spread": round(self.motion_spread, 3),
            "signals": self.signals,
        }


def _energy_map(frames: list[bytes]) -> list[float]:
    """Per-cell importance: temporal motion plus spatial detail.

    Motion alone misses a screen recording of static text, which must not be
    cropped either. Spatial gradient catches that: an area dense with edges is
    carrying information whether or not it is moving.
    """
    if not frames:
        return [0.0] * (GRID_W * GRID_H)

    energy = [0.0] * (GRID_W * GRID_H)
    previous: bytes | None = None

    for frame in frames:
        for i, value in enumerate(frame):
            if previous is not None:
                energy[i] += abs(value - previous[i]) / 255.0

            # Horizontal gradient. Cheap, and enough to separate "detailed
            # region" from "flat wall" without a real edge detector.
            x = i % GRID_W
            if x + 1 < GRID_W:
                energy[i] += abs(frame[i + 1] - value) / 255.0 * 0.35
        previous = frame

    return energy


def _column_profile(energy: list[float]) -> list[float]:
    cols = [0.0] * GRID_W
    for i, value in enumerate(energy):
        cols[i % GRID_W] += value
    return cols


def measure_concentration(energy: list[float], target_aspect: float = 9 / 16,
                          source_aspect: float = 16 / 9) -> tuple[float, float, float]:
    """How much of the energy a best-placed vertical window can hold.

    Returns (concentration, best_centre_x_normalised, spread).
    """
    cols = _column_profile(energy)
    total = sum(cols)
    if total <= 0:
        return 0.0, 0.5, 1.0

    # Width of the 9:16 window, in grid columns.
    window = max(1, min(GRID_W, round(GRID_W * (target_aspect / source_aspect))))

    best_sum, best_start = -1.0, 0
    running = sum(cols[:window])
    best_sum, best_start = running, 0
    for start in range(1, GRID_W - window + 1):
        running += cols[start + window - 1] - cols[start - 1]
        if running > best_sum:
            best_sum, best_start = running, start

    concentration = best_sum / total
    centre = (best_start + window / 2) / GRID_W

    # Spread: normalised standard deviation of energy across columns. A single
    # peak gives a low number; energy smeared across the frame gives a high one.
    mean = total / GRID_W
    variance = sum((c - mean) ** 2 for c in cols) / GRID_W
    spread = min(1.0, (variance ** 0.5) / mean) if mean > 0 else 1.0

    return concentration, centre, 1.0 - spread


def _opencv_available() -> bool:
    try:
        import cv2  # noqa: F401
    except ImportError:
        return False
    return True


def decide(media_path: str, start: float, duration: float,
           source_w: int, source_h: int, *, fps: float = 4.0) -> FramingDecision:
    """Pick a reframing strategy by measuring the shot."""
    frames = _frames(media_path, start, duration, fps)
    energy = _energy_map(frames)
    source_aspect = source_w / source_h if source_h else 16 / 9
    concentration, centre, spread = measure_concentration(
        energy, source_aspect=source_aspect
    )

    signals = {
        "frames_analysed": len(frames),
        "best_window_centre_x": round(centre, 3),
        "opencv": _opencv_available(),
        "source_aspect": round(source_aspect, 3),
    }

    # Already vertical or square: nothing to decide, and cropping a portrait
    # source to portrait would zoom in for no reason.
    if source_aspect <= 9 / 16 + 0.02:
        return FramingDecision(
            Strategy.CENTER_CROP, 1.0,
            "Source is already vertical; no reframing needed beyond a scale.",
            concentration, spread, None, signals,
        )

    if concentration < CONCENTRATION_CROP_FLOOR:
        return FramingDecision(
            Strategy.LETTERBOX_BLUR,
            round(1.0 - concentration, 3),
            f"Only {concentration:.0%} of the visual energy fits in a 9:16 "
            f"window, so cropping would discard most of what is on screen. "
            f"Keeping the whole frame on a blurred fill instead.",
            concentration, spread, None, signals,
        )

    track = track_subject(media_path, start, duration, fps=fps)
    mean_conf = (sum(track.confidence) / len(track.confidence)) if len(track) else 0.0
    signals["mean_track_confidence"] = round(mean_conf, 3)
    signals["track_samples"] = len(track)

    if concentration >= CONCENTRATION_TRACK_FLOOR and mean_conf >= TRACK_CONFIDENCE_FLOOR:
        strategy = Strategy.FACE_TRACK if _opencv_available() else Strategy.MOTION_TRACK
        detail = ("faces" if strategy is Strategy.FACE_TRACK
                  else "the moving subject")
        return FramingDecision(
            strategy, round(min(1.0, concentration), 3),
            f"{concentration:.0%} of the energy sits in one window; "
            f"following {detail}.",
            concentration, spread, track, signals,
        )

    # Concentrated enough to crop, not confident enough to move the window
    # around. A still crop beats a jittery one.
    return FramingDecision(
        Strategy.CENTER_CROP, round(concentration, 3),
        f"Energy is concentrated ({concentration:.0%}) but tracking confidence "
        f"is low ({mean_conf:.2f}); holding a fixed crop on the busiest region "
        f"rather than chasing noise.",
        concentration, spread, track, signals,
    )


def _ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if path is None:
        raise RuntimeError("ffmpeg not found on PATH")
    return path


def letterbox_filter(target_w: int = 1080, target_h: int = 1920,
                     blur: int = 22) -> str:
    """Whole frame, centred, over a blurred zoomed copy of itself.

    The background is the same footage scaled to *cover* and heavily blurred,
    which reads far better than black bars and keeps the clip feeling full
    frame on a phone.
    """
    return (
        f"[0:v]split=2[bg][fg];"
        f"[bg]scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
        f"crop={target_w}:{target_h},boxblur={blur}:2,eq=brightness=-0.06[bgb];"
        f"[fg]scale={target_w}:-2:flags=bicubic[fgs];"
        f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2"
    )


def static_crop_filter(source_w: int, source_h: int, centre_x: float,
                       target_w: int = 1080, target_h: int = 1920) -> str:
    """A fixed 9:16 window, placed on the busiest part of the frame."""
    crop_w = min(source_w, int(source_h * target_w / target_h))
    crop_w -= crop_w % 2
    crop_h = min(source_h, int(crop_w * target_h / target_w))
    crop_h -= crop_h % 2
    x = int(centre_x * source_w - crop_w / 2)
    x = max(0, min(x, source_w - crop_w))
    y = max(0, (source_h - crop_h) // 2)
    return (f"[0:v]crop={crop_w}:{crop_h}:{x}:{y},"
            f"scale={target_w}:{target_h}:flags=bicubic")


def build_filter(decision: FramingDecision, source_w: int, source_h: int,
                 *, target_w: int = 1080, target_h: int = 1920,
                 sendcmd_path: Path | None = None,
                 first_box: tuple[int, int, int, int] | None = None) -> str:
    """The video filter chain implementing a decision, minus captions."""
    if decision.strategy is Strategy.LETTERBOX_BLUR:
        return letterbox_filter(target_w, target_h)

    if decision.strategy in (Strategy.FACE_TRACK, Strategy.MOTION_TRACK):
        if sendcmd_path is None or first_box is None:
            raise ValueError("tracking strategies need a sendcmd script and a first box")
        x, y, w, h = first_box
        escaped = str(sendcmd_path).replace("\\", "/").replace(":", r"\:")
        return (f"[0:v]sendcmd=f='{escaped}',crop={w}:{h}:{x}:{y},"
                f"scale={target_w}:{target_h}:flags=bicubic")

    centre = decision.signals.get("best_window_centre_x", 0.5)
    return static_crop_filter(source_w, source_h, centre, target_w, target_h)


def probe_filter(filter_complex: str, source_w: int = 1280, source_h: int = 720) -> None:
    """Fail fast on a malformed graph.

    ffmpeg reports filter-graph errors identically whether the graph is wrong
    or the input is, and a render is expensive. One null frame through the
    graph turns a confusing thirty-second failure into an immediate one.

    The test source must match the dimensions the graph was built for. A fixed
    640x360 probe rejected a perfectly good crop built for 1280x720, because
    the crop was larger than the probe frame -- a validator that fails on valid
    input is worse than none, since the obvious response is to stop calling it.
    """
    proc = subprocess.run(
        [_ffmpeg(), "-nostdin", "-v", "error", "-f", "lavfi",
         "-i", f"testsrc2=s={source_w}x{source_h}:r=24:d=0.2",
         "-filter_complex", filter_complex,
         "-frames:v", "1", "-f", "null", "-"],
        capture_output=True, text=True, timeout=120,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Invalid filter graph:\n{proc.stderr.strip()[:500]}")
