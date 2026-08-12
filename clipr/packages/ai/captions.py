"""Burned-in captions for vertical short-form.

Captions are not a rendering detail on this product -- most short-form is
watched muted, so a clip with bad captions is a clip nobody watches. Three
things decide whether they work, and all three are easy to get wrong in ways
that only show up on a phone:

*Position.* Every platform covers the bottom of the frame with its own UI --
the caption, the handle, the buttons up the right-hand side. Text placed at
the bottom of a 1920-tall frame is text under a Follow button. The safe band
here is deliberately conservative.

*Line length.* Long lines force small text. Two short lines beat one long one
at arm's length, so cues are packed to a character budget rather than to a
duration.

*Timing.* Word timings when the engine provides them, segment timings when it
does not -- but never a guess dressed up as a word timing.

`render` refuses to report success on an empty cue list. "Captions burned in"
with nothing on screen was one of the claims this codebase used to be able to
make.
"""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from packages.ai.transcribe import Segment, Transcript, Word

# Fractions of frame height reserved at top and bottom on the major vertical
# platforms. The bottom is the big one: caption text, username and the action
# rail all live there. Anything inside these bands is likely to be covered.
PLATFORM_SAFE_TOP = 0.08
PLATFORM_SAFE_BOTTOM = 0.22

# Average glyph advance as a fraction of font size, for DejaVu Sans Bold at
# mixed case. Used to convert "how wide is the safe area" into "how many
# characters fit on a line", so the wrap limit and the overflow check are
# derived from the same number instead of being two constants that disagree.
AVG_GLYPH_EM = 0.58

# Only a fallback for callers with no frame width to hand. Real limits come
# from CaptionStyle.max_chars_per_line().
MAX_CHARS_PER_LINE = 24
MAX_LINES = 2
MIN_CUE_SECONDS = 0.7
MAX_CUE_SECONDS = 3.2
# A pause longer than this ends a cue regardless of how short it is -- holding
# text across a silence makes captions feel out of sync even when they are not.
CUE_BREAK_GAP = 0.5


class CaptionError(RuntimeError):
    pass


@dataclass(frozen=True)
class Cue:
    start: float
    end: float
    lines: list[str]

    @property
    def text(self) -> str:
        return " ".join(self.lines)


@dataclass(frozen=True)
class CaptionStyle:
    """Readable-first defaults, sized for a 1080-wide vertical frame."""
    font: str = "DejaVu Sans"
    # Sized against frame *width*, because horizontal fit is what actually
    # constrains a caption. Sizing against height looks equivalent and is not:
    # on a 9:16 frame it produced 105px text in a 896px-wide safe area, which
    # fits about 15 characters while the wrapper was packing 24 -- so every
    # long cue ran off both sides of the frame.
    font_size_fraction: float = 0.062
    primary: str = "&H00FFFFFF"      # ASS is &HAABBGGRR, not RGB
    outline_colour: str = "&H00000000"
    back_colour: str = "&H80000000"  # 50% black box behind the text
    outline: int = 4
    shadow: int = 2
    bold: int = 1
    # Where the caption block sits, as a fraction of height measured up from
    # the bottom. Must clear PLATFORM_SAFE_BOTTOM.
    baseline_fraction: float = 0.26
    side_margin_fraction: float = 0.085

    def font_size(self, width: int) -> int:
        return max(18, round(width * self.font_size_fraction))

    def margin_v(self, height: int) -> int:
        return max(0, round(height * self.baseline_fraction))

    def margin_h(self, width: int) -> int:
        return max(0, round(width * self.side_margin_fraction))

    def usable_width(self, width: int) -> int:
        return max(1, width - 2 * self.margin_h(width))

    def max_chars_per_line(self, width: int) -> int:
        """How many characters actually fit between the safe margins."""
        glyph = self.font_size(width) * AVG_GLYPH_EM
        return max(8, int(self.usable_width(width) / glyph)) if glyph else MAX_CHARS_PER_LINE


def _wrap(words: list[str], max_chars: int = MAX_CHARS_PER_LINE) -> list[str]:
    """Greedy wrap into at most MAX_LINES lines."""
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and len(candidate) > max_chars:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines[:MAX_LINES] if len(lines) > MAX_LINES else lines


