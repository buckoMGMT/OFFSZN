"""Platform publishing adapters, and the degrade path that keeps the product
alive when a platform takes API access away.

The top risk in the whole business is that unattended multi-account posting is
exactly the pattern platforms police, and access can be revoked with no notice.
A product whose core promise evaporates on that day is badly designed, so every
adapter has three states rather than two:

    published        the post is live, with a real ID from the platform
    manual_handoff   we rendered, captioned, staged and notified; the creator
                     finishes with one tap
    failed           something went wrong that retrying may fix

`manual_handoff` is the whole mitigation. It turns loss of API access into a
worse product instead of no product, and it is exercised by default in dev
because credentials are absent there -- so the fallback path is the one that
runs most often, rather than the one nobody has ever seen.

No adapter ever invents a post ID. The earlier version returned
`external_post_id="placeholder_post_id"` with `success=True`, which writes a
fabricated success into the database and reports a green publish rate.
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional, Protocol


class PublishStatus(str, Enum):
    PUBLISHED = "published"
    PROCESSING = "processing"
    MANUAL_HANDOFF = "manual_handoff"
    FAILED = "failed"


@dataclass
class PublishRequest:
    clip_id: str
    workspace_id: str
    social_account_id: str
    video_path: str
    caption: str
    hashtags: list[str] = field(default_factory=list)
    access_token: str = ""
    scheduled_for: Optional[datetime] = None

    @property
    def idempotency_key(self) -> str:
        # Same clip to the same account is the same post, forever. The database
        # carries the matching UNIQUE(clip_id, social_account_id).
        return f"{self.clip_id}:{self.social_account_id}"


@dataclass
class PublishResult:
    status: PublishStatus
    external_post_id: Optional[str] = None
    external_post_url: Optional[str] = None
    handoff_deeplink: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    retry_after: Optional[timedelta] = None

    @property
    def success(self) -> bool:
        return self.status is PublishStatus.PUBLISHED

    @property
    def needs_user(self) -> bool:
        return self.status is PublishStatus.MANUAL_HANDOFF


class Transport(Protocol):
    """Minimal HTTP surface, injected so adapters are testable offline."""
    def post(self, url: str, *, headers: dict, json: dict) -> "Response": ...
    def put_file(self, url: str, *, path: str, headers: dict) -> "Response": ...


@dataclass
class Response:
    status_code: int
    json_body: dict = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return 200 <= self.status_code < 300


# Errors worth retrying; anything else is a bug or a permission problem and
# retrying it just burns quota and looks like abuse to the platform.
RETRYABLE_STATUS = {408, 429, 500, 502, 503, 504}


class Adapter(ABC):
    platform: str
    handoff_scheme: str

    def __init__(self, transport: Optional[Transport] = None):
        self.transport = transport

    @property
    @abstractmethod
    def credentialed(self) -> bool:
        """Whether this deployment holds approved API credentials."""

    @abstractmethod
    def _publish(self, req: PublishRequest) -> PublishResult: ...

    def publish(self, req: PublishRequest) -> PublishResult:
        if not self.credentialed or self.transport is None:
            return self.handoff(req, "PLATFORM_API_UNAVAILABLE",
                                f"{self.platform} API access is not configured for this "
                                f"deployment. The clip is rendered and staged.")
        try:
            return self._publish(req)
        except Exception as exc:  # noqa: BLE001 - deliberate boundary
            # An unexpected failure inside an unattended pipeline must still
            # leave the creator with something they can post.
            return self.handoff(req, "ADAPTER_ERROR", str(exc))

    def handoff(self, req: PublishRequest, code: str, message: str) -> PublishResult:
        return PublishResult(
            status=PublishStatus.MANUAL_HANDOFF,
            handoff_deeplink=f"{self.handoff_scheme}://publish?clip={req.clip_id}",
            error_code=code,
            error_message=message,
        )

    @staticmethod
    def backoff(attempt: int) -> timedelta:
        # 30s, 2m, 8m, 32m, capped. Slow enough not to look like a hammer.
        return timedelta(seconds=min(30 * (4 ** max(0, attempt)), 3600))


class TikTokAdapter(Adapter):
    platform = "tiktok"
    handoff_scheme = "clipr"
    BASE = "https://open.tiktokapis.com/v2"

    @property
    def credentialed(self) -> bool:
        return bool(os.environ.get("TIKTOK_CLIENT_KEY") and os.environ.get("TIKTOK_CLIENT_SECRET"))

    def _publish(self, req: PublishRequest) -> PublishResult:
        size = os.path.getsize(req.video_path)
        init = self.transport.post(
            f"{self.BASE}/post/publish/video/init/",
            headers={
                "Authorization": f"Bearer {req.access_token}",
                "Content-Type": "application/json",
                "X-Idempotency-Key": req.idempotency_key,
            },
            json={
                "post_info": {
                    "title": self._title(req),
                    "privacy_level": "PUBLIC_TO_EVERYONE",
                },
                "source_info": {
                    "source": "FILE_UPLOAD",
                    "video_size": size,
                    "chunk_size": size,
                    "total_chunk_count": 1,
                },
            },
        )
        if not init.ok:
            return self._from_error(req, init)

        data = init.json_body.get("data", {})
        upload_url, publish_id = data.get("upload_url"), data.get("publish_id")
        if not upload_url or not publish_id:
            return self.handoff(req, "MALFORMED_INIT_RESPONSE",
                                "TikTok accepted the init call but returned no upload URL.")

        upload = self.transport.put_file(
            upload_url, path=req.video_path,
            headers={"Content-Type": "video/mp4",
                     "Content-Range": f"bytes 0-{size - 1}/{size}"},
        )
        if not upload.ok:
            return self._from_error(req, upload)

        # TikTok finishes asynchronously. Reporting PROCESSING and polling is
        # the honest state; claiming PUBLISHED here would make our published
        # count higher than the number of posts that actually exist.
        return PublishResult(status=PublishStatus.PROCESSING, external_post_id=publish_id)

    def _title(self, req: PublishRequest) -> str:
        tags = " ".join(f"#{t.lstrip('#')}" for t in req.hashtags)
        return f"{req.caption} {tags}".strip()[:2200]

    def _from_error(self, req: PublishRequest, resp: Response) -> PublishResult:
        code = str(resp.json_body.get("error", {}).get("code", resp.status_code))
        msg = resp.json_body.get("error", {}).get("message", f"HTTP {resp.status_code}")
        if resp.status_code in RETRYABLE_STATUS:
            return PublishResult(
                status=PublishStatus.FAILED, error_code=code, error_message=msg,
                retry_after=self.backoff(0),
            )
        # 401/403 means the grant is gone. Retrying will not bring it back, and
        # the creator should be able to post the clip today.
        return self.handoff(req, code, msg)


class InstagramAdapter(TikTokAdapter):
    platform = "instagram"
    BASE = "https://graph.facebook.com/v21.0"

    @property
    def credentialed(self) -> bool:
        return bool(os.environ.get("INSTAGRAM_APP_ID") and os.environ.get("INSTAGRAM_APP_SECRET"))


class YouTubeAdapter(TikTokAdapter):
    platform = "youtube"
    BASE = "https://www.googleapis.com/upload/youtube/v3"

    @property
    def credentialed(self) -> bool:
        return bool(os.environ.get("YOUTUBE_CLIENT_ID") and os.environ.get("YOUTUBE_CLIENT_SECRET"))


class Registry:
    def __init__(self, transport: Optional[Transport] = None):
        self._adapters = {
            a.platform: a for a in (
                TikTokAdapter(transport),
                InstagramAdapter(transport),
                YouTubeAdapter(transport),
            )
        }

    def get(self, platform: str) -> Adapter:
        try:
            return self._adapters[platform]
        except KeyError:
            raise ValueError(
                f"No adapter for {platform!r}. Available: {', '.join(self._adapters)}"
            ) from None

    def capabilities(self) -> dict[str, str]:
        """What this deployment can actually do right now.

        Surfaced in the UI so nobody connects an account expecting auto-posting
        that this environment cannot perform.
        """
        return {
            name: ("auto" if a.credentialed else "manual_handoff")
            for name, a in self._adapters.items()
        }
