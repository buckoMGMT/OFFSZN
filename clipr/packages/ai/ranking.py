"""Deciding which moments are worth a creator's time, and where they start.

Detection (`signals.py`) answers "where did something happen". That is not the
product. A loud moment is not a good clip, motion is not a good clip, and a
scene change is definitely not a good clip. This module answers the question
that matters: *would somebody post this*.

It scores each candidate on dimensions that fail independently, because a
single number hides which part is broken:

    hook          does something happen in the first three seconds
    payoff        is there a reaction, punchline, reveal or result
    energy        does activity rise across the moment
    context       can it be understood without the previous five minutes
    speech        clear talking, not filler and dead air
    visual        can a decent vertical frame be made of it
    completeness  beginning, middle and end rather than a slice
    novelty       is this a different moment from the ones already picked

The combination is `clip_score`, and it means **ClipR thinks this is worth
reviewing**. It is deliberately not called a virality score. Nothing here has
been shown to correlate with how a post performs, and naming it after an
outcome we have never measured would be inventing precision we have not earned.

Two behaviours matter as much as the scoring:

*Boundaries.* Finding the peak is the easy half. A clip that opens mid-sentence
reads as broken however good the moment is, so cut points are moved to sentence
edges and to the setup that makes the payoff land.

*Abstention.* If a VOD has one good moment, this returns one. Manufacturing
three because a UI expects three is how a product teaches its users to stop
trusting it.
"""

from __future__ import annotations

import math
import re
from dataclasses import asdict, dataclass, field

from packages.ai.signals import Candidate, _slice
from packages.ai.transcribe import Transcript

# --- Ranking V1: frozen -----------------------------------------------------
#
# Every weight, threshold and marker word below is a prior. Not one of them has
# met a creator, and the honest description of this model is "a hypothesis with
# good ergonomics".
#
# It is frozen at v1 so that it can be *measured*. The failure this prevents is
# the obvious one: run a VOD, dislike a pick, nudge a weight, run again, feel
# better. That produces a model tuned to whoever was in the room and a number
# that means nothing, because the thing being measured changed between
# measurements.
#
# The rule until the first dataset is collected: no weight, threshold or word
# list in this file changes. Results carry RANKING_VERSION, verdicts record it,
# and a change of any constant here is a version bump -- so any comparison
# across versions is visible rather than silent.
RANKING_VERSION = "v1"

# Below this, a candidate is not offered at all.
MINIMUM_CLIP_SCORE = 45.0

MIN_CLIP_SECONDS = 12.0
MAX_CLIP_SECONDS = 60.0
IDEAL_CLIP_SECONDS = 32.0

# How far the boundary search may travel from the detected peak.
BOUNDARY_SEARCH_BACK = 22.0
BOUNDARY_SEARCH_FORWARD = 25.0

WEIGHTS = {
    "hook": 0.22,
    "payoff": 0.20,
    "energy": 0.14,
    "context": 0.14,
    "speech": 0.12,
    "visual": 0.10,
    "completeness": 0.08,
}

# Openers that waste the only three seconds that decide whether a viewer stays.
FILLERS = {
    "um", "uh", "erm", "ah", "eh", "hmm", "mm", "like", "so", "basically",
    "anyway", "anyways", "yeah", "okay", "ok", "right", "well", "actually",
    "literally", "honestly", "i mean", "you know", "kind of", "sort of",
}

# Words that tend to sit on top of the thing worth clipping. Deliberately
# shallow: this is a prior, not a classifier, and it is visible in the
# explanation so a wrong call can be seen rather than guessed at.
PAYOFF_MARKERS = {
    "laughter", "laughs", "laughing", "oh my god", "no way", "what the",
    "let's go", "lets go", "insane", "unbelievable", "actually", "wait",
    "holy", "that's crazy", "thats crazy", "i can't", "i cant", "gg",
    "clutch", "perfect", "finally", "there it is", "got him", "got em",
    "are you kidding", "no shot", "sheesh", "damn", "wow", "incredible",
    "turns out", "the point is", "here's the thing", "heres the thing",
}

# Openers that need the previous five minutes to make sense.
DEPENDENT_OPENERS = {
    "and", "but", "so", "then", "because", "which", "also", "anyway",
    "that's why", "thats why", "he", "she", "they", "it", "them", "this",
    "that", "those", "these",
}

QUESTION_OR_SETUP = {
    "what", "why", "how", "when", "where", "who", "did", "do", "does",
    "have", "has", "is", "are", "can", "could", "would", "should", "let me",
    "here's", "heres", "listen", "check", "watch", "look", "imagine",
}