def cues_from_words(words: list[Word], *, offset: float = 0.0,
                    max_chars: int = MAX_CHARS_PER_LINE) -> list[Cue]:
    """Pack word timings into readable cues."""
    cues: list[Cue] = []
    bucket: list[Word] = []

    def flush() -> None:
        if not bucket:
            return
        lines = _wrap([w.text for w in bucket], max_chars)
        start = bucket[0].start - offset
        end = max(bucket[-1].end - offset, start + MIN_CUE_SECONDS)
        cues.append(Cue(round(max(0.0, start), 3), round(end, 3), lines))

    for word in words:
        if bucket:
            gap = word.start - bucket[-1].end
            span = word.end - bucket[0].start
            chars = len(" ".join(w.text for w in bucket)) + 1 + len(word.text)
            if (gap > CUE_BREAK_GAP
                    or span > MAX_CUE_SECONDS
                    or chars > max_chars * MAX_LINES):
                flush()
                bucket = []
        bucket.append(word)
    flush()
    return cues


def cues_from_segments(segments: list[Segment], *, offset: float = 0.0,
                       max_chars: int = MAX_CHARS_PER_LINE) -> list[Cue]:
    """Fallback when an engine gives no word timings.

    Text is split across the segment's span proportionally by length. That is
    an approximation and is only used when there is nothing better -- word
    timings are always preferred.
    """
    cues: list[Cue] = []
    for seg in segments:
        words = seg.text.split()
        if not words:
            continue
        chunks: list[list[str]] = []
        current: list[str] = []
        for word in words:
            if current and len(" ".join([*current, word])) > max_chars * MAX_LINES:
                chunks.append(current)
                current = []
            current.append(word)
        if current:
            chunks.append(current)

        span = max(seg.duration, MIN_CUE_SECONDS * len(chunks))
        total_chars = sum(len(" ".join(c)) for c in chunks) or 1
        cursor = seg.start
        for chunk in chunks:
            share = len(" ".join(chunk)) / total_chars
            length = max(MIN_CUE_SECONDS, span * share)
            cues.append(Cue(round(max(0.0, cursor - offset), 3),
                            round(max(0.0, cursor + length - offset), 3),
                            _wrap(chunk, max_chars)))
            cursor += length
    return cues


def cues_for_clip(transcript: Transcript, start: float, end: float,
                  *, width: int = 1080,
                  style: CaptionStyle | None = None) -> list[Cue]:
    """Cues covering [start, end) of the source, timed relative to the clip."""
    max_chars = (style or CaptionStyle()).max_chars_per_line(width)

    words = [w for s in transcript.segments for w in s.words
             if w.end > start and w.start < end]
    if words:
        clipped = [
            Word(start=max(w.start, start), end=min(w.end, end),
                 text=w.text, confidence=w.confidence)
            for w in words
        ]
        return cues_from_words(clipped, offset=start, max_chars=max_chars)

    segments = [s for s in transcript.segments if s.end > start and s.start < end]
    trimmed = [
        Segment(start=max(s.start, start), end=min(s.end, end), text=s.text)
        for s in segments
    ]
    return cues_from_segments(trimmed, offset=start, max_chars=max_chars)


def _ass_time(seconds: float) -> str:
    seconds = max(0.0, seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def to_ass(cues: list[Cue], width: int, height: int,
           style: CaptionStyle | None = None) -> str:
    """An ASS subtitle file sized for this exact frame."""
    st = style or CaptionStyle()
    size = st.font_size(width)
    mv = st.margin_v(height)
    mh = st.margin_h(width)

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n"
        "WrapStyle: 2\n"          # honour our own line breaks, do not re-wrap
        "ScaledBorderAndShadow: yes\n"
        "YCbCr Matrix: TV.709\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, "
        "ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, "
        "MarginL, MarginR, MarginV, Encoding\n"
        f"Style: ClipR,{st.font},{size},{st.primary},{st.primary},"
        f"{st.outline_colour},{st.back_colour},{st.bold},0,0,0,100,100,0,0,"
        f"1,{st.outline},{st.shadow},2,{mh},{mh},{mv},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, "
        "Effect, Text\n"
    )

    lines = []
    for cue in cues:
        text = r"\N".join(_escape(line) for line in cue.lines)
        lines.append(
            f"Dialogue: 0,{_ass_time(cue.start)},{_ass_time(cue.end)},ClipR,,"
            f"0,0,0,,{text}"
        )
    return header + "\n".join(lines) + "\n"


