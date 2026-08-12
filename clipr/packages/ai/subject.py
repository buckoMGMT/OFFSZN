"""Subject tracking without OpenCV.

`crop.py` uses a Haar cascade when OpenCV is installed and falls back to a
centre crop when it is not. A centre crop on gameplay footage is close to
useless -- the thing worth watching is rarely in the middle -- so "no OpenCV"
meant "no reframing" in practice, on the machines most likely to be running a
first deployment.

This is the fallback that should have existed: ffmpeg decodes to small
greyscale frames, and the subject is found as the centroid of the region that
is both bright and moving. Pure Python over a few thousand bytes per frame, no
native dependency, fast enough to be free next to the render.

It finds *a* subject, not *the* subject. Where OpenCV is available, faces win.
"""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass

# Downsample hard. A 64x36 luma plane is 2,304 bytes -- enough to locate a
# subject to within a couple of percent of frame width, which is far finer than
# the crop needs, and cheap enough to run in pure Python.
GRID_W, GRID_H = 64, 36


@dataclass(frozen=True)
class Track:
    """Normalised subject positions, 0..1 across the frame, one per sample."""
    xs: list[float]
    ys: list[float]
    fps: float
    confidence: list[float]

    def __len__(self) -> int:
        return len(self.xs)

    def at(self, index: int) -> tuple[float, float, float]:
        i = max(0, min(index, len(self.xs) - 1))
        return self.xs[i], self.ys[i], self.confidence[i]


def _ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if path is None:
        raise RuntimeError("ffmpeg not found on PATH")
    return path


def _frames(media_path: str, start: float, duration: float,
            fps: float) -> list[bytes]:
    """Decode to raw greyscale at GRID_W x GRID_H."""
    proc = subprocess.run(
        [
            _ffmpeg(), "-nostdin", "-hide_banner", "-loglevel", "error",
            # -ss before -i: seek by index rather than decoding from zero.
            "-ss", f"{start}", "-t", f"{duration}", "-i", media_path,
            "-vf", f"fps={fps},scale={GRID_W}:{GRID_H}",
            "-pix_fmt", "gray", "-f", "rawvideo", "-",
        ],
        capture_output=True, timeout=600,
    )
    size = GRID_W * GRID_H
    data = proc.stdout
    return [data[i:i + size] for i in range(0, len(data) - size + 1, size)]


def track_subject(media_path: str, start: float, duration: float,
                  fps: float = 4.0) -> Track:
    """Follow the brightest moving region through a span of video.

    Motion is weighted above brightness: a bright static HUD element would
    otherwise capture the crop for the whole clip, which is the classic failure
    of naive saliency tracking on gameplay.
    """
    frames = _frames(media_path, start, duration, fps)
    xs: list[float] = []
    ys: list[float] = []
    conf: list[float] = []
    previous: bytes | None = None

    for frame in frames:
        total = wx = wy = 0.0
        peak = 0.0
        bright_total = bright_x = bright_y = 0.0

        for index, value in enumerate(frame):
            brightness = value / 255.0
            motion = abs(value - previous[index]) / 255.0 if previous else 0.0

            # Motion *gates* the weight rather than merely outranking it.
            # Summing motion and brightness looks equivalent and is not: a
            # static bright element covering many cells outvotes a small moving
            # one, so a facecam border or an on-screen clock captures the crop
            # for the whole clip. Multiplying means anything that does not move
            # contributes nothing, however bright it is.
            weight = motion * (0.6 + brightness)
            if weight > 0.02:
                total += weight
                wx += weight * (index % GRID_W)
                wy += weight * (index // GRID_W)
                peak = max(peak, weight)

            # Kept as a fallback for a genuinely still scene -- a streamer
            # sitting and talking has almost no frame-to-frame motion, and
            # holding the last position forever would be worse than aiming at
            # the brightest thing.
            if brightness > 0.25:
                bright_total += brightness
                bright_x += brightness * (index % GRID_W)
                bright_y += brightness * (index // GRID_W)

        if total <= 0.05 and bright_total > 0:
            total, wx, wy = bright_total, bright_x, bright_y
            peak = 0.15

        if total > 0:
            xs.append(wx / total / (GRID_W - 1))
            ys.append(wy / total / (GRID_H - 1))
            conf.append(min(1.0, peak))
        else:
            # Nothing to see. Hold the previous position rather than snapping
            # to centre, which would read as a jump cut in the output.
            xs.append(xs[-1] if xs else 0.5)
            ys.append(ys[-1] if ys else 0.5)
            conf.append(0.0)
        previous = frame

    return Track(xs=xs, ys=ys, fps=fps, confidence=conf)


def to_regions(track: Track, source_w: int, source_h: int,
               box_fraction: float = 0.28) -> list:
    """Turn normalised positions into Regions the reframer understands."""
    from packages.ai.crop import Region

    bw = int(source_w * box_fraction)
    bh = int(source_h * box_fraction)
    out = []
    for x, y, confidence in zip(track.xs, track.ys, track.confidence, strict=True):
        cx = int(x * source_w)
        cy = int(y * source_h)
        out.append(Region(x=max(0, cx - bw // 2), y=max(0, cy - bh // 2),
                          w=bw, h=bh, confidence=confidence))
    return out
