"""The ClipR API. Everything a front end needs, and nothing it should not have.

    uvicorn packages.api.service:app --host 0.0.0.0 --port 8000
    make api

Why this exists: video processing cannot happen in a browser. ffmpeg, Whisper
and a few gigabytes of intermediate files need a machine. So the product splits
in two, and this is the seam:

    a front end (Base44, or anything else)   screens, auth, billing, review
    this service                             upload, process, score, serve

The front end never sees a filesystem path, never runs a subprocess, and never
needs to know that ffmpeg exists. It posts a video, polls a job, and gets back
clips with scores and reasons.

Design decisions worth knowing before building against it:

*Jobs are asynchronous and durable-ish.* A 20-minute VOD takes minutes, which
is far longer than any sensible HTTP timeout. POST returns immediately with an
id; poll it. State lives in a JSON file per job so a restart does not lose the
queue -- adequate for a beta, and the place to swap in Postgres when there is
more than one worker machine.

*Clip ids are opaque and scoped to a job.* Nothing accepts a filesystem path
from a caller.

*Verdicts are blind by default.* The API will hand over scores, but
`GET /jobs/{id}/clips?blind=true` omits them, and a verdict records which mode
it was collected in. A review UI that shows a creator "87/100" before they
judge produces a dataset that measures agreement with ClipR rather than
whether the clip is any good.

*Nothing here claims a clip is good.* `clip_score` means "worth reviewing".
Publishable Rate comes back only from real verdicts.
"""

from __future__ import annotations

import json
import os
import shutil
import threading
import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Any

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from packages.ai.clip_eval import band
from packages.ai.ranking import MINIMUM_CLIP_SCORE, RANKING_VERSION
from packages.media.probe import MediaError
from packages.pipeline import demo as pipeline

# Where jobs live. One directory per job: the source, the clips, the report.
DATA_ROOT = Path(os.environ.get("CLIPR_DATA_DIR", "data/jobs")).resolve()

# Server-to-server key. Absent means open, which is fine on a laptop and is
# refused below when the service is bound to anything other than localhost.
API_KEY = os.environ.get("CLIPR_API_KEY", "")

MAX_UPLOAD_BYTES = int(os.environ.get("CLIPR_MAX_UPLOAD_BYTES", 8 * 1024**3))
ALLOWED_SUFFIXES = {".mp4", ".mov", ".mkv", ".webm", ".m4v"}

# One video at a time per worker process. Each job already saturates the cores
# it is given; running three at once makes all three slow rather than one fast.
WORKERS = int(os.environ.get("CLIPR_CONCURRENT_JOBS", "1"))
_pool = ThreadPoolExecutor(max_workers=WORKERS)
_lock = threading.Lock()


class JobState(StrEnum):
    QUEUED = "queued"
    PROBING = "probing"
    TRANSCRIBING = "transcribing"
    DETECTING = "detecting"
    RANKING = "ranking"
    RENDERING = "rendering"
    READY = "ready"
    # The pipeline ran correctly and decided nothing was worth offering. This
    # is a success, and it must not share a state with failure or the quality
    # threshold gets quietly lowered until the red goes away.
    ABSTAINED = "abstained"
    FAILED = "failed"

    @property
    def terminal(self) -> bool:
        return self in (JobState.READY, JobState.ABSTAINED, JobState.FAILED)


# The order the pipeline moves through, so a front end can render a progress
# bar without hardcoding the list.
JOB_PROGRESS: dict[JobState, int] = {
    JobState.QUEUED: 0,
    JobState.PROBING: 5,
    JobState.TRANSCRIBING: 25,
    JobState.DETECTING: 55,
    JobState.RANKING: 70,
    JobState.RENDERING: 80,
    JobState.READY: 100,
    JobState.ABSTAINED: 100,
    JobState.FAILED: 100,
}


class ClipOut(BaseModel):
    id: str
    index: int
    start_seconds: float
    end_seconds: float
    duration_seconds: float
    media_url: str
    debug_media_url: str | None = None
    strategy: str | None = None
    caption_cues: int = 0
    # Omitted entirely in blind mode rather than nulled, so a front end cannot
    # accidentally render a zero as a score.
    clip_score: float | None = None
    dimensions: dict[str, float] | None = None
    why: dict[str, str] | None = None
    hook_text: str | None = None
    verdict: str | None = None


class JobOut(BaseModel):
    id: str
    state: JobState
    progress: int
    created_at: str
    updated_at: str
    filename: str | None = None
    duration_seconds: float | None = None
    ranking_version: str = RANKING_VERSION
    minimum_clip_score: float = MINIMUM_CLIP_SCORE
    clips_offered: int = 0
    error: str | None = None
    message: str | None = None
    warnings: list[str] = Field(default_factory=list)


