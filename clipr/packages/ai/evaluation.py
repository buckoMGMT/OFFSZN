"""Detection eval harness.

Metric correctness matters more here than anywhere else in the codebase: these
numbers are the only thing standing between a bad model and production, and a
wrong metric that reads *well* is worse than no metric at all.

Fixed from the previous version:

* `false_positive_rate` referenced `true_negatives`, which was never defined --
  the function raised NameError on every run, so the harness had never
  executed. FPR is also undefined for this task (there is no enumerable set of
  true negatives in a continuous stream), so it is gone. Precision is the
  correct measure and is reported instead.
* `caption_wer` and `crop_accuracy` were averaged over permanently empty lists,
  producing 0.0, which is stored and displayed as a *perfect* score for a metric
  that was never measured. They are now None unless a scorer is supplied.
* Matching iterated detections in arbitrary order and could bind a weak
  detection to a label that a stronger one deserved. Matching is now greedy by
  descending score, one label per detection.
* `sys.exit(1)` on regression, inside a library. The verdict is returned; the
  CLI decides the exit code.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Sequence
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path

IOU_MATCH_THRESHOLD = 0.5
PUBLISHABLE_SCORE = 80.0

# Publishable Rate: of every 100 clips generated, how many does the creator say
# are worth posting. It is the single metric that decides whether this product
# is worth using -- ahead of latency, cost, or anything on the readiness audit.
# A tool that surfaces four good clips out of five replaces a job. One that
# surfaces one out of five *is* the job, with extra steps.
PUBLISHABLE_BANDS = (
    (0.85, "killer", "Creators would stop reviewing and let it run."),
    (0.70, "excellent", "Review becomes a formality."),
    (0.50, "good", "Worth the subscription on its own."),
    (0.30, "promising", "Useful, but the creator is still doing real work."),
    (0.00, "bad", "The creator is sorting our mistakes. That is not a product."),
)


def publishable_band(rate: float) -> tuple[str, str]:
    """Name the band a publishable rate falls into.

    Bands rather than a single pass/fail threshold, because the interesting
    question early is which direction it is moving, not whether it cleared a
    line somebody picked.
    """
    for floor, name, meaning in PUBLISHABLE_BANDS:
        if rate >= floor:
            return name, meaning
    return "bad", PUBLISHABLE_BANDS[-1][2]


def review_efficiency(publishable_rate: float, clips_per_hour: float,
                      seconds_per_review: float) -> dict:
    """The number that actually describes the experience.

    Publishable rate on its own can be gamed by generating fewer, safer clips.
    What a creator feels is: how many keepers did I get, and how long did it
    take to find them. Eight clips, six wanted, sixty seconds of reviewing is a
    different product from two clips, two wanted, and nothing to choose from.
    """
    keepers = clips_per_hour * publishable_rate
    review_seconds = clips_per_hour * seconds_per_review
    return {
        "keepers_per_stream_hour": round(keepers, 2),
        "review_seconds_per_stream_hour": round(review_seconds, 1),
        "seconds_of_review_per_keeper": (
            round(review_seconds / keepers, 1) if keepers else None
        ),
        # Three conditions, because any one alone is gameable. Enough keepers
        # to be worth opening; little enough reviewing to do after a stream;
        # and a hit rate high enough that the creator is choosing rather than
        # sorting. At 30% publishable they are still doing the job themselves,
        # however few seconds it takes.
        "verdict": (
            "worth it"
            if keepers >= 1.5 and review_seconds <= 90 and publishable_rate >= 0.5
            else "creator is still doing the sorting"
            if publishable_rate < 0.5
            else "too much reviewing for what it returns"
        ),
    }

# A regression gate that trips on noise gets switched off within a month.
MAX_F1_DROP = 0.05
MAX_PUBLISHABLE_DROP = 0.10
# Below this many labels, differences are noise and the gate abstains rather
# than pretending to have an opinion.
MIN_LABELS_FOR_GATE = 50


def iou(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    overlap = min(a_end, b_end) - max(a_start, b_start)
    if overlap <= 0:
        return 0.0
    union = max(a_end, b_end) - min(a_start, b_start)
    return overlap / union if union > 0 else 0.0


@dataclass
class EvalResult:
    dataset_name: str
    dataset_sha256: str
    sample_count: int
    labeled_moment_count: int
    detected_count: int
    true_positives: int
    false_positives: int
    false_negatives: int
    precision: float
    recall: float
    f1: float
    false_negative_rate: float
    publishable_rate: float
    boundary_error_seconds: float | None
    caption_wer: float | None = None
    crop_accuracy: float | None = None
    duplicate_rate: float | None = None
    # True when any sample is marked synthetic. A fixture dataset proves the
    # harness runs; it says nothing about whether the model is good, and
    # nothing downstream is allowed to treat it as if it did.
    synthetic: bool = False
    pipeline_version: str = ""
    prompt_version: str = ""
    model_version: str = ""
    ran_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class RegressionVerdict:
    regressed: bool
    abstained: bool
    reasons: list[str]

    @property
    def blocks_deploy(self) -> bool:
        return self.regressed


def dataset_digest(path: Path) -> str:
    """Content hash of the dataset.

    Stored with every result. Without it, "F1 went up" is unfalsifiable -- the
    dataset may simply have gotten easier.
    """
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_dataset(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(
            f"No dataset at {path}. Expected JSONL, one stream per line:\n"
            '  {"vod_id": "...", "media_path": "...", "duration_seconds": 3600,\n'
            '   "transcript": [{"start": 0, "end": 5, "text": "..."}],\n'
            '   "chat_events": [{"t": 123.4}],\n'
            '   "labels": [{"start": 120, "end": 165, "category": "reaction"}]}'
        )
    samples = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    if not samples:
        raise ValueError(f"Dataset {path} is empty")
    return samples


def evaluate(
    detect_fn: Callable[[dict], Sequence],
    dataset_path: Path,
    *,
    pipeline_version: str = "",
    prompt_version: str = "",
    model_version: str = "",
    caption_scorer: Callable[[dict], float] | None = None,
    crop_scorer: Callable[[dict], float] | None = None,
) -> EvalResult:
    """Run `detect_fn` over a labeled dataset.

    `detect_fn` takes one sample dict and returns objects with `.start`, `.end`
    and `.score`, so any detector shape can be evaluated.
    """
    samples = load_dataset(dataset_path)

    tp = fp = fn = 0
    detected_total = 0
    labeled_total = 0
    publishable = 0
    boundary_errors: list[float] = []
    caption_scores: list[float] = []
    crop_scores: list[float] = []

    for sample in samples:
        detections = sorted(detect_fn(sample), key=lambda d: d.score, reverse=True)
        labels = sample.get("labels") or sample.get("positive_moments") or []
        detected_total += len(detections)
        labeled_total += len(labels)

        claimed: set[int] = set()
        for det in detections:
            best_j, best_iou = -1, 0.0
            for j, label in enumerate(labels):
                if j in claimed:
                    continue
                score = iou(det.start, det.end, label["start"], label["end"])
                if score > best_iou:
                    best_iou, best_j = score, j

            if best_iou >= IOU_MATCH_THRESHOLD:
                tp += 1
                claimed.add(best_j)
                label = labels[best_j]
                # Mean of both edges. The original took min(), which reports the
                # better edge and hides a clip that starts on time and runs long.
                boundary_errors.append(
                    (abs(det.start - label["start"]) + abs(det.end - label["end"])) / 2
                )
                if det.score >= PUBLISHABLE_SCORE:
                    publishable += 1
            else:
                fp += 1

        fn += len(labels) - len(claimed)

        if caption_scorer is not None:
            caption_scores.append(caption_scorer(sample))
        if crop_scorer is not None:
            crop_scores.append(crop_scorer(sample))

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

    return EvalResult(
        dataset_name=dataset_path.stem,
        dataset_sha256=dataset_digest(dataset_path),
        sample_count=len(samples),
        labeled_moment_count=labeled_total,
        detected_count=detected_total,
        true_positives=tp,
        false_positives=fp,
        false_negatives=fn,
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1=round(f1, 4),
        false_negative_rate=round(fn / (tp + fn), 4) if (tp + fn) else 0.0,
        publishable_rate=round(publishable / detected_total, 4) if detected_total else 0.0,
        boundary_error_seconds=(
            round(sum(boundary_errors) / len(boundary_errors), 3) if boundary_errors else None
        ),
        caption_wer=(
            round(sum(caption_scores) / len(caption_scores), 4) if caption_scores else None
        ),
        crop_accuracy=(
            round(sum(crop_scores) / len(crop_scores), 4) if crop_scores else None
        ),
        pipeline_version=pipeline_version,
        prompt_version=prompt_version,
        model_version=model_version,
        synthetic=any(sample.get("synthetic") for sample in samples),
    )


def check_regression(
    candidate: EvalResult, baseline: EvalResult | None
) -> RegressionVerdict:
    """Compare a candidate against the current production baseline."""
    if candidate.synthetic:
        # A synthetic dataset is a smoke test for the harness. Gating a deploy on
        # it -- in either direction -- would be theatre.
        return RegressionVerdict(
            False, True,
            ["Dataset is synthetic. It proves the harness runs; it cannot approve "
             "or block a model."],
        )

    if baseline is None:
        return RegressionVerdict(False, True, ["No baseline recorded; nothing to compare."])

    if candidate.dataset_sha256 != baseline.dataset_sha256:
        return RegressionVerdict(
            False, True,
            ["Dataset changed since the baseline was set. Re-baseline before gating."],
        )

    if candidate.labeled_moment_count < MIN_LABELS_FOR_GATE:
        return RegressionVerdict(
            False, True,
            [f"Only {candidate.labeled_moment_count} labeled moments; the gate needs "
             f"{MIN_LABELS_FOR_GATE} before a difference means anything."],
        )

    reasons = []
    f1_drop = baseline.f1 - candidate.f1
    if f1_drop > MAX_F1_DROP:
        reasons.append(f"F1 fell {f1_drop:.3f} ({baseline.f1} -> {candidate.f1})")

    pub_drop = baseline.publishable_rate - candidate.publishable_rate
    if pub_drop > MAX_PUBLISHABLE_DROP:
        reasons.append(
            f"Publishable rate fell {pub_drop:.3f} "
            f"({baseline.publishable_rate} -> {candidate.publishable_rate})"
        )

    return RegressionVerdict(bool(reasons), False, reasons or ["Within tolerance."])
