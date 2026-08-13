"""Ask the file what it is, and check what we produced is watchable.

This module exists because of a specific failure: the pipeline reported
success -- ffmpeg exit 0, valid MP4 container, correct dimensions, moving crop
track -- and produced a clip a human could not see anything in. Every automated
check passed. The artifact was worthless.

So validation here is deliberately about *pixels and samples*, not about
containers. `validate_output` decodes real frames out of the finished file and
checks they are not black, not frozen, and that the audio is not silent when
the source had sound. Those are the checks that would have caught it.

Nothing in here decides whether a clip is *good*. See `HumanJudgement` in
packages/pipeline/demo.py for that boundary -- it is not a technicality, it is
the difference between a claim we can support and one we cannot.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import asdict, dataclass, field
from pathlib import Path

# Darkness alone does not make a frame empty, and treating it that way rejects
# a large part of the actual market -- night gameplay, horror games, dimly lit
# streams. A letterboxed dark clip measured a mean luma of 15 with a standard
# deviation of 10.8: plainly visible content, flagged as black by a
# brightness-only rule.
#
# So emptiness is judged by *variation*, and brightness only qualifies it:
#
#   flat   -- almost no variation. Nothing to see, at any brightness. This is
#             what catches both the colour-bar fill and a pure black frame.
#   black  -- dark AND close to featureless.
BLACK_LUMA_THRESHOLD = 18.0
BLACK_STDDEV_THRESHOLD = 6.0
FLAT_FRAME_STDDEV = 3.0

# Below this RMS (dBFS) an audio track is silence for practical purposes.
SILENT_DBFS = -60.0


class MediaError(RuntimeError):
    """Raised when a file is not usable as input, or an output is not watchable."""


def _bin(name: str) -> str:
    path = shutil.which(name)
    if path is None:
        raise MediaError(
            f"{name} not found on PATH. ClipR cannot process video without "
            f"ffmpeg and ffprobe installed."
        )
    return path


def _run(cmd: list[str], timeout: int = 300) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


@dataclass(frozen=True)
class SourceInfo:
    """What ffprobe says about an input file."""
    path: str
    container: str
    duration_seconds: float
    width: int
    height: int
    fps: float
    video_codec: str
    has_audio: bool
    audio_codec: str | None
    audio_channels: int | None
    sample_rate: int | None
    size_bytes: int

    @property
    def is_portrait(self) -> bool:
        return self.height > self.width

    @property
    def aspect(self) -> float:
        return self.width / self.height if self.height else 0.0

    def to_dict(self) -> dict:
        return asdict(self)

    def describe(self) -> str:
        audio = (
            f"{self.audio_codec} {self.audio_channels}ch {self.sample_rate}Hz"
            if self.has_audio else "none"
        )
        return (
            f"  Duration:   {self.duration_seconds:.1f}s "
            f"({self.duration_seconds / 60:.1f} min)\n"
            f"  Resolution: {self.width}x{self.height}"
            f"{' (portrait)' if self.is_portrait else ''}\n"
            f"  FPS:        {self.fps:.2f}\n"
            f"  Video:      {self.video_codec}\n"
            f"  Audio:      {audio}\n"
            f"  Container:  {self.container}\n"
            f"  Size:       {self.size_bytes / 1e6:.1f} MB"
        )


def _parse_fps(rate: str) -> float:
    """`r_frame_rate` comes back as a rational string like '30000/1001'."""
    if not rate or rate == "0/0":
        return 0.0
    if "/" in rate:
        num, _, den = rate.partition("/")
        try:
            return float(num) / float(den) if float(den) else 0.0
        except (ValueError, ZeroDivisionError):
            return 0.0
    try:
        return float(rate)
    except ValueError:
        return 0.0


# Keyed on identity *and* content stamp, so a rewritten file is re-probed
# rather than served stale. Each probe costs an ffprobe plus a one-frame decode,
# and validation alone calls it four times per clip -- worth keeping, not worth
# repeating.
_PROBE_CACHE: dict[tuple[str, int, int], SourceInfo] = {}


def probe(path: str | Path) -> SourceInfo:
    """Inspect an input file, or explain precisely why it cannot be used.

    Every failure here is a message a person can act on. "ffprobe returned 1"
    is not; "this file has no video stream" is.
    """
    p = Path(path).expanduser().resolve()
    try:
        stat = p.stat()
        cache_key: tuple[str, int, int] | None = (
            str(p), stat.st_size, stat.st_mtime_ns)
    except OSError:
        cache_key = None
    if cache_key is not None and cache_key in _PROBE_CACHE:
        return _PROBE_CACHE[cache_key]
    if not p.exists():
        raise MediaError(f"No such file: {p}")
    if p.is_dir():
        raise MediaError(f"{p} is a directory, not a video file.")
    if p.stat().st_size == 0:
        raise MediaError(f"{p} is empty (0 bytes).")

    proc = _run([
        _bin("ffprobe"), "-v", "error", "-show_format", "-show_streams",
        "-of", "json", str(p),
    ])
    if proc.returncode != 0:
        raise MediaError(
            f"ffprobe could not read {p.name}. It may be corrupt or not a media "
            f"file.\n  ffprobe said: {proc.stderr.strip()[:400]}"
        )

    data = json.loads(proc.stdout or "{}")
    streams = data.get("streams", [])
    fmt = data.get("format", {})

    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if video is None:
        raise MediaError(
            f"{p.name} has no video stream. ClipR needs video; an audio-only "
            f"file cannot be reframed into a vertical clip."
        )
    # Cover art in an MP3 is a "video stream" of one frame. Reject it here
    # rather than letting it fail confusingly three stages later.
    if video.get("disposition", {}).get("attached_pic"):
        raise MediaError(
            f"{p.name}'s only video stream is embedded cover art, not footage."
        )

    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)

    duration = float(fmt.get("duration") or video.get("duration") or 0.0)
    if duration <= 0:
        raise MediaError(
            f"{p.name} reports a duration of {duration}s. The file is likely "
            f"truncated or still being written."
        )

    width, height = int(video.get("width") or 0), int(video.get("height") or 0)
    if width <= 0 or height <= 0:
        raise MediaError(f"{p.name} has invalid dimensions ({width}x{height}).")

    fps = _parse_fps(video.get("avg_frame_rate") or video.get("r_frame_rate") or "")
    if fps <= 0:
        raise MediaError(f"{p.name} has an invalid frame rate.")

    info = SourceInfo(
        path=str(p),
        container=(fmt.get("format_name") or "?").split(",")[0],
        duration_seconds=duration,
        width=width,
        height=height,
        fps=fps,
        video_codec=video.get("codec_name") or "?",
        has_audio=audio is not None,
        audio_codec=audio.get("codec_name") if audio else None,
        audio_channels=int(audio["channels"]) if audio and audio.get("channels") else None,
        sample_rate=int(audio["sample_rate"]) if audio and audio.get("sample_rate") else None,
        size_bytes=p.stat().st_size,
    )

    # Prove it decodes, rather than trusting the header. A file can probe
    # perfectly and fail on the first frame.
    check = _run([
        _bin("ffmpeg"), "-nostdin", "-v", "error", "-i", str(p),
        "-frames:v", "1", "-f", "null", "-",
    ], timeout=120)
    if check.returncode != 0:
        raise MediaError(
            f"{p.name} probes as valid but will not decode.\n"
            f"  ffmpeg said: {check.stderr.strip()[:400]}"
        )

    if cache_key is not None:
        _PROBE_CACHE[cache_key] = info
    return info


@dataclass
class FrameSample:
    at_seconds: float
    mean_luma: float
    stddev_luma: float

    @property
    def is_black(self) -> bool:
        """Dark *and* featureless. Dark alone is legitimate content."""
        return (self.mean_luma < BLACK_LUMA_THRESHOLD
                and self.stddev_luma < BLACK_STDDEV_THRESHOLD)

    @property
    def is_flat(self) -> bool:
        """Almost no variation: nothing to see, however bright it is."""
        return self.stddev_luma < FLAT_FRAME_STDDEV


def _frame_stats(path: Path, at: float, grid: tuple[int, int] = (64, 36)) -> tuple[float, float]:
    """Mean and standard deviation of luma in one decoded frame.

    Measured off actual pixels rather than read out of a filter's metadata.
    The first version of this asked `signalstats` for a `YDEV` key, which does
    not exist -- so stddev was silently 0.0 for every frame and the validator
    declared every clip a flat fill. A validator that fails closed on a parsing
    mistake is not much better than no validator, and one that fails *open*
    would have been worse. Decoding 2,304 bytes and doing the arithmetic here
    cannot drift when a filter renames a field.
    """
    w, h = grid
    proc = subprocess.run(
        [
            _bin("ffmpeg"), "-nostdin", "-v", "error", "-ss", f"{at}", "-i", str(path),
            "-frames:v", "1", "-vf", f"scale={w}:{h}", "-pix_fmt", "gray",
            "-f", "rawvideo", "-",
        ],
        capture_output=True, timeout=120,
    )
    data = proc.stdout[: w * h]
    if not data:
        return 0.0, 0.0
    n = len(data)
    mean = sum(data) / n
    variance = sum((v - mean) ** 2 for v in data) / n
    return mean, variance ** 0.5


def sample_frames(path: str | Path, at_fractions=(0.1, 0.5, 0.9)) -> list[FrameSample]:
    """Decode frames at points through the file and measure what is in them."""
    p = Path(path)
    info = probe(p)
    samples: list[FrameSample] = []

    for fraction in at_fractions:
        at = max(0.0, min(info.duration_seconds * fraction,
                          max(0.0, info.duration_seconds - 0.05)))
        mean, stddev = _frame_stats(p, at)
        samples.append(FrameSample(round(at, 2), round(mean, 2), round(stddev, 2)))

    return samples


def audio_rms_dbfs(path: str | Path) -> float | None:
    """Overall RMS level, or None when there is no audio stream."""
    if not probe(path).has_audio:
        return None
    # astats reports at info level. Running it under `-v error` produced no
    # output at all, and the parse below then returned None -- which read as
    # "no audio" rather than "we failed to measure it".
    proc = _run([
        _bin("ffmpeg"), "-nostdin", "-v", "info", "-i", str(path),
        "-af", "astats=measure_perchannel=none", "-f", "null", "-",
    ], timeout=300)
    for line in proc.stderr.splitlines():
        if "RMS level dB" in line:
            value = line.rsplit(":", 1)[1].strip()
            if value in ("-inf", "inf", "nan"):
                return float("-inf")
            try:
                return round(float(value), 2)
            except ValueError:
                return None
    return None


@dataclass
class ValidationResult:
    """Whether a rendered file is *watchable*. Not whether it is good."""
    path: str
    passed: bool
    failures: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    width: int = 0
    height: int = 0
    duration_seconds: float = 0.0
    size_bytes: int = 0
    has_audio: bool = False
    audio_rms_dbfs: float | None = None
    frame_samples: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def validate_output(
    path: str | Path,
    *,
    expect_width: int = 1080,
    expect_height: int = 1920,
    min_seconds: float = 10.0,
    max_seconds: float = 90.0,
    expect_audio: bool = True,
    expect_audible: bool = True,
    min_bytes: int = 50_000,
) -> ValidationResult:
    """Check a rendered clip is something a person could actually watch.

    Container-level checks (exists, dimensions, codec) are necessary and
    nowhere near sufficient -- they all passed on the clip nobody could see
    anything in. The frame sampling below is the part that matters.
    """
    p = Path(path)
    failures: list[str] = []
    warnings: list[str] = []

    if not p.exists():
        return ValidationResult(str(p), False, [f"File was never created: {p}"])

    size = p.stat().st_size
    if size < min_bytes:
        failures.append(
            f"File is {size} bytes, under the {min_bytes} minimum -- a render "
            f"this small is an empty or truncated file, not a clip."
        )

    try:
        info = probe(p)
    except MediaError as exc:
        return ValidationResult(str(p), False, [str(exc)], size_bytes=size)

    if info.width != expect_width or info.height != expect_height:
        failures.append(
            f"Expected {expect_width}x{expect_height}, got {info.width}x{info.height}"
        )
    if info.duration_seconds < min_seconds:
        failures.append(
            f"Clip is {info.duration_seconds:.1f}s, under the {min_seconds}s minimum"
        )
    if info.duration_seconds > max_seconds:
        warnings.append(
            f"Clip is {info.duration_seconds:.1f}s, over the {max_seconds}s "
            f"short-form ceiling"
        )
    if expect_audio and not info.has_audio:
        failures.append("Source had audio but the rendered clip has no audio stream")

    rms = audio_rms_dbfs(p) if info.has_audio else None
    if expect_audio and rms is not None and rms < SILENT_DBFS:
        if expect_audible:
            failures.append(
                f"Audio track is effectively silent ({rms} dBFS). The clip has "
                f"sound on paper and none in practice."
            )
        else:
            # The source was silent too, so silence here is faithful rather than
            # broken. Found on real footage: a file with a real AAC stream
            # carrying digital silence was rendered correctly and then failed
            # its own validation. A validator that fails correct output teaches
            # people to ignore it.
            warnings.append(
                f"Clip audio is silent ({rms} dBFS), matching a silent source. "
                f"Faithful, but there is nothing to hear."
            )

    samples = sample_frames(p)
    black = [s for s in samples if s.is_black]
    flat = [s for s in samples if s.is_flat and not s.is_black]

    if len(black) == len(samples) and samples:
        failures.append(
            "Every sampled frame is black and featureless. The render produced "
            "a valid file with nothing visible in it."
        )
    elif black:
        warnings.append(
            f"{len(black)} of {len(samples)} sampled frames are black "
            f"(at {', '.join(f'{s.at_seconds}s' for s in black)})"
        )
    if len(flat) == len(samples) and samples:
        failures.append(
            "Every sampled frame is a flat fill -- bright, but showing nothing. "
            "This is the colour-bar failure with the brightness turned up."
        )

    return ValidationResult(
        path=str(p.resolve()),
        passed=not failures,
        failures=failures,
        warnings=warnings,
        width=info.width,
        height=info.height,
        duration_seconds=round(info.duration_seconds, 2),
        size_bytes=size,
        has_audio=info.has_audio,
        audio_rms_dbfs=rms,
        frame_samples=[
            {"at": s.at_seconds, "mean_luma": s.mean_luma,
             "stddev_luma": s.stddev_luma, "black": s.is_black, "flat": s.is_flat}
            for s in samples
        ],
    )