class VerdictIn(BaseModel):
    verdict: str = Field(description="post | maybe | reject | skip")
    reasons: list[str] = Field(default_factory=list)
    blind: bool = True
    reviewer: str | None = None


class StatsOut(BaseModel):
    judged: int
    kept: int
    maybe: int
    rejected: int
    publishable_rate: float | None
    band: str | None
    reason_counts: dict[str, int]
    ranking_version: str
    blind_share: float | None
    note: str


VERDICTS = {"post", "maybe", "reject", "skip"}
# A maybe was offered and not approved, so it belongs in the denominator.
JUDGED = {"post", "maybe", "reject"}


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _job_dir(job_id: str) -> Path:
    # uuid4 hex only; nothing from a caller reaches the filesystem unchecked.
    if not job_id.isalnum() or len(job_id) != 32:
        raise HTTPException(404, "no such job")
    return DATA_ROOT / job_id


def _read_state(job_id: str) -> dict[str, Any]:
    path = _job_dir(job_id) / "job.json"
    if not path.exists():
        raise HTTPException(404, "no such job")
    return json.loads(path.read_text())


def _write_state(job_id: str, **changes: Any) -> dict[str, Any]:
    with _lock:
        path = _job_dir(job_id) / "job.json"
        state = json.loads(path.read_text()) if path.exists() else {}
        state.update(changes)
        state["updated_at"] = _now()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state, indent=2))
        return state


def require_key(authorization: str | None = Header(default=None)) -> None:
    """Bearer token, when one is configured."""
    if not API_KEY:
        return
    expected = f"Bearer {API_KEY}"
    if authorization != expected:
        raise HTTPException(401, "invalid or missing API key")


app = FastAPI(
    title="ClipR API",
    version="1.0.0",
    description=__doc__,
)

# A browser app on another origin is the expected caller.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("CLIPR_CORS_ORIGINS", "*").split(",") if o],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/v1/health", tags=["meta"])
def health() -> dict:
    """Liveness, and what the engine can actually do right now."""
    from packages.ai.transcribe import available_engines

    return {
        "ok": True,
        "ranking_version": RANKING_VERSION,
        "minimum_clip_score": MINIMUM_CLIP_SCORE,
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "ffprobe": bool(shutil.which("ffprobe")),
        "asr_engines": available_engines(),
        "concurrent_jobs": WORKERS,
        "data_dir": str(DATA_ROOT),
    }


def _run_job(job_id: str) -> None:
    """Process one video. Runs on the pool, never in a request."""
    directory = _job_dir(job_id)
    state = _read_state(job_id)
    source = directory / state["filename"]

    try:
        _write_state(job_id, state=JobState.PROBING)
        # The pipeline reports its own stages; this maps the coarse ones a
        # front end needs onto it. A finer-grained callback is the obvious
        # next step and does not change this contract.
        _write_state(job_id, state=JobState.TRANSCRIBING)
        report = pipeline.run(source, directory, clips_wanted=state.get("clips", 3))

        payload = report.to_dict()
        (directory / "demo_report.json").write_text(json.dumps(payload, indent=2))

        if report.abstained or not report.clips:
            _write_state(
                job_id, state=JobState.ABSTAINED, clips_offered=0,
                warnings=report.warnings,
                message=(f"No moment scored above {MINIMUM_CLIP_SCORE:.0f}. "
                         f"ClipR is not offering clips it does not rate."),
                duration_seconds=payload.get("source", {}).get("duration_seconds"),
            )
            return

        _write_state(
            job_id, state=JobState.READY, clips_offered=len(report.clips),
            warnings=report.warnings,
            duration_seconds=payload.get("source", {}).get("duration_seconds"),
        )
    except MediaError as exc:
        _write_state(job_id, state=JobState.FAILED, error=str(exc))
    except Exception as exc:  # noqa: BLE001 - a failed job must not kill the worker
        _write_state(job_id, state=JobState.FAILED,
                     error=f"{type(exc).__name__}: {exc}")


