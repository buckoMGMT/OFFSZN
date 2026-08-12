"""Subject-aware 9:16 reframing.

Three defects in the previous version, in descending order of severity:

1. `render()` computed a full per-second crop track, smoothed it, and then threw
   it away -- it applied one static crop taken from the middle frame. The entire
   detection and smoothing pipeline was dead code and the output was a fixed
   centre crop. Time-varying crop is now emitted as an ffmpeg `sendcmd` script,
   which is how you actually drive a filter parameter over time.

2. `_detect_faces` called `cap.read()` once per intended second, but `read()`
   returns the *next* frame. At 30 fps it sampled the first N frames of the clip
   and labelled them as seconds 0..N, so every crop decision came from the first
   second of footage. Sampling now seeks by frame index.

3. The Haar cascade was reloaded from disk inside the per-frame loop.

The geometry is separated from the I/O so it can be tested without OpenCV,
ffmpeg, or a video file.
"""

from __future__ import annotations

import shutil
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Region:
    x: int
    y: int
    w: int
    h: int
    confidence: float = 0.5

    @property
    def cx(self) -> int:
        return self.x + self.w // 2

    @property
    def cy(self) -> int:
        return self.y + self.h // 2


@dataclass(frozen=True)
class Crop:
    t: float
    x: int
    y: int
    w: int
    h: int
    reason: str


class Reframer:
    def __init__(
        self,
        source_w: int = 1920,
        source_h: int = 1080,
        target_w: int = 1080,
        target_h: int = 1920,
    ):
        if min(source_w, source_h, target_w, target_h) <= 0:
            raise ValueError("dimensions must be positive")
        self.sw, self.sh = source_w, source_h
        self.tw, self.th = target_w, target_h

    # -- geometry (pure) ---------------------------------------------------

    def crop_box(self, region: Region | None, t: float = 0.0, reason: str = "center") -> Crop:
        """A target-aspect box inside the source, centred on `region` if given.

        Always clamped inside the source frame -- an out-of-bounds crop makes
        ffmpeg fail the whole render, which in an unattended pipeline means a
        silent gap in someone's posting schedule.
        """
        target_aspect = self.tw / self.th
        source_aspect = self.sw / self.sh

        if source_aspect > target_aspect:
            cw = max(2, int(round(self.sh * target_aspect)))
            ch = self.sh
            x = (self.sw - cw) // 2 if region is None else region.cx - cw // 2
            x = max(0, min(x, self.sw - cw))
            y = 0
        else:
            cw = self.sw
            ch = max(2, int(round(self.sw / target_aspect)))
            y = (self.sh - ch) // 2 if region is None else region.cy - ch // 2
            y = max(0, min(y, self.sh - ch))
            x = 0

        # ffmpeg's H.264 encoder needs even dimensions and offsets.
        return Crop(t, x - (x % 2), y - (y % 2), cw - (cw % 2), ch - (ch % 2), reason)

    def smooth(self, crops: Sequence[Crop], window: int = 5, max_step: int = 24) -> list[Crop]:
        """Moving average plus a velocity clamp.

        The average alone still lets the frame teleport when a second face
        appears; `max_step` caps how far the crop may travel between samples, so
        the worst case is a slow pan rather than a cut.
        """
        if not crops:
            return []
        half = max(0, window // 2)
        out: list[Crop] = []
        for i, c in enumerate(crops):
            group = crops[max(0, i - half): i + half + 1]
            ax = sum(g.x for g in group) // len(group)
            ay = sum(g.y for g in group) // len(group)
            if out:
                prev = out[-1]
                ax = max(prev.x - max_step, min(prev.x + max_step, ax))
                ay = max(prev.y - max_step, min(prev.y + max_step, ay))
            ax = max(0, min(ax, self.sw - c.w))
            ay = max(0, min(ay, self.sh - c.h))
            out.append(Crop(c.t, ax - (ax % 2), ay - (ay % 2), c.w, c.h, c.reason))
        return out

    # -- detection (I/O) ---------------------------------------------------

    def track(
        self, video_path: str, start: float, duration: float, fps_sample: float = 2.0
    ) -> list[Crop]:
        """Sample the clip and produce one crop per sample point."""
        regions = self._detect(video_path, start, duration, fps_sample)
        step = 1.0 / fps_sample
        crops = []
        n = max(1, int(duration * fps_sample))
        for i in range(n):
            t = i * step
            region = regions.get(i)
            crops.append(self.crop_box(region, t, "face" if region else "center"))
        return self.smooth(crops)

    def _detect(
        self, video_path: str, start: float, duration: float, fps_sample: float
    ) -> dict[int, Region]:
        try:
            import cv2
        except ImportError:
            return {}

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {}

        cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        native_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        step_frames = max(1, int(round(native_fps / fps_sample)))
        first_frame = int(round(start * native_fps))
        total = max(1, int(duration * fps_sample))

        regions: dict[int, Region] = {}
        try:
            for i in range(total):
                cap.set(cv2.CAP_PROP_POS_FRAMES, first_frame + i * step_frames)
                ok, frame = cap.read()
                if not ok:
                    break
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(48, 48))
                if len(faces):
                    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                    regions[i] = Region(int(x), int(y), int(w), int(h), 0.7)
        finally:
            cap.release()
        return regions

    # -- render ------------------------------------------------------------

    def sendcmd_script(self, crops: Sequence[Crop]) -> str:
        """ffmpeg sendcmd program that moves the crop window over time.

        Emits a command only when the box actually moves; a command per sample
        on a 60-second clip is 120 no-ops the filter graph has to process.
        """
        lines, last = [], None
        for c in crops:
            if last and (c.x, c.y) == (last.x, last.y):
                continue
            lines.append(f"{c.t:.3f} crop x {c.x}, crop y {c.y};")
            last = c
        return "\n".join(lines) + "\n"

    def render(
        self, video_path: str, output_path: str, crops: Sequence[Crop],
        *, start: float = 0.0, duration: float | None = None,
    ) -> None:
        if not crops:
            raise ValueError("no crop track; call track() first")
        box = crops[0]
        script = Path(output_path).with_suffix(".sendcmd")
        script.write_text(self.sendcmd_script(crops))

        # -ss before -i seeks by index instead of decoding from zero.
        # Absolute path: a bare name is resolved through PATH at call time, so
        # anything that can prepend a directory chooses what we execute.
        ffmpeg = shutil.which("ffmpeg")
        if ffmpeg is None:
            raise RuntimeError("ffmpeg not found on PATH")

        cmd = [ffmpeg, "-nostdin", "-y", "-ss", f"{start}"]
        if duration is not None:
            cmd += ["-t", f"{duration}"]
        cmd += [
            "-i", video_path,
            "-filter_complex",
            f"[0:v]sendcmd=f={script},"
            f"crop={box.w}:{box.h}:{box.x}:{box.y},"
            f"scale={self.tw}:{self.th}:flags=bicubic[v]",
            "-map", "[v]", "-map", "0:a?",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            output_path,
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=1800)
        finally:
            script.unlink(missing_ok=True)
