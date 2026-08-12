"""Eval harness metrics.

The harness is the only gate between a bad model and production, so its
arithmetic is tested against hand-computable cases rather than golden files.
"""

import json
from dataclasses import replace

import pytest

from packages.ai.evaluation import (
    EvalResult, MIN_LABELS_FOR_GATE, check_regression, evaluate, iou, load_dataset,
)


class Det:
    def __init__(self, start, end, score=90.0):
        self.start, self.end, self.score = start, end, score


def write_dataset(tmp_path, samples, name="ds"):
    path = tmp_path / f"{name}.jsonl"
    path.write_text("\n".join(json.dumps(s) for s in samples))
    return path


# --- IoU -------------------------------------------------------------------

def test_iou_basics():
    assert iou(0, 10, 0, 10) == 1.0
    assert iou(0, 10, 20, 30) == 0.0
    assert iou(0, 10, 5, 15) == pytest.approx(1 / 3)


def test_touching_intervals_do_not_overlap():
    assert iou(0, 10, 10, 20) == 0.0


# --- matching --------------------------------------------------------------

def test_perfect_detection_scores_one(tmp_path):
    ds = write_dataset(tmp_path, [{"labels": [{"start": 100, "end": 140}]}])
    r = evaluate(lambda s: [Det(100, 140)], ds)
    assert (r.precision, r.recall, r.f1) == (1.0, 1.0, 1.0)
    assert r.boundary_error_seconds == 0.0


def test_missed_label_counts_as_a_false_negative(tmp_path):
    ds = write_dataset(tmp_path, [{"labels": [{"start": 100, "end": 140}]}])
    r = evaluate(lambda s: [], ds)
    assert (r.false_negatives, r.recall, r.false_negative_rate) == (1, 0.0, 1.0)


def test_spurious_detection_counts_as_a_false_positive(tmp_path):
    ds = write_dataset(tmp_path, [{"labels": []}])
    r = evaluate(lambda s: [Det(0, 30)], ds)
    assert r.false_positives == 1 and r.precision == 0.0


def test_one_label_cannot_be_claimed_twice(tmp_path):
    """Two overlapping detections on one label is one hit and one false
    positive, not two hits."""
    ds = write_dataset(tmp_path, [{"labels": [{"start": 100, "end": 140}]}])
    r = evaluate(lambda s: [Det(100, 140), Det(101, 139)], ds)
    assert (r.true_positives, r.false_positives) == (1, 1)


def test_the_strongest_detection_claims_the_label(tmp_path):
    """Matching iterated in arbitrary order previously let a weak detection bind
    a label a stronger one deserved, depressing publishable rate at random."""
    ds = write_dataset(tmp_path, [{"labels": [{"start": 100, "end": 140}]}])
    r = evaluate(lambda s: [Det(102, 138, score=95.0), Det(100, 140, score=10.0)], ds)
    assert r.publishable_rate == 0.5   # the 95 matched, the 10 did not


def test_boundary_error_averages_both_edges(tmp_path):
    """Taking min() reports the better edge and hides a clip that starts on time
    and runs ten seconds long."""
    ds = write_dataset(tmp_path, [{"labels": [{"start": 100, "end": 140}]}])
    r = evaluate(lambda s: [Det(100, 150)], ds)
    assert r.boundary_error_seconds == 5.0


# --- honesty about what was measured --------------------------------------

def test_unmeasured_metrics_are_none_not_zero(tmp_path):
    """0.0 word error rate reads on a dashboard as a perfect transcription
    score. It is the value the original harness stored for a metric it never
    computed."""
    ds = write_dataset(tmp_path, [{"labels": [{"start": 1, "end": 2}]}])
    r = evaluate(lambda s: [Det(1, 2)], ds)
    assert r.caption_wer is None and r.crop_accuracy is None


def test_supplying_a_scorer_populates_the_metric(tmp_path):
    ds = write_dataset(tmp_path, [{"labels": [{"start": 1, "end": 2}]}])
    r = evaluate(lambda s: [Det(1, 2)], ds, caption_scorer=lambda s: 0.08)
    assert r.caption_wer == 0.08


def test_result_records_the_dataset_hash(tmp_path):
    """Without it, 'F1 improved' is unfalsifiable -- the dataset may have gotten
    easier."""
    ds = write_dataset(tmp_path, [{"labels": []}])
    first = evaluate(lambda s: [], ds).dataset_sha256
    ds.write_text(json.dumps({"labels": [{"start": 0, "end": 1}]}))
    assert evaluate(lambda s: [], ds).dataset_sha256 != first


def test_missing_dataset_explains_the_format(tmp_path):
    with pytest.raises(FileNotFoundError, match="labels"):
        load_dataset(tmp_path / "nope.jsonl")


def test_empty_dataset_is_an_error_not_a_perfect_score(tmp_path):
    path = tmp_path / "empty.jsonl"
    path.write_text("")
    with pytest.raises(ValueError):
        load_dataset(path)


# --- the regression gate ---------------------------------------------------

def baseline(**kw) -> EvalResult:
    base = EvalResult(
        dataset_name="ds", dataset_sha256="abc", sample_count=20,
        labeled_moment_count=100, detected_count=120, true_positives=80,
        false_positives=40, false_negatives=20, precision=0.66, recall=0.8,
        f1=0.72, false_negative_rate=0.2, publishable_rate=0.62,
        boundary_error_seconds=1.2,
    )
    return replace(base, **kw)


def test_a_clear_f1_drop_blocks_deploy():
    v = check_regression(baseline(f1=0.60), baseline())
    assert v.blocks_deploy and "F1 fell" in v.reasons[0]


def test_a_publishable_rate_collapse_blocks_deploy():
    v = check_regression(baseline(publishable_rate=0.40), baseline())
    assert v.blocks_deploy


def test_noise_does_not_block():
    """A gate that trips on noise gets switched off within a month."""
    assert not check_regression(baseline(f1=0.70), baseline()).blocks_deploy


def test_improvement_does_not_block():
    assert not check_regression(baseline(f1=0.85), baseline()).blocks_deploy


def test_gate_abstains_on_a_tiny_dataset():
    small = baseline(labeled_moment_count=MIN_LABELS_FOR_GATE - 1, f1=0.10)
    v = check_regression(small, baseline())
    assert v.abstained and not v.blocks_deploy


def test_gate_abstains_when_the_dataset_changed():
    """Comparing across datasets is meaningless; saying so beats a confident
    wrong verdict in either direction."""
    v = check_regression(baseline(dataset_sha256="different", f1=0.10), baseline())
    assert v.abstained and not v.blocks_deploy


def test_gate_abstains_with_no_baseline():
    assert check_regression(baseline(), None).abstained