@app.post("/api/v1/jobs", response_model=JobOut, status_code=202, tags=["jobs"])
async def create_job(
    background: BackgroundTasks,
    file: UploadFile = File(..., description="mp4, mov, mkv or webm"),
    clips: int = Query(3, ge=1, le=10),
    _: None = Depends(require_key),
) -> JobOut:
    """Submit a video. Returns immediately; poll the job for progress.

    Processing a 20-minute VOD takes minutes, which is longer than any
    reasonable HTTP timeout, so this never waits for it.
    """
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            415, f"Unsupported file type '{suffix or 'none'}'. "
                 f"Accepted: {', '.join(sorted(ALLOWED_SUFFIXES))}")

    job_id = uuid.uuid4().hex
    directory = DATA_ROOT / job_id
    directory.mkdir(parents=True, exist_ok=True)

    # Stream to disk. Reading an 8 GB upload into memory would end the process.
    safe_name = f"source{suffix}"
    target = directory / safe_name
    written = 0
    with target.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            written += len(chunk)
            if written > MAX_UPLOAD_BYTES:
                out.close()
                shutil.rmtree(directory, ignore_errors=True)
                raise HTTPException(413, "upload exceeds the size limit")
            out.write(chunk)

    if written == 0:
        shutil.rmtree(directory, ignore_errors=True)
        raise HTTPException(400, "empty upload")

    state = _write_state(
        job_id, id=job_id, state=JobState.QUEUED, created_at=_now(),
        filename=safe_name, original_filename=file.filename, clips=clips,
        bytes=written, ranking_version=RANKING_VERSION,
    )
    _pool.submit(_run_job, job_id)
    return _to_job_out(state)


def _to_job_out(state: dict) -> JobOut:
    job_state = JobState(state.get("state", JobState.QUEUED))
    return JobOut(
        id=state["id"],
        state=job_state,
        progress=JOB_PROGRESS.get(job_state, 0),
        created_at=state.get("created_at", _now()),
        updated_at=state.get("updated_at", _now()),
        filename=state.get("original_filename"),
        duration_seconds=state.get("duration_seconds"),
        ranking_version=state.get("ranking_version", RANKING_VERSION),
        clips_offered=state.get("clips_offered", 0),
        error=state.get("error"),
        message=state.get("message"),
        warnings=state.get("warnings", []),
    )


@app.get("/api/v1/jobs", tags=["jobs"])
def list_jobs(limit: int = Query(50, ge=1, le=500),
              _: None = Depends(require_key)) -> list[JobOut]:
    """Most recent jobs first."""
    if not DATA_ROOT.exists():
        return []
    states = []
    for path in DATA_ROOT.glob("*/job.json"):
        try:
            states.append(json.loads(path.read_text()))
        except (OSError, json.JSONDecodeError):
            continue
    states.sort(key=lambda s: s.get("created_at", ""), reverse=True)
    return [_to_job_out(s) for s in states[:limit]]


@app.get("/api/v1/jobs/{job_id}", response_model=JobOut, tags=["jobs"])
def get_job(job_id: str, _: None = Depends(require_key)) -> JobOut:
    """Poll this until `state` is ready, abstained or failed."""
    return _to_job_out(_read_state(job_id))


@app.delete("/api/v1/jobs/{job_id}", status_code=204, tags=["jobs"])
def delete_job(job_id: str, _: None = Depends(require_key)) -> None:
    """Delete a job and everything it produced.

    Account deletion has to be able to reach the media, so this removes the
    source video too rather than only the database row.
    """
    directory = _job_dir(job_id)
    if not directory.exists():
        raise HTTPException(404, "no such job")
    shutil.rmtree(directory, ignore_errors=True)


def _verdicts(job_id: str) -> dict[str, dict]:
    path = _job_dir(job_id) / "verdicts.json"
    if not path.exists():
        return {}
    return {v["clip"]: v for v in json.loads(path.read_text())}


@app.get("/api/v1/jobs/{job_id}/clips", tags=["clips"],
         response_model_exclude_none=True)
def get_clips(
    job_id: str,
    blind: bool = Query(True, description=(
        "Omit scores and reasoning. Default true: showing a creator the score "
        "before they judge anchors the verdict and contaminates the dataset.")),
    _: None = Depends(require_key),
) -> list[ClipOut]:
    state = _read_state(job_id)
    if state.get("state") == JobState.ABSTAINED:
        return []
    report_path = _job_dir(job_id) / "demo_report.json"
    if not report_path.exists():
        raise HTTPException(409, f"job is {state.get('state')}, not ready")

    report = json.loads(report_path.read_text())
    seen = _verdicts(job_id)
    out = []
    for clip in report.get("clips", []):
        name = Path(clip["path"]).name
        clip_id = Path(name).stem
        verdict = seen.get(name, {}).get("verdict")
        entry = ClipOut(
            id=clip_id,
            index=clip["index"],
            start_seconds=clip["start"],
            end_seconds=clip["end"],
            duration_seconds=round(clip["end"] - clip["start"], 2),
            media_url=f"/api/v1/jobs/{job_id}/clips/{clip_id}/media",
            debug_media_url=f"/api/v1/jobs/{job_id}/clips/{clip_id}/media?debug=true",
            strategy=clip.get("strategy"),
            caption_cues=clip.get("caption_cues", 0),
            verdict=verdict,
        )
        if not blind:
            entry.clip_score = clip.get("clip_score")
            entry.dimensions = clip.get("dimensions")
            entry.why = clip.get("why")
            entry.hook_text = clip.get("hook_text")
        out.append(entry)
    return out


