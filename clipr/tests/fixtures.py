"""Media fixtures for integration tests.

These files exist to exercise ffmpeg, the decoders and the filter graphs with
real bytes. They are *test inputs*, not demonstrations: nothing generated here
may be used to show what ClipR's output looks like, because the moments in it
are placed by the same code that is being tested, and a detector scored against
its own fixtures is scored against itself.

Speech is synthesised with espeak-ng when it is available, so the ASR path runs
on a genuine waveform rather than a tone. espeak's formant synthesis is a long
way from human speech and word accuracy on it is poor -- which is fine here,
since these tests check that transcription *runs and lines up*, never that the
words are right.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

SPEECH_LINES = [
    "welcome back everyone to the stream today",
    "we are going to try something completely new",
    "oh my word did you all see that right there",
    "that was absolutely incredible i cannot believe it",
    "okay okay let me calm down for a second",
    "so anyway as i was saying before all of that",
    "and that is how you finish a run like a professional",
]


def have(tool: str) -> bool:
    return shutil.which(tool) is not None


def _run(cmd: list[str], timeout: int = 900) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {proc.stderr[-500:]}")


def speech_wav(path: Path, lines: list[str] | None = None,
               gap_seconds: float = 1.2) -> Path:
    """Concatenate spoken lines with pauses, at varying loudness.

    The loudness variation is what makes this usable for detection tests: a
    file at one level has no moments in it by construction.
    """
    if not have("espeak-ng"):
        raise RuntimeError("espeak-ng not installed")
    lines = lines or SPEECH_LINES
    path.parent.mkdir(parents=True, exist_ok=True)
    parts: list[Path] = []

    for i, line in enumerate(lines):
        raw = path.parent / f".speech_{i}.wav"
        # Faster and louder on the "reaction" lines, so energy and speech rate
        # both move -- the two signals detection leans on hardest.
        excited = "did you all see" in line or "incredible" in line
        _run(["espeak-ng", "-s", "185" if excited else "140",
              "-a", "190" if excited else "95", "-w", str(raw), line])
        parts.append(raw)

    concat = path.parent / ".speech_concat.txt"
    silence = path.parent / ".silence.wav"
    _run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi",
          "-i", f"anullsrc=r=22050:cl=mono:d={gap_seconds}", str(silence)])

    entries = []
    for part in parts:
        entries.append(f"file '{part.name}'")
        entries.append(f"file '{silence.name}'")
    concat.write_text("\n".join(entries) + "\n")

    _run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
          "-i", str(concat), "-ar", "22050", "-ac", "1", str(path)])

    for part in [*parts, silence, concat]:
        part.unlink(missing_ok=True)
    return path


def talking_head(path: Path, *, seconds: float = 60.0, width: int = 1280,
                 height: int = 720, with_audio: bool = True) -> Path:
    """A single subject that moves. Should reframe by tracking."""
    path.parent.mkdir(parents=True, exist_ok=True)
    graph = (
        f"color=c=0x11151a:s={width}x{height}:r=24:d={seconds}[bg];"
        "color=c=0xe8c39a:s=170x210:d=1[head];"
        f"[bg][head]overlay=x='{width // 2 - 85}+230*sin(t/7)':"
        f"y='{height // 2 - 105}+40*sin(t/2.3)':eval=frame[v]"
    )
    cmd = ["ffmpeg", "-y", "-v", "error"]
    if with_audio:
        audio = path.parent / ".th_speech.wav"
        speech_wav(audio)
        cmd += ["-stream_loop", "-1", "-i", str(audio)]
    cmd += ["-filter_complex", graph, "-map", "[v]"]
    if with_audio:
        cmd += ["-map", "0:a", "-c:a", "aac", "-b:a", "96k"]
    cmd += ["-t", str(seconds), "-c:v", "libx264", "-preset", "veryfast",
            "-crf", "28", "-pix_fmt", "yuv420p", str(path)]
    _run(cmd)
    (path.parent / ".th_speech.wav").unlink(missing_ok=True)
    return path


def screen_recording(path: Path, *, seconds: float = 60.0, width: int = 1280,
                     height: int = 720) -> Path:
    """Detail spread across the full width. Should reframe by letterboxing."""
    path.parent.mkdir(parents=True, exist_ok=True)
    vf = (
        "drawtext=text='SCORE 1240   HP 88   AMMO 32   TIMER 0412':"
        "x=20:y=30:fontsize=28:fontcolor=white,"
        "drawtext=text='chat gg / lets go / no way / clip it':"
        "x=20:y=h-60:fontsize=26:fontcolor=0x88ff88,"
        "drawbox=x=10:y=110:w=210:h=210:color=cyan:t=4,"
        "drawbox=x=w-220:y=110:w=210:h=210:color=red:t=4,"
        "drawtext=text='%{pts\\:hms}':x=w/2-80:y=h/2:fontsize=44:fontcolor=yellow"
    )
    _run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi",
          "-i", f"color=c=0x1c1c1c:s={width}x{height}:r=24:d={seconds}",
          "-f", "lavfi", "-i", "sine=frequency=200",
          "-vf", vf, "-t", str(seconds), "-c:v", "libx264", "-preset", "veryfast",
          "-crf", "28", "-c:a", "aac", "-pix_fmt", "yuv420p", "-shortest",
          str(path)])
    return path


def silent_video(path: Path, *, seconds: float = 30.0) -> Path:
    """No audio stream at all. Must not crash the pipeline."""
    path.parent.mkdir(parents=True, exist_ok=True)
    _run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi",
          "-i", f"testsrc2=s=1280x720:r=24:d={seconds}",
          "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
          str(path)])
    return path


def portrait_video(path: Path, *, seconds: float = 30.0) -> Path:
    """Already vertical. Must not be cropped further."""
    path.parent.mkdir(parents=True, exist_ok=True)
    _run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi",
          "-i", f"testsrc2=s=720x1280:r=24:d={seconds}",
          "-f", "lavfi", "-i", "sine=frequency=330",
          "-t", str(seconds), "-c:v", "libx264", "-preset", "veryfast",
          "-c:a", "aac", "-pix_fmt", "yuv420p", "-shortest", str(path)])
    return path


def black_video(path: Path, *, seconds: float = 20.0) -> Path:
    """Valid container, nothing visible. The validator must reject renders of it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    _run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi",
          "-i", f"color=c=black:s=1280x720:r=24:d={seconds}",
          "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
          "-t", str(seconds), "-c:v", "libx264", "-c:a", "aac",
          "-pix_fmt", "yuv420p", "-shortest", str(path)])
    return path