SENTENCE_END = re.compile(r"[.!?]+$")


@dataclass
class Sentence:
    start: float
    end: float
    text: str

    @property
    def first_word(self) -> str:
        words = self.text.strip().split()
        return words[0].lower().strip(".,!?") if words else ""


def sentence_spans(transcript: Transcript | None) -> list[Sentence]:
    """Rebuild sentences from word timings and punctuation.

    Whisper punctuates, which is what makes sentence-aware cutting possible at
    all. Segments are not sentences -- a segment is however much audio the
    decoder chose to batch -- so boundaries are recovered from the words.
    """
    if transcript is None:
        return []

    sentences: list[Sentence] = []
    current: list = []
    for segment in transcript.segments:
        words = segment.words or []
        if not words:
            if segment.text.strip():
                sentences.append(Sentence(segment.start, segment.end,
                                          segment.text.strip()))
            continue
        for word in words:
            current.append(word)
            if SENTENCE_END.search(word.text):
                sentences.append(Sentence(
                    current[0].start, current[-1].end,
                    " ".join(w.text for w in current).strip()))
                current = []
    if current:
        sentences.append(Sentence(current[0].start, current[-1].end,
                                  " ".join(w.text for w in current).strip()))
    return sentences


def words_in(transcript: Transcript | None, start: float, end: float) -> list:
    if transcript is None:
        return []
    return [w for s in transcript.segments for w in s.words
            if w.start >= start and w.end <= end]


def text_in(transcript: Transcript | None, start: float, end: float) -> str:
    return " ".join(w.text for w in words_in(transcript, start, end))


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


# --- boundaries ------------------------------------------------------------

@dataclass
class Boundaries:
    start: float
    end: float
    why: list[str] = field(default_factory=list)


def refine_boundaries(candidate: Candidate, sentences: list[Sentence],
                      duration: float) -> Boundaries:
    """Find the story around the event, not just the event.

    Backwards to the sentence that sets the moment up; forwards to the end of
    the sentence that pays it off. A 35-second clip with its setup intact beats
    a 45-second one that opens halfway through a word.
    """
    why: list[str] = []
    peak = candidate.start
    target_end = candidate.end

    if not sentences:
        return Boundaries(
            max(0.0, peak), min(duration, max(peak + MIN_CLIP_SECONDS, target_end)),
            ["no transcript; boundaries left at the detected window"],
        )

    # --- start: the sentence that begins the thought
    lower = max(0.0, peak - BOUNDARY_SEARCH_BACK)
    openers = [s for s in sentences if lower <= s.start <= peak + 2.0]
    if openers:
        # Prefer a sentence that stands on its own: a question or a setup line
        # rather than one that opens with "and" or a bare pronoun.
        independent = [s for s in openers if s.first_word in QUESTION_OR_SETUP]
        chosen = independent[-1] if independent else openers[0]
        start = chosen.start
        if independent:
            why.append(f"starts on a setup line: \"{chosen.text[:48]}\"")
        else:
            why.append("starts at a sentence boundary")
    else:
        start = peak
        why.append("no sentence boundary nearby; starting at the detected peak")

    # Never travel so far back that the payoff is buried.
    if peak - start > BOUNDARY_SEARCH_BACK:
        start = peak - BOUNDARY_SEARCH_BACK

    # --- end: finish the sentence, and let a reaction land
    upper = min(duration, target_end + BOUNDARY_SEARCH_FORWARD)
    closers = [s for s in sentences if target_end - 4.0 <= s.end <= upper]
    if closers:
        end = closers[0].end + 0.6
        # If a short reaction follows immediately, keep it -- that is the payoff.
        for nxt in sentences:
            if 0 <= nxt.start - end <= 1.6 and nxt.end - nxt.start <= 4.0:
                if any(m in nxt.text.lower() for m in PAYOFF_MARKERS):
                    end = nxt.end + 0.4
                    why.append(f"held for the reaction: \"{nxt.text[:36]}\"")
                break
        why.append("ends on a completed sentence")
    else:
        end = target_end
        why.append("no sentence end nearby; ending at the detected window")

    start = max(0.0, start)
    end = min(duration, end)

    if end - start < MIN_CLIP_SECONDS:
        end = min(duration, start + MIN_CLIP_SECONDS)
    if end - start > MAX_CLIP_SECONDS:
        # Keep the payoff: trim the setup rather than the ending.
        start = max(0.0, end - MAX_CLIP_SECONDS)
        why.append(f"trimmed to the {MAX_CLIP_SECONDS:.0f}s ceiling, keeping the ending")

    # Floor the start and ceil the end rather than rounding to nearest. Nearest
    # rounding moved a start from 0.248 to 0.25 and pushed it past the first
    # word of the sentence it had just been aligned to -- the clip opened on
    # "back everyone to the stream" instead of "welcome back everyone". Two
    # milliseconds is inaudible; losing the first word is not.
    return Boundaries(math.floor(start * 100) / 100,
                      math.ceil(end * 100) / 100, why)


