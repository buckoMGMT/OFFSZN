"""Measuring whether ClipR picks clips a creator would post.

This is the scoreboard the ranking model is built against, and the reason it
exists is that every accuracy claim made about ClipR so far has been circular:
moments were planted in a generated file and then "detected", which measures
nothing except that the same code wrote and read the same numbers.

The unit of truth here is a human label. For each VOD a person marks the
moments they would genuinely have posted, with a *range* of acceptable start
and end points rather than a single timestamp, because two editors will not
agree on a frame and a metric that demands they do is measuring noise.

    evaluation/creator_vods/<name>.json
    {
      "media_path": "/path/to/vod.mp4",
      "duration_seconds": 3600,
      "labels": [
        {"start_range": [1245, 1258], "end_range": [1280, 1295],
         "quality": 4, "category": "reaction",
         "why": "genuine surprise, lands without setup",
         "needs_context": false}
      ]
    }

What gets reported:

    recall@k          did the top k contain a moment a human wanted
    precision@k       how many of the top k are moments a human wanted
    boundary quality  how close the cut points are to the accepted ranges
    duplicate rate    how many offered clips are the same moment twice
    publishable rate  approved / offered -- the north star, and the one
                      number that cannot be computed without a person

`publishable_rate` is deliberately None until a human has reviewed. Deriving it
from labels would make it a restatement of precision and quietly turn the north
star into something the model can satisfy on its own.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

DEFAULT_DATASET_DIR = Path("evaluation/creator_vods")

# Bands from the product review. They describe the experience, not a pass mark.
PUBLISHABLE_BANDS = (
    (0.85, "exceptional"),
    (0.70, "strong"),
    (0.50, "promising"),
    (0.30, "weak"),
    (0.00, "bad"),
)


@dataclass
class Label:
    """One moment a human said they would post."""
    start_range: tuple[float, float]
    end_range: tuple[float, float]
    quality: int = 3           # 1-5, how much they wanted it
    category: str = ""
    why: str = ""
    needs_context: bool = False

    @property
    def start(self) -> float:
        return sum(self.start_range) / 2

    @property
    def end(self) -> float:
        return sum(self.end_range) / 2

    def contains(self, start: float, end: float, tolerance: float = 6.0) -> bool:
        """Whether a clip is pointed at this moment at all.

        Deliberately loose. Hitting the moment and framing it well are two
        different questions, and conflating them means a clip that found the
        right instant but started three seconds late scores as a total miss.
        """
        return (start <= self.end_range[1] + tolerance
                and end >= self.start_range[0] - tolerance)

    def boundary_error(self, start: float, end: float) -> float:
        """Seconds outside the accepted ranges. Zero when inside them."""
        start_error = max(0.0, self.start_range[0] - start,
                          start - self.start_range[1])
        end_error = max(0.0, self.end_range[0] - end, end - self.end_range[1])
        return round((start_error + end_error) / 2, 2)


@dataclass
class LabeledVod:
    name: str
    media_path: str
    duration_seconds: float
    labels: list[Label] = field(default_factory=list)

    @classmethod
    def load(cls, path: Path) -> LabeledVod:
        data = json.loads(Path(path).read_text())
        return cls(
            name=data.get("name") or Path(path).stem,
            media_path=data["media_path"],
            duration_seconds=float(data.get("duration_seconds") or 0.0),
            labels=[
                Label(
                    start_range=tuple(item["start_range"]),
                    end_range=tuple(item["end_range"]),
                    quality=int(item.get("quality", 3)),
                    category=item.get("category", ""),
                    why=item.get("why", ""),
                    needs_context=bool(item.get("needs_context", False)),
                )
                for item in data.get("labels", [])
            ],
        )


def load_dataset(directory: Path = DEFAULT_DATASET_DIR) -> list[LabeledVod]:
    directory = Path(directory)
    if not directory.is_dir():
        raise FileNotFoundError(
            f"No evaluation set at {directory}.\n"
            f"Create it by labelling real VODs: for each one, write the moments "
            f"you would actually have posted, with acceptable start and end "
            f"ranges. Twenty VODs is the point at which the numbers below start "
            f"meaning something."
        )
    files = sorted(directory.glob("*.json"))
    if not files:
        raise FileNotFoundError(f"{directory} contains no labelled VODs.")
    return [LabeledVod.load(f) for f in files]


@dataclass
class VodResult:
    vod: str
    labels: int
    offered: int
    hits: int
    recall_at_k: float
    precision_at_k: float
    boundary_error_seconds: float | None
    duplicates: int
    missed: list[dict] = field(default_factory=list)
    matched: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def evaluate_vod(vod: LabeledVod, clips: list, k: int = 3) -> VodResult:
    """Score one VOD's offered clips against its human labels.

    `clips` are objects with `.start`, `.end` and `.clip_score` -- normally
    RankedClips, but anything with that shape works so a different ranker can
    be measured on the same dataset.
    """
    top = sorted(clips, key=lambda c: c.clip_score, reverse=True)[:k]

    claimed: set[int] = set()
    errors: list[float] = []
    matched: list[dict] = []
    duplicates = 0

    for clip in top:
        hit_index = None
        for i, label in enumerate(vod.labels):
            if not label.contains(clip.start, clip.end):
                continue
            if i in claimed:
                # A second clip pointed at a moment already covered. That is a
                # duplicate from the creator's point of view even when the
                # spans barely overlap.
                duplicates += 1
                hit_index = None
                break
            hit_index = i
            break

        if hit_index is None:
            continue
        claimed.add(hit_index)
        label = vod.labels[hit_index]
        error = label.boundary_error(clip.start, clip.end)
        errors.append(error)
        matched.append({
            "clip": [round(clip.start, 1), round(clip.end, 1)],
            "label": [label.start_range, label.end_range],
            "boundary_error_seconds": error,
            "label_quality": label.quality,
            "category": label.category,
        })

    hits = len(claimed)
    missed = [
        {"start_range": lab.start_range, "end_range": lab.end_range,
         "quality": lab.quality, "category": lab.category, "why": lab.why}
        for i, lab in enumerate(vod.labels) if i not in claimed
    ]

    return VodResult(
        vod=vod.name,
        labels=len(vod.labels),
        offered=len(top),
        hits=hits,
        recall_at_k=round(hits / len(vod.labels), 4) if vod.labels else 0.0,
        precision_at_k=round(hits / len(top), 4) if top else 0.0,
        boundary_error_seconds=(round(sum(errors) / len(errors), 2)
                                if errors else None),
        duplicates=duplicates,
        missed=missed,
        matched=matched,
    )


def aggregate(results: list[VodResult], k: int = 3) -> dict:
    """Roll per-VOD results into the numbers that drive decisions."""
    if not results:
        return {"vods": 0, "status": "no labelled VODs; nothing measured"}

    total_labels = sum(r.labels for r in results)
    total_hits = sum(r.hits for r in results)
    total_offered = sum(r.offered for r in results)
    errors = [r.boundary_error_seconds for r in results
              if r.boundary_error_seconds is not None]

    return {
        "vods": len(results),
        "labelled_moments": total_labels,
        "clips_offered": total_offered,
        f"recall_at_{k}": round(total_hits / total_labels, 4) if total_labels else 0.0,
        f"precision_at_{k}": round(total_hits / total_offered, 4) if total_offered else 0.0,
        "boundary_error_seconds": round(sum(errors) / len(errors), 2) if errors else None,
        "duplicate_rate": round(sum(r.duplicates for r in results)
                                / total_offered, 4) if total_offered else 0.0,
        # Only a person can fill this in. Deriving it from labels would make it
        # a restatement of precision and let the model mark its own homework.
        "publishable_rate": None,
        "publishable_rate_note": (
            "Approved / offered, filled in after a creator reviews the clips. "
            "Not derivable from labels."
        ),
        "enough_data": len(results) >= 20,
        "status": (
            "measured" if len(results) >= 20 else
            f"{len(results)} VODs is not enough to draw a conclusion; "
            f"differences at this size are noise. Twenty is the target."
        ),
    }


def band(rate: float) -> str:
    for floor, name in PUBLISHABLE_BANDS:
        if rate >= floor:
            return name
    return "bad"


def record_review(out_path: Path, vod: str, decisions: list[dict]) -> dict:
    """Store a creator's keep/reject calls and compute the publishable rate.

    `decisions` are {"clip": "clip_01.mp4", "verdict": "post"|"maybe"|"reject",
    "reasons": ["too long", "bad crop", ...]}. The reasons are the valuable
    part: a rate tells you something is wrong, the reasons tell you what.
    """
    posted = sum(1 for d in decisions if d.get("verdict") == "post")
    offered = len(decisions)
    rate = posted / offered if offered else 0.0

    reason_counts: dict[str, int] = {}
    for decision in decisions:
        for reason in decision.get("reasons", []):
            reason_counts[reason] = reason_counts.get(reason, 0) + 1

    payload = {
        "vod": vod,
        "offered": offered,
        "posted": posted,
        "publishable_rate": round(rate, 4),
        "band": band(rate),
        "top_reasons": sorted(reason_counts.items(), key=lambda kv: -kv[1]),
        "decisions": decisions,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    existing = []
    if out_path.exists():
        existing = json.loads(out_path.read_text())
    existing.append(payload)
    out_path.write_text(json.dumps(existing, indent=2))
    return payload
