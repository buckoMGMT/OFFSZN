"""The scoring model, which is the part of ClipR that is actually the product.

These check judgement, not plumbing: that a clip opening on filler scores worse
than one opening on a reaction, that three views of one moment collapse to one,
that a weak VOD produces silence rather than filler, and that cut points land
on sentence edges.
"""

from __future__ import annotations

import pytest

from packages.ai.clip_eval import Label, LabeledVod, aggregate, evaluate_vod
from packages.ai.ranking import (
    MINIMUM_CLIP_SCORE,
    Sentence,
    rank,
    refine_boundaries,
    score_context,
    score_hook,
    sentence_spans,
)
from packages.ai.signals import Candidate
from packages.ai.transcribe import Quality, Segment, Timing, Transcript, Word


def _transcript(sentences: list[tuple[float, str]], gap: float = 0.25) -> Transcript:
    """Build a transcript with word timings from (start, sentence) pairs."""
    segments = []
    for start, text in sentences:
        words, cursor = [], start
        for token in text.split():
            length = max(0.18, len(token) * 0.075)
            words.append(Word(start=round(cursor, 3),
                              end=round(cursor + length, 3), text=token))
            cursor += length + gap * 0.2
        segments.append(Segment(start=words[0].start, end=words[-1].end,
                                text=text, words=words))
    return Transcript(segments, "test", "test", "en", Quality.GOOD,
                      audio_seconds=segments[-1].end, seconds_to_transcribe=0.0,
                      word_timing=Timing.EXACT)


def _flat_loudness(n: int = 1200, value: float = -25.0) -> list[float]:
    return [value] * n


# --- sentences -------------------------------------------------------------

def test_sentences_are_rebuilt_from_punctuation_not_segments():
    """A segment is however much audio the decoder batched, not a sentence."""
    t = _transcript([(0.0, "This is one. And this is two! Is this three?")])
    spans = sentence_spans(t)
    assert len(spans) == 3
    assert spans[0].text.endswith(".")
    assert spans[2].text.endswith("?")


def test_no_transcript_yields_no_sentences():
    assert sentence_spans(None) == []


# --- hook ------------------------------------------------------------------

def test_opening_on_filler_scores_worse_than_opening_on_a_reaction():
    filler = _transcript([(0.0, "Um so basically I was going to say something.")])
    strong = _transcript([(0.0, "Oh my god he actually hit that shot!")])
    loud = _flat_loudness()

    weak_score, _ = score_hook(0.0, 30.0, filler, sentence_spans(filler), loud, 600)
    good_score, _ = score_hook(0.0, 30.0, strong, sentence_spans(strong), loud, 600)
    assert good_score > weak_score + 15


def test_a_hook_that_opens_mid_sentence_is_penalised():
    t = _transcript([(0.0, "So here is the thing I wanted to mention today.")])
    mid, note = score_hook(2.5, 30.0, t, sentence_spans(t), _flat_loudness(), 600)
    assert "mid-sentence" in note
    assert mid < 60


def test_silence_is_a_bad_hook():
    empty = _transcript([(200.0, "Words far away from the clip.")])
    score, note = score_hook(0.0, 30.0, empty, [], [-200.0] * 100, 600)
    assert score < 30
    assert "silence" in note


# --- context ---------------------------------------------------------------

def test_a_clip_opening_on_a_pronoun_is_marked_context_dependent():
    t = _transcript([(0.0, "He did it again and they could not believe it.")])
    score, note = score_context(0.0, sentence_spans(t), t, 30.0)
    assert "refers back" in note or "pronoun" in note
    assert score < 60


def test_a_self_contained_opening_scores_higher():
    dependent = _transcript([(0.0, "And that is why they lost the round.")])
    independent = _transcript([(0.0, "What happens when you push the button?")])
    low, _ = score_context(0.0, sentence_spans(dependent), dependent, 20.0)
    high, _ = score_context(0.0, sentence_spans(independent), independent, 20.0)
    assert high > low


# --- boundaries ------------------------------------------------------------

def test_cut_points_move_to_sentence_edges():
    t = _transcript([
        (0.0, "Let me show you something interesting here."),
        (6.0, "And then the whole thing exploded immediately."),
        (14.0, "That was completely unbelievable to watch."),
    ])
    spans = sentence_spans(t)
    bounds = refine_boundaries(Candidate(7.5, 20.0, 60, ["peak"]), spans, 600.0)
    starts = {round(s.start, 1) for s in spans}
    assert any(abs(bounds.start - s) < 0.3 for s in starts), (
        f"start {bounds.start} is not on a sentence edge {starts}"
    )
    assert bounds.why


def test_boundaries_never_exceed_the_length_ceiling():
    t = _transcript([(0.0, "A sentence that opens the clip.")])
    bounds = refine_boundaries(Candidate(5.0, 400.0, 60, []), sentence_spans(t), 900.0)
    assert bounds.end - bounds.start <= 60.0


def test_boundaries_survive_having_no_transcript():
    bounds = refine_boundaries(Candidate(10.0, 40.0, 60, []), [], 600.0)
    assert bounds.end > bounds.start
    assert "no transcript" in bounds.why[0]


def test_start_is_floored_so_the_first_word_is_not_cut_off():
    """Rounding to nearest moved a start past the word it had aligned to."""
    spans = [Sentence(0.248, 4.0, "Welcome back everyone to the stream.")]
    bounds = refine_boundaries(Candidate(1.0, 30.0, 50, []), spans, 120.0)
    assert bounds.start <= 0.248


