"""Finding moments in a file nobody has annotated.

The existing detector wants chat velocity and viewer clip presses. Those are
excellent signals and they do not exist for an uploaded MP4 -- no chat log, no
native clips, no stream metadata. A demo on a local file therefore exercised
none of the detection logic, which is how the pipeline came to be evaluated on
moments that had been planted in the source in the first place.

This module scores a file using only what is inside it:

    audio energy      loudness above the file's own baseline, not an absolute
    energy rise       how sharply it got louder -- the shape of a reaction
    speech rate       words per second against this speaker's own median
    silence break     the pause before a punchline
    scene change      cuts and hard visual transitions
    motion            frame-to-frame change

Every threshold is relative to the file. A quiet podcast and a loud stream both
have loud moments; an absolute dBFS cutoff finds them in one and not the other.

Deterministic, no LLM, no network. An LLM makes the ranking better and must not
be required to make it exist.
"""

from __future__ import annotations

import shutil
import statistics
import subprocess
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from packages.ai.subject import GRID_H, GRID_W, _frames
from packages.ai.transcribe import Transcript

WINDOW_SECONDS = 30.0
HOP_SECONDS = 5.0
MIN_CLIP_SECONDS = 15.0
MAX_CLIP_SECONDS = 60.0


@dataclass
class Candidate:
    start: float
    end: float
    score: float
    reasons: list[str] = field(default_factory=list)
    signals: dict = field(default_factory=dict)

    @property
    def duration(self) -> float:
        return self.end - self.start

    def to_dict(self) -> dict:
        return {
            "start": round(self.start, 2),
            "end": round(self.end, 2),
            "duration": round(self.duration, 2),
            "score": round(self.score, 2),
            "reason": "; ".join(self.reasons),
            "signals": {k: round(v, 4) if isinstance(v, float) else v
                        for k, v in self.signals.items()},
        }

    def describe(self) -> str:
        return f"{self.start:7.1f}s  score {self.score:5.1f}  {'; '.join(self.reasons)}"


def _ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if path is None:
        raise RuntimeError("ffmpeg not found on PATH")
    return path


def loudness_series(media_path: str, per_second: float = 2.0) -> list[float]:
    """RMS in dBFS at `per_second` samples a second, measured by ffmpeg.

    astats' `reset` counts audio *frames*, not seconds -- assuming otherwise is
    what made the detector read the wrong span of audio for every window. The
    frame size is fixed here so the conversion is explicit and checkable.
    """
    samples_per_frame = int(48_000 / per_second)
    proc = subprocess.run(
        [_ffmpeg(), "-nostdin", "-v", "info", "-i", media_path,
         "-af", f"aresample=48000,asetnsamples=n={samples_per_frame},"
                f"astats=metadata=1:reset=1:measure_perchannel=none,"
                f"ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
         "-f", "null", "-"],
        capture_output=True, text=True, timeout=3600,
    )
    values: list[float] = []
    for line in proc.stdout.splitlines():
        if "RMS_level=" in line:
            raw = line.rsplit("=", 1)[1].strip()
            try:
                values.append(-120.0 if raw in ("-inf", "nan") else float(raw))
            except ValueError:
                continue
    return values


def scene_changes(media_path: str, threshold: float = 0.35) -> list[float]:
    """Timestamps where the picture changed abruptly."""
    proc = subprocess.run(
        [_ffmpeg(), "-nostdin", "-v", "info", "-i", media_path,
         "-vf", f"select='gt(scene,{threshold})',metadata=print:file=-",
         "-an", "-f", "null", "-"],
        capture_output=True, text=True, timeout=3600,
    )
    times: list[float] = []
    for line in proc.stdout.splitlines():
        if "pts_time:" in line:
            try:
                times.append(float(line.split("pts_time:")[1].split()[0]))
            except (ValueError, IndexError):
                continue
    return times


def motion_series(media_path: str, duration: float, fps: float = 1.0) -> list[float]:
    """Mean absolute frame difference, one value per sample."""
    frames = _frames(media_path, 0.0, duration, fps)
    out: list[float] = []
    previous = None
    size = GRID_W * GRID_H
    for frame in frames:
        if previous is None:
            out.append(0.0)
        else:
            out.append(sum(abs(a - b) for a, b in zip(frame, previous, strict=False))
                       / (size * 255.0))
        previous = frame
    return out


