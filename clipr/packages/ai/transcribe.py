"""Speech to text. Real engines only.

There is no stub in this module, and that is the point of it. The previous
pipeline accepted a `transcript` argument and never produced one -- every
caller passed a dict in, so ClipR had never transcribed anything, and a demo
could print "transcript: ok" having done no speech recognition at all.

Two engines, in preference order:

    faster-whisper   the real one. Word-level timings, punctuation, usable
                     captions, and whole-file context so phrases are not split.
                     Needs its model weights, downloaded once and cached.

    sherpa-onnx      the same Whisper weights through ONNX, from a plain file.
                     Runs where Hugging Face is unreachable. Two costs, both
                     structural: timings come from VAD rather than the decoder,
                     and each speech span is transcribed independently, so a
                     phrase split across a VAD boundary loses the context that
                     would have disambiguated it. Padding each span helps and
                     does not eliminate it -- "Americans ask not what" can come
                     back as "Americans. AS NOT! What". Prefer faster-whisper
                     wherever it can reach its weights.
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
    """How much the *words* can be trusted."""
    GOOD = "good"            # Whisper-class. Captions can be trusted.
    POOR = "poor"            # Real recognition, unreliable words.


class Timing(StrEnum):
    """How much the *timings* can be trusted.

    Separate from Quality because they fail independently, and captions need
    both. An engine can return perfect words with no timing information at all
    (Whisper via ONNX does exactly that), which produces correct captions that
    drift out of sync -- a different defect from correct timing on wrong words.
    """
    EXACT = "exact"              # per-word timings from the decoder
    APPROXIMATE = "approximate"  # real segment bounds, words spread within them


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
    word_timing: Timing = Timing.EXACT

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
            "word_timing": str(self.word_timing),
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
        import sherpa_onnx  # noqa: F401
        found = _find_sherpa_whisper()
        status["sherpa-onnx-whisper"] = (
            f"installed, model {found['name']}" if found
            else "installed but no model on disk (see _transcribe_sherpa docstring)")
    except ImportError:
        status["sherpa-onnx-whisper"] = "not installed (pip install sherpa-onnx)"

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


# Where a self-hosted Whisper lives. Searched in order; the first hit wins.
# Weights are ordinary files on disk, not a hosted API -- ASR is a cost line in
# the margin model, and paying per minute for someone else's endpoint is what
# turns a 55% gross margin into a 20% one.
# No world-writable directory belongs on this list. Model weights are code in
# every sense that matters -- they are loaded and executed by the ONNX runtime
# -- so searching /tmp or /var/tmp would let any local user drop in a file we
# then run. Each entry below is either explicitly configured or writable only
# by the owner.
SHERPA_SEARCH_PATHS = (
    "CLIPR_ASR_MODEL_DIR",           # explicit override, checked as an env var
    "models",                        # ./models in the project
    "~/.cache/clipr/models",
    "/opt/clipr/models",
)


def _find_sherpa_whisper() -> dict | None:
    """Locate a sherpa-onnx Whisper model on disk.

    Returns the three file paths it needs, or None. Prefers int8 weights: on
    CPU they run several times faster and the difference does not show up in a
    caption.
    """
    roots: list[Path] = []
    for entry in SHERPA_SEARCH_PATHS:
        raw = os.environ.get(entry) if entry.isupper() else entry
        if raw:
            roots.append(Path(raw).expanduser())

    for root in roots:
        if not root.is_dir():
            continue
        for candidate in sorted(root.glob("sherpa-onnx-whisper-*")) + [root]:
            if not candidate.is_dir():
                continue
            tokens = sorted(candidate.glob("*-tokens.txt"))
            if not tokens:
                continue
            encoders = (sorted(candidate.glob("*-encoder.int8.onnx"))
                        or sorted(candidate.glob("*-encoder.onnx")))
            decoders = (sorted(candidate.glob("*-decoder.int8.onnx"))
                        or sorted(candidate.glob("*-decoder.onnx")))
            if encoders and decoders:
                return {
                    "encoder": str(encoders[0]),
                    "decoder": str(decoders[0]),
                    "tokens": str(tokens[0]),
                    "name": candidate.name,
                    "vad": next((str(p) for p in
                                 (candidate / "silero_vad.onnx",
                                  candidate.parent / "silero_vad.onnx")
                                 if p.exists()), None),
                }
    return None


def _read_wav_mono(wav: Path):
    import numpy as np

    with wave.open(str(wav), "rb") as fh:
        rate = fh.getframerate()
        raw = fh.readframes(fh.getnframes())
    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    return samples, rate


def _vad_segments(samples, rate: int, vad_model: str) -> list[tuple[float, float]]:
    """Split audio into spans of actual speech.

    This is what makes Whisper-via-ONNX usable for captions. The decoder
    returns words with no timings at all, so without speech boundaries the only
    option is to spread a whole file's words evenly across it -- captions that
    are correct and completely out of sync. VAD gives real start and end times
    per utterance, and words are distributed inside spans that are a few
    seconds long, where the error is small enough not to read as drift.
    """
    import sherpa_onnx

    config = sherpa_onnx.VadModelConfig()
    config.silero_vad.model = vad_model
    config.silero_vad.threshold = 0.5
    config.silero_vad.min_silence_duration = 0.35
    config.silero_vad.min_speech_duration = 0.2
    # Whisper's receptive field is 30s; staying well under it keeps each
    # utterance inside a single encoder window.
    config.silero_vad.max_speech_duration = 12.0
    config.sample_rate = rate

    detector = sherpa_onnx.VoiceActivityDetector(config, buffer_size_in_seconds=120)
    spans: list[tuple[float, float]] = []

    def drain() -> None:
        while not detector.empty():
            seg = detector.front
            spans.append((seg.start / rate, (seg.start + len(seg.samples)) / rate))
            detector.pop()

    window = 512
    for i in range(0, len(samples), window):
        detector.accept_waveform(samples[i:i + window])
        drain()
    detector.flush()
    drain()
    return spans


def _spread_words(text: str, start: float, end: float) -> list[Word]:
    """Lay a segment's words across its span, weighted by length.

    Longer words take longer to say. Weighting by character count is a better
    approximation than an even split and costs nothing.
    """
    tokens = text.split()
    if not tokens:
        return []
    total = sum(len(t) for t in tokens) or len(tokens)
    span = max(0.05, end - start)
    words: list[Word] = []
    cursor = start
    for token in tokens:
        share = (len(token) / total) * span
        words.append(Word(start=round(cursor, 3),
                          end=round(min(end, cursor + share), 3), text=token))
        cursor += share
    return words


def _transcribe_sherpa(wav: Path) -> Transcript:
    """Whisper weights running locally through ONNX, no hosted API."""
    import sherpa_onnx

    model = _find_sherpa_whisper()
    if model is None:
        raise TranscriptionUnavailable(
            "No sherpa-onnx Whisper model found. Fetch one with:\n"
            "  mkdir -p models && cd models\n"
            "  curl -sSL -O https://github.com/k2-fsa/sherpa-onnx/releases/"
            "download/asr-models/sherpa-onnx-whisper-base.en.tar.bz2\n"
            "  tar xjf sherpa-onnx-whisper-base.en.tar.bz2\n"
            "  curl -sSL -O https://github.com/k2-fsa/sherpa-onnx/releases/"
            "download/asr-models/silero_vad.onnx\n"
            "Or set CLIPR_ASR_MODEL_DIR to wherever it already lives."
        )

    recognizer = sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=model["encoder"], decoder=model["decoder"], tokens=model["tokens"],
        num_threads=max(2, (os.cpu_count() or 4) // 2),
    )
    samples, rate = _read_wav_mono(wav)
    duration = len(samples) / rate if rate else 0.0

    spans: list[tuple[float, float]] = []
    if model["vad"]:
        spans = _vad_segments(samples, rate, model["vad"])

    if not spans and duration > 0:
        # VAD found nothing. That is often correct -- a music bed has no speech
        # -- but "the speech detector abstained" must not silently become "this
        # file has no transcript". Silero is trained on speech and rejects
        # singing outright, so a sung hook, a heavily processed voice, or a
        # noisy stream can all come back empty. Fall back to fixed windows and
        # let the recogniser decide; if there really are no words it returns
        # nothing, which is a conclusion rather than an omission.
        spans = [(float(t), min(duration, t + 12.0))
                 for t in range(0, max(1, int(duration)), 12)]

    if not spans:
        return Transcript([], "sherpa-onnx-whisper", model["name"], "en",
                          Quality.GOOD, duration, 0.0, Timing.APPROXIMATE)

    # Feed each span with a little audio either side of it.
    #
    # VAD marks where speech is, not where a *phrase* is, and it will happily
    # cut between two words of one. Whisper then transcribes each side without
    # the other's context and guesses: "Americans ask not what" came back as
    # "American S not What" purely because the boundary landed mid-phrase.
    # A fifth of a second of lead-in and tail costs nothing and gives the
    # decoder the run-up it needs. The *reported* timings stay the VAD ones --
    # the padding is for the recogniser, not for the captions.
    pad = 0.25
    streams = []
    for start, end in spans:
        lo = int(max(0.0, start - pad) * rate)
        hi = int(min(duration, end + pad) * rate)
        stream = recognizer.create_stream()
        stream.accept_waveform(rate, samples[lo:hi])
        streams.append(stream)

    batch = 8
    for i in range(0, len(streams), batch):
        recognizer.decode_streams(streams[i:i + batch])

    segments: list[Segment] = []
    for (start, end), stream in zip(spans, streams, strict=True):
        text = (stream.result.text or "").strip()
        if not text:
            continue
        segments.append(Segment(start=round(start, 3), end=round(end, 3),
                                text=text, words=_spread_words(text, start, end)))

    return Transcript(
        segments=segments, engine="sherpa-onnx-whisper", model=model["name"],
        language="en", quality=Quality.GOOD, audio_seconds=duration,
        seconds_to_transcribe=0.0, word_timing=Timing.APPROXIMATE,
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

    order = (["faster-whisper", "sherpa-onnx-whisper", "pocketsphinx"]
             if engine == "auto" else [engine])

    errors: list[str] = []
    for name in order:
        started = time.perf_counter()
        try:
            if name == "faster-whisper":
                result = _transcribe_whisper(wav, language=language)
            elif name == "sherpa-onnx-whisper":
                result = _transcribe_sherpa(wav)
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