@app.get("/api/v1/jobs/{job_id}/clips/{clip_id}/media", tags=["clips"])
def get_clip_media(job_id: str, clip_id: str, debug: bool = False,
                   _: None = Depends(require_key)) -> FileResponse:
    """The MP4 itself. Supports range requests, so it seeks in a <video> tag."""
    directory = _job_dir(job_id)
    name = f"{Path(clip_id).name}{'_debug' if debug else ''}.mp4"
    target = (directory / name).resolve()
    if target.parent != directory.resolve() or not target.is_file():
        raise HTTPException(404, "no such clip")
    return FileResponse(target, media_type="video/mp4", filename=name)


@app.get("/api/v1/jobs/{job_id}/transcript", tags=["clips"])
def get_transcript(job_id: str, _: None = Depends(require_key)) -> JSONResponse:
    path = _job_dir(job_id) / "transcript.json"
    if not path.exists():
        raise HTTPException(404, "no transcript for this job")
    return JSONResponse(json.loads(path.read_text()))


@app.post("/api/v1/jobs/{job_id}/clips/{clip_id}/verdict", tags=["review"])
def post_verdict(job_id: str, clip_id: str, body: VerdictIn,
                 _: None = Depends(require_key)) -> dict:
    """Record keep / maybe / reject, and why.

    The reasons are the valuable part. A rate says something is wrong; the
    reasons say what, and "bad crop" and "missing context" lead to different
    code.
    """
    if body.verdict not in VERDICTS:
        raise HTTPException(422, f"verdict must be one of {sorted(VERDICTS)}")

    directory = _job_dir(job_id)
    if not directory.exists():
        raise HTTPException(404, "no such job")

    name = f"{Path(clip_id).name}.mp4"
    record = {
        "clip": name,
        "verdict": body.verdict,
        "reasons": body.reasons,
        "blind": body.blind,
        "reviewer": body.reviewer,
        "ranking_version": _read_state(job_id).get("ranking_version", RANKING_VERSION),
        "at": _now(),
    }

    with _lock:
        path = directory / "verdicts.json"
        existing = json.loads(path.read_text()) if path.exists() else []
        # Re-reviewing replaces rather than appends, so the rate cannot drift
        # by revisiting a clip.
        existing = [v for v in existing if v.get("clip") != name]
        existing.append(record)
        path.write_text(json.dumps(existing, indent=2))

    judged = [v for v in existing if v["verdict"] in JUDGED]
    kept = sum(1 for v in judged if v["verdict"] == "post")
    rate = kept / len(judged) if judged else None
    return {
        "ok": True,
        "judged": len(judged),
        "publishable_rate": round(rate, 4) if rate is not None else None,
        "band": band(rate) if rate is not None else None,
    }


def _all_verdicts() -> Iterator[dict]:
    if not DATA_ROOT.exists():
        return
    for path in DATA_ROOT.glob("*/verdicts.json"):
        try:
            yield from json.loads(path.read_text())
        except (OSError, json.JSONDecodeError):
            continue


@app.get("/api/v1/stats", response_model=StatsOut, tags=["review"])
def stats(_: None = Depends(require_key)) -> StatsOut:
    """Publishable Rate and rejection reasons across every job.

    This is the product's north star. It exists only because creators pressed
    buttons; nothing here derives it from the model's own scores.
    """
    rows = [v for v in _all_verdicts() if v.get("verdict") in JUDGED]
    kept = sum(1 for v in rows if v["verdict"] == "post")
    maybe = sum(1 for v in rows if v["verdict"] == "maybe")
    rejected = sum(1 for v in rows if v["verdict"] == "reject")

    reasons: dict[str, int] = {}
    for row in rows:
        if row["verdict"] != "reject":
            continue
        for reason in row.get("reasons") or ["unspecified"]:
            reasons[reason] = reasons.get(reason, 0) + 1

    rate = kept / len(rows) if rows else None
    blind_share = (sum(1 for v in rows if v.get("blind")) / len(rows)
                   if rows else None)

    return StatsOut(
        judged=len(rows), kept=kept, maybe=maybe, rejected=rejected,
        publishable_rate=round(rate, 4) if rate is not None else None,
        band=band(rate) if rate is not None else None,
        reason_counts=dict(sorted(reasons.items(), key=lambda kv: -kv[1])),
        ranking_version=RANKING_VERSION,
        blind_share=round(blind_share, 3) if blind_share is not None else None,
        note=("Publishable Rate is approvals over everything offered; a "
              "'maybe' counts as offered and not approved. Under ~100 judged "
              "clips this moves several points per verdict."),
    )