def _percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, int(q * (len(ordered) - 1))))
    return ordered[idx]


def _slice(series: list[float], start: float, end: float,
           duration: float) -> list[float]:
    """The part of a series covering [start, end) of a `duration`-second file."""
    if not series or duration <= 0:
        return []
    per_second = len(series) / duration
    lo = max(0, int(start * per_second))
    hi = min(len(series), max(lo + 1, int(end * per_second)))
    return series[lo:hi]


def find_candidates(
    media_path: str,
    duration: float,
    *,
    transcript: Transcript | None = None,
    window: float = WINDOW_SECONDS,
    hop: float = HOP_SECONDS,
    top_n: int = 12,
) -> tuple[list[Candidate], dict]:
    """Score every window in the file and return the best, with reasons."""
    # Three independent passes over the file, each one mostly waiting on an
    # ffmpeg subprocess. Run together they cost about what the slowest one
    # costs instead of the sum, and the GIL is not in the way because the work
    # happens in another process.
    with ThreadPoolExecutor(max_workers=3) as pool:
        f_loud = pool.submit(loudness_series, media_path)
        f_motion = pool.submit(motion_series, media_path, duration)
        f_cuts = pool.submit(scene_changes, media_path)
        loudness = f_loud.result()
        motion = f_motion.result()
        cuts = f_cuts.result()

    audible = [v for v in loudness if v > -119]
    baseline = statistics.median(audible) if audible else -120.0
    loud_p90 = _percentile(audible, 0.90) if audible else -120.0
    quiet_floor = _percentile(audible, 0.15) if audible else -120.0
    motion_median = statistics.median(motion) if motion else 0.0

    # Speaking rate per window, measured against this speaker's own median.
    word_times: list[float] = []
    if transcript is not None:
        for seg in transcript.segments:
            if seg.words:
                word_times.extend(w.start for w in seg.words)
            elif seg.text.strip():
                n = len(seg.text.split())
                span = max(seg.duration, 0.1)
                word_times.extend(seg.start + i * span / n for i in range(n))
    word_times.sort()

    def words_between(a: float, b: float) -> int:
        return sum(1 for t in word_times if a <= t < b)

    rates: list[float] = []
    t = 0.0
    while t + window <= max(window, duration):
        rates.append(words_between(t, t + window) / window)
        t += hop
    median_rate = statistics.median([r for r in rates if r > 0]) if any(rates) else 0.0

    candidates: list[Candidate] = []
    t = 0.0
    index = 0
    while t + MIN_CLIP_SECONDS <= duration:
        end = min(t + window, duration)
        win_loud = _slice(loudness, t, end, duration)
        win_motion = _slice(motion, t, end, duration)
        audible_win = [v for v in win_loud if v > -119]

        score = 0.0
        reasons: list[str] = []
        sig: dict = {}

        # --- audio energy above this file's own baseline
        if audible_win:
            peak = max(audible_win)
            mean = sum(audible_win) / len(audible_win)
            over = peak - baseline
            sig["peak_dbfs"] = round(peak, 2)
            sig["above_baseline_db"] = round(over, 2)
            if over > 3:
                gain = min(28.0, over * 2.4)
                score += gain
                if peak >= loud_p90:
                    reasons.append(f"audio peaks {over:.0f} dB over baseline (top 10% of the file)")
                else:
                    reasons.append(f"audio {over:.0f} dB over baseline")

            # --- how sharply it rose: a reaction has a shape, not just a level
            half = len(audible_win) // 2 or 1
            rise = (sum(audible_win[half:]) / max(1, len(audible_win[half:]))
                    - sum(audible_win[:half]) / half)
            sig["rise_db"] = round(rise, 2)
            if rise > 2.5:
                score += min(14.0, rise * 2.0)
                reasons.append(f"sharp rise in audio ({rise:.0f} dB)")

            # --- a pause immediately before it
            lead = _slice(loudness, max(0.0, t - 4), t, duration)
            lead_audible = [v for v in lead if v > -119]
            if lead_audible and audible_win:
                lead_mean = sum(lead_audible) / len(lead_audible)
                if lead_mean <= quiet_floor + 2 and mean > lead_mean + 5:
                    score += 7.0
                    reasons.append("follows a pause")

            silence = sum(1 for v in win_loud if v <= -119) / max(1, len(win_loud))
            sig["silence_ratio"] = round(silence, 3)
            if silence > 0.75:
                score -= 18.0
                reasons.append("mostly silent")

        # --- speech rate against the speaker's own median
        if median_rate > 0:
            rate = words_between(t, end) / max(1e-6, end - t)
            sig["words_per_second"] = round(rate, 3)
            if rate > median_rate * 1.35:
                score += 10.0
                reasons.append(f"speech speeds up ({rate:.1f} vs {median_rate:.1f} w/s)")
            elif rate < median_rate * 0.25:
                score -= 6.0
                reasons.append("little speech")

        # --- visual activity
        if win_motion:
            mean_motion = sum(win_motion) / len(win_motion)
            sig["motion"] = round(mean_motion, 4)
            if motion_median > 0 and mean_motion > motion_median * 1.4:
                score += 8.0
                reasons.append("motion increases")

        cuts_in = sum(1 for c in cuts if t <= c < end)
        sig["scene_changes"] = cuts_in
        if cuts_in >= 2:
            score += 5.0
            reasons.append(f"{cuts_in} scene changes")

        if score > 0 and reasons:
            candidates.append(Candidate(
                start=round(t, 2),
                end=round(min(t + max(MIN_CLIP_SECONDS, window), duration), 2),
                score=round(score, 2), reasons=reasons, signals=sig,
            ))
        t += hop
        index += 1

    candidates.sort(key=lambda c: c.score, reverse=True)
    selected = _suppress_overlaps(candidates, top_n)

    context = {
        "loudness_samples": len(loudness),
        "baseline_dbfs": round(baseline, 2),
        "loud_p90_dbfs": round(loud_p90, 2),
        "median_words_per_second": round(median_rate, 3),
        "scene_changes": len(cuts),
        "windows_examined": index,
        "windows_scored": len(candidates),
        "transcript_engine": transcript.engine if transcript else None,
    }
    return selected, context