# --- ranking ---------------------------------------------------------------

def _rank(candidates, transcript, **kw):
    return rank(candidates, transcript=transcript, loudness=_flat_loudness(),
                motion=[0.03] * 600, duration=600.0, baseline_dbfs=-40.0,
                framing_for=lambda s, e: (0.8, "motion_track"), **kw)


def test_three_views_of_one_moment_become_one_clip():
    """The failure this prevents: a clip count that looks good and gives the
    creator one moment to post."""
    t = _transcript([(100.0, "Oh my god that was completely insane to watch!")])
    cands = [
        Candidate(100.0, 130.0, 90, ["peak"]),
        Candidate(103.0, 133.0, 88, ["peak"]),
        Candidate(98.0, 128.0, 86, ["peak"]),
    ]
    offered, ctx = _rank(cands, t, wanted=3, minimum=0.0)
    assert len(offered) == 1
    assert ctx["duplicates_dropped"] == 2


def test_a_weak_vod_returns_nothing_rather_than_filler():
    """Abstention. Manufacturing three clips is how trust is lost."""
    t = _transcript([(10.0, "um so anyway uh like i guess maybe whatever.")])
    offered, ctx = _rank([Candidate(10.0, 40.0, 5, ["quiet"])], t,
                         wanted=3, minimum=90.0)
    assert offered == []
    assert ctx["below_threshold"] >= 1


def test_the_score_is_not_described_as_a_prediction_of_performance():
    _, ctx = _rank([Candidate(10.0, 40.0, 50, [])], None, wanted=1, minimum=0.0)
    assert "worth reviewing" in ctx["score_means"]
    assert "not a prediction" in ctx["score_means"]


def test_every_offered_clip_explains_each_dimension():
    t = _transcript([(50.0, "Here is the thing that makes this actually work.")])
    offered, _ = _rank([Candidate(50.0, 80.0, 60, ["audio"])], t,
                       wanted=1, minimum=0.0)
    assert offered
    clip = offered[0]
    for dimension in ("hook", "payoff", "energy", "context", "speech",
                      "visual", "completeness"):
        assert dimension in clip.dimensions
        assert dimension in clip.explanations


def test_the_first_pick_is_maximally_novel_by_definition():
    t = _transcript([(50.0, "Something happens here that is worth watching.")])
    offered, _ = _rank([Candidate(50.0, 80.0, 60, [])], t, wanted=3, minimum=0.0)
    assert offered[0].dimensions["novelty"] == 100.0


def test_weights_sum_to_one_so_the_score_stays_on_a_hundred_point_scale():
    from packages.ai.ranking import WEIGHTS
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)


def test_minimum_threshold_is_actually_applied():
    t = _transcript([(50.0, "A perfectly ordinary sentence with nothing in it.")])
    offered, _ = _rank([Candidate(50.0, 80.0, 60, [])], t, wanted=3,
                       minimum=MINIMUM_CLIP_SCORE)
    assert all(c.clip_score >= MINIMUM_CLIP_SCORE for c in offered)


# --- evaluation against human labels ---------------------------------------

def _clip(start, end, score=80.0):
    class C:
        pass
    c = C()
    c.start, c.end, c.clip_score = start, end, score
    return c


def test_a_clip_inside_the_accepted_range_has_no_boundary_error():
    label = Label(start_range=(100.0, 106.0), end_range=(130.0, 138.0))
    assert label.boundary_error(103.0, 134.0) == 0.0


def test_boundary_error_grows_with_distance_from_the_accepted_range():
    label = Label(start_range=(100.0, 106.0), end_range=(130.0, 138.0))
    assert label.boundary_error(90.0, 134.0) > 0
    assert label.boundary_error(90.0, 150.0) > label.boundary_error(90.0, 140.0)


def test_recall_and_precision_are_measured_against_human_labels():
    vod = LabeledVod("v", "/x.mp4", 600.0, [
        Label((100.0, 106.0), (130.0, 138.0)),
        Label((300.0, 305.0), (330.0, 340.0)),
    ])
    result = evaluate_vod(vod, [_clip(102, 134, 90), _clip(500, 530, 70)], k=3)
    assert result.hits == 1
    assert result.recall_at_k == 0.5
    assert result.precision_at_k == 0.5
    assert len(result.missed) == 1


def test_two_clips_on_the_same_labelled_moment_count_as_a_duplicate():
    vod = LabeledVod("v", "/x.mp4", 600.0, [Label((100.0, 106.0), (130.0, 138.0))])
    result = evaluate_vod(vod, [_clip(102, 134, 90), _clip(104, 136, 88)], k=3)
    assert result.hits == 1
    assert result.duplicates == 1


def test_publishable_rate_is_never_derived_from_labels():
    """It is the north star precisely because only a person can set it."""
    vod = LabeledVod("v", "/x.mp4", 600.0, [Label((100.0, 106.0), (130.0, 138.0))])
    summary = aggregate([evaluate_vod(vod, [_clip(102, 134)], k=3)])
    assert summary["publishable_rate"] is None


def test_a_small_evaluation_set_says_so_instead_of_reporting_a_conclusion():
    vod = LabeledVod("v", "/x.mp4", 600.0, [Label((100.0, 106.0), (130.0, 138.0))])
    summary = aggregate([evaluate_vod(vod, [_clip(102, 134)], k=3)])
    assert summary["enough_data"] is False
    assert "not enough" in summary["status"]