# --- dimensions ------------------------------------------------------------

def score_hook(start: float, end: float, transcript: Transcript | None,
               sentences: list[Sentence], loudness: list[float],
               duration: float) -> tuple[float, str]:
    """The first three seconds decide whether anybody sees the rest."""
    window = min(3.0, end - start)
    opening = text_in(transcript, start, start + window).strip()

    if not opening:
        # Silence can be a hook in a visual moment, but it usually is not.
        head = _slice(loudness, start, start + window, duration)
        audible = [v for v in head if v > -119]
        if not audible:
            return 18.0, "opens on silence"
        return 42.0, "opens without speech"

    score = 62.0
    notes: list[str] = []
    words = opening.lower().split()

    first_two = " ".join(words[:2]) if words else ""
    if words and (words[0].strip(".,") in FILLERS or first_two in FILLERS):
        score -= 22
        notes.append(f"opens on filler (\"{words[0]}\")")

    starts_sentence = any(abs(s.start - start) < 1.2 for s in sentences)
    if starts_sentence:
        score += 14
        notes.append("opens at the start of a sentence")
    else:
        score -= 16
        notes.append("opens mid-sentence")

    if words and words[0].strip(".,?") in QUESTION_OR_SETUP:
        score += 12
        notes.append("opens on a question or setup")

    if any(m in opening.lower() for m in PAYOFF_MARKERS):
        score += 14
        notes.append("something happens immediately")

    # Words actually being said, rather than a slow lead-in.
    rate = len(words) / max(1e-6, window)
    if rate >= 2.0:
        score += 8
    elif rate < 0.8:
        score -= 10
        notes.append("slow opening")

    return _clamp(score), "; ".join(notes) or "ordinary opening"


def score_payoff(start: float, end: float, transcript: Transcript | None,
                 loudness: list[float], duration: float) -> tuple[float, str]:
    """Is there a reaction, a reveal, a result -- something that lands."""
    text = text_in(transcript, start, end).lower()
    score = 40.0
    notes: list[str] = []

    hits = sorted({m for m in PAYOFF_MARKERS if m in text})
    if hits:
        score += min(30.0, 11.0 * len(hits))
        notes.append(f"reaction language ({', '.join(hits[:3])})")

    # An energy peak in the back half is the shape of a payoff; a peak at the
    # very start usually means the clip began too late.
    window = _slice(loudness, start, end, duration)
    audible = [v for v in window if v > -119]
    if len(audible) >= 4:
        half = len(audible) // 2
        front_peak = max(audible[:half])
        back_peak = max(audible[half:])
        if back_peak > front_peak + 1.5:
            score += 18
            notes.append("loudest moment is in the second half")
        elif front_peak > back_peak + 4:
            score -= 12
            notes.append("peaks at the very start; the clip may begin too late")

    if "?" in text and text.strip().endswith("?"):
        score -= 8
        notes.append("ends on an unanswered question")

    return _clamp(score), "; ".join(notes) or "no clear payoff detected"


def score_energy(start: float, end: float, loudness: list[float],
                 motion: list[float], duration: float,
                 baseline_dbfs: float) -> tuple[float, str]:
    window = _slice(loudness, start, end, duration)
    audible = [v for v in window if v > -119]
    score = 45.0
    notes: list[str] = []

    if audible:
        peak = max(audible)
        over = peak - baseline_dbfs
        score += _clamp(over * 2.2, 0, 32)
        if over > 6:
            notes.append(f"{over:.0f} dB over the file's baseline")
        quiet = sum(1 for v in window if v <= -119) / max(1, len(window))
        if quiet > 0.5:
            score -= 25
            notes.append("more than half of it is silence")

    move = _slice(motion, start, end, duration)
    if move:
        mean_motion = sum(move) / len(move)
        if mean_motion > 0.02:
            score += 10
            notes.append("visually active")

    return _clamp(score), "; ".join(notes) or "steady energy"