def _suppress_overlaps(candidates: list[Candidate], top_n: int,
                       max_overlap: float = 0.35) -> list[Candidate]:
    """Keep the best window from each cluster.

    Without this, a hop of 5 seconds returns six views of the same ten seconds
    and calls them six moments -- which would make the clip count look good and
    give the creator one moment to post.
    """
    kept: list[Candidate] = []
    for cand in candidates:
        clash = False
        for other in kept:
            overlap = min(cand.end, other.end) - max(cand.start, other.start)
            if overlap > 0 and overlap / min(cand.duration, other.duration) > max_overlap:
                clash = True
                break
        if not clash:
            kept.append(cand)
        if len(kept) >= top_n:
            break
    return kept


def snap_to_speech(candidate: Candidate, transcript: Transcript | None,
                   duration: float, *, pre_roll: float = 0.6,
                   post_roll: float = 0.8) -> Candidate:
    """Move the cut points off the middle of a word.

    A clip that starts mid-syllable reads as broken however good the moment is,
    and it is the first thing a creator notices. With word timings we can start
    just before a word begins and end just after one finishes.
    """
    if transcript is None:
        return candidate
    words = [w for s in transcript.segments for w in s.words]
    if not words:
        return candidate

    start, end = candidate.start, candidate.end

    # A word straddling the start: begin before it rather than inside it.
    straddling = [w for w in words if w.start < start < w.end]
    if straddling:
        start = max(0.0, min(w.start for w in straddling) - pre_roll)
    else:
        following = [w for w in words if w.start >= start]
        if following:
            nxt = min(w.start for w in following)
            if nxt - start < 2.5:
                start = max(0.0, nxt - pre_roll)

    straddling_end = [w for w in words if w.start < end < w.end]
    if straddling_end:
        end = min(duration, max(w.end for w in straddling_end) + post_roll)
    else:
        preceding = [w for w in words if w.end <= end]
        if preceding:
            last = max(w.end for w in preceding)
            if end - last < 2.5:
                end = min(duration, last + post_roll)

    if end - start < MIN_CLIP_SECONDS:
        end = min(duration, start + MIN_CLIP_SECONDS)
    if end - start > MAX_CLIP_SECONDS:
        end = start + MAX_CLIP_SECONDS

    return Candidate(round(start, 2), round(end, 2), candidate.score,
                     [*candidate.reasons, "cut points snapped to word boundaries"],
                     candidate.signals)
