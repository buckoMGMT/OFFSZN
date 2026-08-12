"""Speech to text. Real engines only.

There is no stub in this module, and that is the point of it. The previous
pipeline accepted a `transcript` argument and never produced one -- every
caller passed a dict in, so ClipR had never transcribed anything, and a demo
could print "transcript: ok" having done no speech recognition at all.

Two engines, in preference order:

    faster-whisper   the real one. Word-level timings, punctuation, usable
                     captions. Needs its model weights, which are downloaded
                     once and cached.
    pocketsphinx     a genuine offline decoder whose acoustic model ships
                     inside the wheel, so it runs with no network at all. It
                     is a 2010-era model: it produces real word timings and
                     substantially wrong words.

pocketsphinx is included because "no network" should degrade the product, not
break it. It is *not* included so that a demo can claim success -- every result
carries `quality`, and anything below `GOOD` makes the demo report say the
captions are unreliable rather than quietly burning bad text onto a clip.

If neither engine can run, this raises. It does not invent text.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import wave
from dataclasses import asdict, dataclass, field
from enum import StrEnum
from pathlib import Path

# Both engines want 16 kHz mono PCM, which is also what ffmpeg is happiest
# producing from an arbitrary container.
ASR_SAMPLE_RATE = 16_000


class TranscriptionUnavailable(RuntimeError):
    """No real speech recognition engine could run.

    Raised rather than falling back to placeholder text. A demo that fabricates
    a transcript is worse than one that stops, because the fabrication survives
    into the captions and nobody notices until a customer does.
    """


class Quality(StrEnum):
    GOOD = "good"            # Whisper-class. Captions can be trusted.
    POOR = "poor"            # Real recognition, unreliable words.


@dataclass(frozen=True)
class Word:
    start: float
    end: float
    text: str
    confidence: float | None = None


@dataclass
class Segment:
    start: float
    end: float
    text: str
    words: list[Word] = field(default_factory=list)

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)

    @property
    def words_per_second(self) -> float:
        n = len(self.words) or len(self.text.split())
        return n / self.duration if self.duration > 0 else 0.0


@dataclass
class Transcript:
    segments: list[Segment]
    engine: str
    model: str
    language: str
    quality: Quality
    audio_seconds: float
    seconds_to_transcribe: float

    @property
    def text(self) -> str:
        return " ".join(s.text.strip() for s in self.segments if s.text.strip())

    @property
    def word_count(self) -> int:
        return sum(len(s.words) or len(s.text.split()) for s in self.segments)

    @property
    def is_empty(self) -> bool:
        return not self.text.strip()

    @property
    def trustworthy(self) -> bool:
        """Whether captions built from this may be described as correct."""
        return self.quality is Quality.GOOD and not self.is_empty

    def to_dict(self) -> dict:
        return {
            "engine": self.engine,
            "model": self.model,
            "language": self.language,
            "quality": str(self.quality),
            "trustworthy": self.trustworthy,
            "audio_seconds": round(self.audio_seconds, 2),
            "seconds_to_transcribe": round(self.seconds_to_transcribe, 2),
            "word_count": self.word_count,
            "segments": [
                {"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text,
                 "words": [asdict(w) for w in s.words]}
                for s in self.segments
            ],
        }

    def to_txt(self) -> str:
        lines = []
        for s in self.segments:
            if s.text.strip():
                lines.append(f"[{_ts(s.start)} -> {_ts(s.end)}] {s.text.strip()}")
        return "\n".join(lines)


def _ts(seconds: float) -> str:
    m, s = divmod(max(0.0, seconds), 60)
    h, m = divmod(int(m), 60)
    return f"{h:02d}:{int(m):02d}:{s:06.3f}"


def _ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if path is None:
        raise TranscriptionUnavailable("ffmpeg not found; cannot extract audio.")
    return path


def extract_audio(media_path: str | Path, out_wav: Path) -> Path:
    """Pull a 16 kHz mono WAV out of any container ffmpeg can open."""
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run(
        [
            _ffmpeg(), "-y", "-nostdin", "-v", "error", "-i", str(media_path),
            "-vn", "-ac", "1", "-ar", str(ASR_SAMPLE_RATE), "-c:a", "pcm_s16le",
            str(out_wav),
        ],
        capture_output=True, text=True, timeout=3600,
    )
    if proc.returncode != 0 or not out_wav.exists():
        raise TranscriptionUnavailable(
            f"Could not extract audio: {proc.stderr.strip()[:300]}"
        )
    return out_wav


# --- engines ---------------------------------------------------------------

def _whisper_model_name() -> str:
    return os.environ.get("CLIPR_WHISPER_MODEL", "base.en")


def available_engines() -> dict[str, str]:
    """Which engines could run right now, and why the others could not."""
    status: dict[str, str] = {}

    try:
        import faster_whisper  # noqa: F401
        status["faster-whisper"] = "installed"
    except ImportError:
        status["faster-whisper"] = "not installed (pip install faster-whisper)"

    try:
        import pocketsphinx  # noqa: F401
        status["pocketsphinx"] = "installed (offline model bundled)"
    except ImportError:
        status["pocketsphinx"] = "not installed (pip install pocketsphinx)"

    return status


def _transcribe_whisper(wav: Path, *, language: str | None) -> Transcript:
    from faster_whisper import WhisperModel

    name = _whisper_model_name()
    # int8 on CPU: several times faster than float32 and the accuracy
    # difference does not show up in captions.
    model = WhisperModel(name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        str(wav), language=language, word_timestamps=True, vad_filter=True,
    )

    out: list[Segment] = []
    for seg in segments:
        words = [
            Word(start=round(w.start, 3), end=round(w.end, 3),
                 text=w.word.strip(), confidence=getattr(w, "probability", None))
            for w in (seg.words or []) if w.word.strip()
        ]
        out.append(Segment(start=round(seg.start, 3), end=round(seg.end, 3),
                           text=seg.text.strip(), words=words))

    return Transcript(
        segments=out, engine="faster-whisper", model=name,
        language=getattr(info, "language", language or "en"),
        quality=Quality.GOOD, audio_seconds=_wav_seconds(wav),
        seconds_to_transcribe=0.0,
    )


def _transcribe_pocketsphinx(wav: Path) -> Transcript:
    import pocketsphinx
    from pocketsphinx import Config, Decoder

    model_path = Path(pocketsphinx.get_model_path()) / "en-us"
    config = Config()
    config.set_string("-hmm", str(model_path / "en-us"))
    config.set_string("-lm", str(model_path / "en-us.lm.bin"))
    config.set_string("-dict", str(model_path / "cmudict-en-us.dict"))
    config.set_string("-logfn", os.devnull)

    decoder = Decoder(config)
    with wave.open(str(wav), "rb") as fh:
        raw = fh.readframes(fh.getnframes())

    decoder.start_utt()
    decoder.process_raw(raw, full_utt=True)
    decoder.end_utt()

    words: list[Word] = []
    for seg in decoder.seg():
        token = seg.word
        # <s>, </s> and <sil> are the decoder's own markers, not speech.
        if token.startswith("<") or token.startswith("["):
            continue
        # "the(2)" is the second pronunciation variant of "the".
        token = token.split("(")[0]
        words.append(Word(start=round(seg.start_frame / 100, 3),
                          end=round(seg.end_frame / 100, 3), text=token))

    # Group into caption-sized segments on the pauses between words.
    segments: list[Segment] = []
    current: list[Word] = []
    for word in words:
        if current and (word.start - current[-1].end > 0.6
                        or word.end - current[0].start > 6.0):
            segments.append(Segment(current[0].start, current[-1].end,
                                    " ".join(w.text for w in current), list(current)))
            current = []
        current.append(word)
    if current:
        segments.append(Segment(current[0].start, current[-1].end,
                                " ".join(w.text for w in current), list(current)))

    return Transcript(
        segments=segments, engine="pocketsphinx", model="en-us (bundled)",
        language="en", quality=Quality.POOR, audio_seconds=_wav_seconds(wav),
        seconds_to_transcribe=0.0,
    )


def _wav_seconds(wav: Path) -> float:
    try:
        with wave.open(str(wav), "rb") as fh:
            return fh.getnframes() / float(fh.getframerate() or ASR_SAMPLE_RATE)
    except (wave.Error, OSError):
        return 0.0


def transcribe(
    media_path: str | Path,
    *,
    engine: str = "auto",
    language: str | None = None,
    work_dir: Path | None = None,
) -> Transcript:
    """Transcribe a media file with a real engine, or raise.

    `engine` may be "auto", "faster-whisper" or "pocketsphinx". Naming an
    engine that cannot run is an error rather than a silent downgrade -- if a
    caller asked for Whisper specifically, giving them pocketsphinx output
    labelled as a success is the failure this module exists to prevent.
    """
    import time

    media_path = Path(media_path)
    work_dir = work_dir or media_path.parent
    wav = extract_audio(media_path, Path(work_dir) / f".{media_path.stem}.asr.wav")

    order = ["faster-whisper", "pocketsphinx"] if engine == "auto" else [engine]

    errors: list[str] = []
    for name in order:
        started = time.perf_counter()
        try:
            if name == "faster-whisper":
                result = _transcribe_whisper(wav, language=language)
            elif name == "pocketsphinx":
                result = _transcribe_pocketsphinx(wav)
            else:
                raise TranscriptionUnavailable(f"Unknown engine: {name}")
        except ImportError as exc:
            errors.append(f"{name}: not installed ({exc})")
            continue
        except TranscriptionUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001 - engine failures are varied
            errors.append(f"{name}: {type(exc).__name__}: {str(exc)[:200]}")
            continue

        result.seconds_to_transcribe = round(time.perf_counter() - started, 2)
        return result

    raise TranscriptionUnavailable(
        "No speech recognition engine could run, so there is no transcript.\n"
        "ClipR will not substitute placeholder text and call that a success.\n\n"
        "Tried:\n  " + "\n  ".join(errors) + "\n\n"
        "Fixes:\n"
        "  pip install faster-whisper     (best quality; downloads model weights once)\n"
        "  pip install pocketsphinx       (offline, model bundled, much lower accuracy)\n"
        "  CLIPR_WHISPER_MODEL=/path/to/local/model  to use pre-downloaded weights"
    )


def save(transcript: Transcript, out_dir: Path) -> tuple[Path, Path]:
    """Write transcript.json and transcript.txt; return both paths."""
    out_dir.mkdir(parents=True, exist_ok=True)
    j = out_dir / "transcript.json"
    t = out_dir / "transcript.txt"
    j.write_text(json.dumps(transcript.to_dict(), indent=2))
    t.write_text(transcript.to_txt() + "\n")
    return j, t