def score_context(start: float, sentences: list[Sentence],
                  transcript: Transcript | None, end: float) -> tuple[float, str]:
    """Can this be understood cold, without the previous five minutes."""
    text = text_in(transcript, start, end).strip()
    if not text:
        return 50.0, "no speech to judge context from"

    score = 60.0
    notes: list[str] = []
    words = text.lower().split()
    opener = words[0].strip(".,!?") if words else ""

    if opener in DEPENDENT_OPENERS:
        score -= 26
        notes.append(f"opens on \"{opener}\", which refers back to something unseen")
    elif any(abs(s.start - start) < 1.2 for s in sentences):
        score += 16
        notes.append("begins a new sentence")

    # Unanchored pronouns early on are the usual reason a clip is confusing.
    head = " ".join(words[:14])
    pronouns = sum(1 for p in ("he", "she", "they", "it", "him", "her", "them")
                   if f" {p} " in f" {head} ")
    if pronouns >= 2:
        score -= 14
        notes.append("several unexplained pronouns in the opening")

    if any(w in words[:12] for w in ("so", "basically", "anyway")):
        score -= 6

    return _clamp(score), "; ".join(notes) or "reasonably self-contained"


def score_speech(start: float, end: float, transcript: Transcript | None,
                 loudness: list[float], duration: float) -> tuple[float, str]:
    words = words_in(transcript, start, end)
    span = max(1e-6, end - start)
    score = 50.0
    notes: list[str] = []

    if not words:
        return 30.0, "no speech in this span"

    rate = len(words) / span
    # Conversational English sits around 2.3-3.3 words a second. Too slow reads
    # as dead air; too fast is usually a transcription artefact.
    if 1.8 <= rate <= 3.6:
        score += 22
    elif rate < 1.0:
        score -= 18
        notes.append(f"sparse speech ({rate:.1f} words/sec)")
    elif rate > 4.5:
        score -= 8

    fillers = sum(1 for w in words if w.text.lower().strip(".,!?") in FILLERS)
    filler_ratio = fillers / len(words)
    if filler_ratio > 0.18:
        score -= 20
        notes.append(f"{filler_ratio:.0%} filler words")
    elif filler_ratio < 0.06:
        score += 8

    quiet = _slice(loudness, start, end, duration)
    if quiet:
        dead = sum(1 for v in quiet if v <= -119) / len(quiet)
        if dead > 0.35:
            score -= 15
            notes.append(f"{dead:.0%} dead air")

    return _clamp(score), "; ".join(notes) or "clear, steady speech"


def score_visual(framing_confidence: float, strategy: str) -> tuple[float, str]:
    score = 40.0 + framing_confidence * 45.0
    note = f"framing confidence {framing_confidence:.2f} ({strategy})"
    if strategy == "letterbox_blur":
        # Nothing is destroyed, but it is the least native-looking result.
        score -= 8
        note += "; whole frame kept rather than cropped"
    return _clamp(score), note


def score_completeness(start: float, end: float, sentences: list[Sentence],
                       boundaries: Boundaries) -> tuple[float, str]:
    span = end - start
    score = 50.0
    notes: list[str] = []

    if any("sentence boundary" in w or "setup line" in w for w in boundaries.why):
        score += 18
        notes.append("starts cleanly")
    if any("completed sentence" in w for w in boundaries.why):
        score += 16
        notes.append("ends cleanly")
    if any("reaction" in w for w in boundaries.why):
        score += 8

    # Distance from the length that tends to hold attention.
    score -= min(20.0, abs(span - IDEAL_CLIP_SECONDS) * 0.8)

    inside = [s for s in sentences if s.start >= start and s.end <= end]
    if len(inside) >= 3:
        score += 8
        notes.append(f"{len(inside)} complete sentences")
    elif len(inside) <= 1 and sentences:
        score -= 10
        notes.append("barely a complete thought")

    return _clamp(score), "; ".join(notes) or f"{span:.0f}s long"


# --- ranking ---------------------------------------------------------------

@dataclass
class RankedClip:
    start: float
    end: float
    clip_score: float
    dimensions: dict[str, float]
    explanations: dict[str, str]
    boundary_notes: list[str]
    detection_reasons: list[str]
    hook_text: str
    text: str

    @property
    def duration(self) -> float:
        return self.end - self.start

    def to_dict(self) -> dict:
        d = asdict(self)
        d["start"] = round(self.start, 2)
        d["end"] = round(self.end, 2)
        d["duration"] = round(self.duration, 2)
        d["clip_score"] = round(self.clip_score, 1)
        d["dimensions"] = {k: round(v, 1) for k, v in self.dimensions.items()}
        return d

    def why(self) -> str:
        top = sorted(self.dimensions.items(), key=lambda kv: -kv[1])[:3]
        return "; ".join(f"{k} {v:.0f}" for k, v in top)