def _escape(text: str) -> str:
    # Braces open an ASS override block; a literal brace in speech would
    # silently swallow the rest of the line.
    return (text.replace("\\", "")
                .replace("{", "(").replace("}", ")")
                .replace("\n", " ").strip())


def check_fits(cues: list[Cue], width: int, style: CaptionStyle | None = None) -> list[str]:
    """Warn about cues that will overflow the safe area.

    A rough width estimate on purpose: measuring glyphs exactly would need the
    font loaded, and the failure this guards against (a wildly long line) shows
    up clearly at this precision.
    """
    st = style or CaptionStyle()
    max_chars = st.max_chars_per_line(width)

    problems = []
    for cue in cues:
        for line in cue.lines:
            if len(line) > max_chars:
                problems.append(
                    f"{cue.start:.1f}s: {len(line)} chars may overflow "
                    f"(~{max_chars} fit): {line[:40]!r}"
                )
        if len(cue.lines) > MAX_LINES:
            problems.append(f"{cue.start:.1f}s: {len(cue.lines)} lines, max is {MAX_LINES}")
    return problems


@dataclass
class CaptionResult:
    ass_path: Path
    cue_count: int
    word_count: int
    coverage_fraction: float
    warnings: list[str] = field(default_factory=list)
    trustworthy: bool = False

    @property
    def rendered_anything(self) -> bool:
        return self.cue_count > 0


def write_ass(cues: list[Cue], path: Path, width: int, height: int,
              style: CaptionStyle | None = None) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(to_ass(cues, width, height, style), encoding="utf-8")
    return path


def prepare(transcript: Transcript, start: float, end: float, out_path: Path,
            width: int = 1080, height: int = 1920,
            style: CaptionStyle | None = None) -> CaptionResult:
    """Build the subtitle file for one clip and report honestly on it."""
    cues = cues_for_clip(transcript, start, end, width=width, style=style)
    write_ass(cues, out_path, width, height, style)

    duration = max(1e-6, end - start)
    covered = sum(max(0.0, c.end - c.start) for c in cues)
    warnings = check_fits(cues, width, style)

    if not cues:
        warnings.append(
            "No speech found in this span, so the clip has no captions. "
            "This is not a rendering failure -- there were no words to draw."
        )
    if not transcript.trustworthy and cues:
        warnings.append(
            f"Captions came from the {transcript.engine} engine "
            f"(quality: {transcript.quality}). The words on screen are very "
            f"likely wrong; do not judge caption accuracy from this render."
        )

    return CaptionResult(
        ass_path=out_path,
        cue_count=len(cues),
        word_count=sum(len(c.text.split()) for c in cues),
        coverage_fraction=round(min(1.0, covered / duration), 3),
        warnings=warnings,
        trustworthy=transcript.trustworthy and bool(cues),
    )


def ass_filter(path: Path) -> str:
    """An `ass=` filter fragment with the path escaped for ffmpeg.

    Filter-graph parsing eats colons, backslashes and commas, so a perfectly
    ordinary path like `/tmp/my clips/a,b.ass` breaks the graph rather than the
    file lookup -- which produces a confusing error a long way from the cause.
    """
    escaped = (str(path).replace("\\", "/")
                        .replace(":", r"\:")
                        .replace("'", r"\'")
                        .replace(",", r"\,")
                        .replace("[", r"\[")
                        .replace("]", r"\]"))
    return f"ass='{escaped}'"


def fonts_available() -> bool:
    fc = shutil.which("fc-list")
    if fc is None:
        return False
    proc = subprocess.run([fc], capture_output=True, text=True, timeout=60)
    return proc.returncode == 0 and bool(proc.stdout.strip())
