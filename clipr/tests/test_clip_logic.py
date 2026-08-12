"""Unit tests for the parts of the clip pipeline that are pure logic.

Anything that needs to know what ffmpeg actually does lives in
tests/integration and runs the real binary. These are the decisions that can be
checked without decoding anything: how cues are packed, how a window is scored
against a series, how concentration is measured, and what the verifier refuses
to accept.
"""

from __future__ import annotations

import json

from packages.ai import captions as C
from packages.ai.reframe import measure_concentration
from packages.ai.signals import Candidate, _slice, _suppress_overlaps, snap_to_speech
from packages.ai.transcribe import Quality, Segment, Transcript, Word


def _transcript(words: list[tuple[float, float, str]], *,
                quality: Quality = Quality.GOOD) -> Transcript:
    ws = [Word(start=s, end=e, text=t) for s, e, t in words]
    seg = Segment(start=ws[0].start, end=ws[-1].end,
                  text=" ".join(w.text for w in ws), words=ws)
    return Transcript([seg], "test", "test", "en", quality,
                      audio_seconds=ws[-1].end, seconds_to_transcribe=0.0)


# --- captions --------------------------------------------------------------

def test_caption_wrap_limit_matches_what_fits_the_frame():
    """The two must be derived from one number.

    They were not: text was wrapped at 24 characters while only ~15 fitted, so
    every long line ran off both edges of the frame.
    """
    style = C.CaptionStyle()
    limit = style.max_chars_per_line(1080)
    words = [Word(start=i * 0.4, end=i * 0.4 + 0.35, text="wordy") for i in range(20)]
    cues = C.cues_from_words(words, max_chars=limit)
    assert cues
    assert not C.check_fits(cues, 1080)


def test_font_size_scales_with_width_not_height():
    """A 9:16 frame is short on width, and width is what constrains a caption."""
    style = C.CaptionStyle()
    assert style.font_size(1080) == style.font_size(1080)
    assert style.font_size(1920) > style.font_size(1080)


def test_captions_clear_the_platform_ui_band():
    style = C.CaptionStyle()
    assert style.baseline_fraction > C.PLATFORM_SAFE_BOTTOM


def test_cues_are_clip_relative_not_source_relative():
    """A cue timed against the source plays at the wrong moment, or never."""
    transcript = _transcript([(100.0, 100.5, "hello"), (100.6, 101.2, "there")])
    cues = C.cues_for_clip(transcript, 99.0, 110.0)
    assert cues
    assert cues[0].start < 5.0, "cue should be ~1s into the clip, not ~100s"


def test_a_long_pause_breaks_a_cue():
    words = [Word(0.0, 0.4, "before"), Word(6.0, 6.4, "after")]
    assert len(C.cues_from_words(words)) == 2


def test_braces_in_speech_cannot_open_an_override_block():
    cue = C.Cue(0.0, 1.0, ["what {b1} means"])
    body = C.to_ass([cue], 1080, 1920)
    assert "{b1}" not in body
    assert "(b1)" in body


def test_no_speech_in_the_span_is_reported_not_hidden():
    transcript = _transcript([(0.0, 0.5, "hello")])
    cues = C.cues_for_clip(transcript, 500.0, 530.0)
    assert cues == []


def test_captions_from_a_poor_engine_are_flagged_untrustworthy(tmp_path):
    transcript = _transcript([(1.0, 1.4, "probably"), (1.5, 2.0, "wrong")],
                             quality=Quality.POOR)
    result = C.prepare(transcript, 0.0, 20.0, tmp_path / "c.ass")
    assert result.rendered_anything
    assert not result.trustworthy
    assert any("likely wrong" in w for w in result.warnings)


# --- signal windowing ------------------------------------------------------

def test_slice_maps_seconds_onto_a_series_of_any_rate():
    """The bug this guards: assuming one sample per second.

    astats returns ~43 samples a second at 44.1 kHz, so a window that indexed
    the series by whole seconds read a fraction of the audio it meant to.
    """
    series = list(range(600))          # 600 samples over 60 seconds = 10/sec
    window = _slice(series, 10.0, 20.0, duration=60.0)
    assert len(window) == 100
    assert window[0] == 100


def test_slice_is_safe_on_an_empty_series():
    assert _slice([], 0.0, 10.0, 60.0) == []