def _similarity(a: str, b: str) -> float:
    """Word overlap. Two views of one moment share most of their words."""
    wa = {w for w in a.lower().split() if len(w) > 3}
    wb = {w for w in b.lower().split() if len(w) > 3}
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / min(len(wa), len(wb))


def rank(
    candidates: list[Candidate],
    *,
    transcript: Transcript | None,
    loudness: list[float],
    motion: list[float],
    duration: float,
    baseline_dbfs: float,
    framing_for=None,
    wanted: int = 3,
    minimum: float = MINIMUM_CLIP_SCORE,
) -> tuple[list[RankedClip], dict]:
    """Score, re-cut, de-duplicate and select.

    `framing_for(start, end)` returns (confidence, strategy) so the visual
    dimension can be measured without this module importing the reframer and
    deciding when to run it.
    """
    sentences = sentence_spans(transcript)
    scored: list[RankedClip] = []

    for cand in candidates:
        bounds = refine_boundaries(cand, sentences, duration)
        start, end = bounds.start, bounds.end
        if end - start < MIN_CLIP_SECONDS:
            continue

        confidence, strategy = (framing_for(start, end) if framing_for
                                else (0.5, "unknown"))

        dims: dict[str, float] = {}
        why: dict[str, str] = {}
        dims["hook"], why["hook"] = score_hook(
            start, end, transcript, sentences, loudness, duration)
        dims["payoff"], why["payoff"] = score_payoff(
            start, end, transcript, loudness, duration)
        dims["energy"], why["energy"] = score_energy(
            start, end, loudness, motion, duration, baseline_dbfs)
        dims["context"], why["context"] = score_context(
            start, sentences, transcript, end)
        dims["speech"], why["speech"] = score_speech(
            start, end, transcript, loudness, duration)
        dims["visual"], why["visual"] = score_visual(confidence, strategy)
        dims["completeness"], why["completeness"] = score_completeness(
            start, end, sentences, bounds)

        total = sum(dims[k] * w for k, w in WEIGHTS.items())
        text = text_in(transcript, start, end)
        scored.append(RankedClip(
            start=start, end=end, clip_score=total, dimensions=dims,
            explanations=why, boundary_notes=bounds.why,
            detection_reasons=cand.reasons,
            hook_text=text_in(transcript, start, start + 3.0),
            text=text,
        ))

    scored.sort(key=lambda c: c.clip_score, reverse=True)

    # De-duplicate: three views of one moment is one clip. Overlap in time or
    # in what is actually said both count -- a shifted window keeps most of the
    # words even when the spans barely intersect.
    selected: list[RankedClip] = []
    dropped_duplicates = 0
    for clip in scored:
        duplicate = False
        for kept in selected:
            overlap = min(clip.end, kept.end) - max(clip.start, kept.start)
            time_dup = overlap > 0 and overlap / min(clip.duration, kept.duration) > 0.3
            text_dup = _similarity(clip.text, kept.text) > 0.55
            if time_dup or text_dup:
                duplicate = True
                break
        if duplicate:
            dropped_duplicates += 1
            continue
        selected.append(clip)

    # Novelty is only meaningful against what was already chosen, so it is
    # applied after de-duplication rather than as an eighth weighted input.
    for position, clip in enumerate(selected):
        clip.dimensions["novelty"] = 100.0 if position == 0 else _clamp(
            100.0 - 100.0 * max(
                (_similarity(clip.text, other.text) for other in selected[:position]),
                default=0.0,
            )
        )

    offered = [c for c in selected if c.clip_score >= minimum][:wanted]
    held_back = [c for c in selected[:wanted] if c.clip_score < minimum]

    context = {
        "ranking_version": RANKING_VERSION,
        "scored": len(scored),
        "after_deduplication": len(selected),
        "duplicates_dropped": dropped_duplicates,
        "minimum_clip_score": minimum,
        "offered": len(offered),
        "below_threshold": len(held_back),
        "weights": WEIGHTS,
        "score_means": (
            "ClipR thinks this is worth reviewing. It is not a prediction that "
            "the clip will perform well -- nothing here has been measured "
            "against real post performance."
        ),
    }
    return offered, context