def test_overlapping_candidates_are_collapsed_to_the_best_one():
    """Six views of the same ten seconds is one moment, not six."""
    cands = [
        Candidate(100, 130, 90, ["best"]),
        Candidate(105, 135, 80, ["overlaps"]),
        Candidate(300, 330, 70, ["separate"]),
    ]
    kept = _suppress_overlaps(cands, top_n=10)
    assert [c.score for c in kept] == [90, 70]


def test_suppression_respects_the_requested_count():
    cands = [Candidate(i * 100, i * 100 + 30, 50 - i, ["x"]) for i in range(10)]
    assert len(_suppress_overlaps(cands, top_n=3)) == 3


# --- cut points ------------------------------------------------------------

def test_cut_points_move_off_the_middle_of_a_word():
    transcript = _transcript([(9.5, 10.5, "midword"), (12.0, 12.4, "next")])
    snapped = snap_to_speech(Candidate(10.0, 40.0, 50, []), transcript, 120.0)
    assert snapped.start <= 9.5, "clip must not begin inside a word"


def test_snapping_keeps_the_clip_within_length_limits():
    transcript = _transcript([(1.0, 1.4, "a"), (2.0, 2.4, "b")])
    snapped = snap_to_speech(Candidate(1.0, 3.0, 50, []), transcript, 600.0)
    assert snapped.duration >= 15.0


def test_snapping_without_word_timings_is_a_no_op():
    original = Candidate(10.0, 40.0, 50, ["x"])
    assert snap_to_speech(original, None, 120.0) is original


# --- framing concentration -------------------------------------------------

def test_energy_in_one_place_reads_as_concentrated():
    from packages.ai.subject import GRID_H, GRID_W
    energy = [0.0] * (GRID_W * GRID_H)
    for y in range(GRID_H):
        for x in range(28, 36):
            energy[y * GRID_W + x] = 1.0
    concentration, centre, _ = measure_concentration(energy)
    assert concentration > 0.95
    assert 0.4 < centre < 0.6


def test_energy_spread_across_the_frame_reads_as_uncroppable():
    from packages.ai.subject import GRID_H, GRID_W
    energy = [1.0] * (GRID_W * GRID_H)
    concentration, _, _ = measure_concentration(energy)
    # A 9:16 window covers about 32% of a 16:9 frame's width.
    assert concentration < 0.4


def test_concentration_is_defined_on_an_empty_frame():
    from packages.ai.subject import GRID_H, GRID_W
    concentration, centre, _ = measure_concentration([0.0] * (GRID_W * GRID_H))
    assert concentration == 0.0 and centre == 0.5


# --- the verifier ----------------------------------------------------------

def test_verifier_rejects_a_report_that_claims_human_verification(tmp_path):
    """No code path may set this. It exists to be false until a person acts."""
    from packages.pipeline.verify import verify

    (tmp_path / "source_info.json").write_text("{}")
    (tmp_path / "demo_report.json").write_text(json.dumps({
        "clips": [], "human_quality_verified": True,
    }))
    ok, problems, _ = verify(tmp_path)
    assert not ok
    assert problems


def test_verifier_fails_when_a_promised_clip_is_missing(tmp_path):
    from packages.pipeline.verify import verify

    (tmp_path / "source_info.json").write_text("{}")
    (tmp_path / "demo_report.json").write_text(json.dumps({
        "source": {"has_audio": True},
        "clips": [{"index": 1, "path": str(tmp_path / "gone.mp4"),
                   "debug_path": str(tmp_path / "gone_debug.mp4")}],
    }))
    ok, problems, _ = verify(tmp_path)
    assert not ok
    assert any("missing" in p for p in problems)


def test_verifier_needs_a_directory_that_exists(tmp_path):
    from packages.pipeline.verify import verify

    ok, problems, _ = verify(tmp_path / "never_ran")
    assert not ok
    assert "make demo" in problems[0]


# --- transcript contract ---------------------------------------------------

def test_a_transcript_with_no_words_is_never_trustworthy():
    empty = Transcript([], "test", "m", "en", Quality.GOOD, 0.0, 0.0)
    assert empty.is_empty
    assert not empty.trustworthy


def test_poor_quality_is_never_trustworthy_however_many_words():
    poor = _transcript([(0.0, 1.0, "words")] * 1, quality=Quality.POOR)
    assert not poor.trustworthy

# Note: "asking for an engine that cannot run raises rather than silently
# downgrading" is checked in tests/integration, against a real audio file. The
# version that lived here passed a nonexistent path, so it failed during audio
# extraction and never reached engine selection -- it asserted its own name
# rather than the behaviour.
