"""Publishing adapters and the degrade path.

The scenario these tests describe is the top risk in the business: a platform
withdraws API access with no notice, and every clip in the pipeline has nowhere
to go. The requirement is that the product gets worse rather than stopping, and
that it never reports a post that does not exist.
"""

import os
from datetime import timedelta

import pytest

from packages.publishing.adapter import (
    Adapter, PublishRequest, PublishStatus, Registry, Response, TikTokAdapter,
)


class FakeTransport:
    def __init__(self, *responses: Response):
        self.responses = list(responses)
        self.calls: list[tuple[str, dict]] = []

    def _next(self, url, headers):
        self.calls.append((url, headers))
        return self.responses.pop(0) if self.responses else Response(500)

    def post(self, url, *, headers, json):
        return self._next(url, headers)

    def put_file(self, url, *, path, headers):
        return self._next(url, headers)


@pytest.fixture
def req(tmp_path):
    video = tmp_path / "clip.mp4"
    video.write_bytes(b"\x00" * 2048)
    return PublishRequest(
        clip_id="clip-1", workspace_id="ws-1", social_account_id="acct-1",
        video_path=str(video), caption="huge play", hashtags=["clips"],
        access_token="token",
    )


@pytest.fixture
def credentialed(monkeypatch):
    monkeypatch.setenv("TIKTOK_CLIENT_KEY", "key")
    monkeypatch.setenv("TIKTOK_CLIENT_SECRET", "secret")


@pytest.fixture
def uncredentialed(monkeypatch):
    monkeypatch.delenv("TIKTOK_CLIENT_KEY", raising=False)
    monkeypatch.delenv("TIKTOK_CLIENT_SECRET", raising=False)


# --- the degrade path ------------------------------------------------------

def test_no_credentials_produces_a_handoff_not_a_failure(req, uncredentialed):
    result = TikTokAdapter().publish(req)
    assert result.status is PublishStatus.MANUAL_HANDOFF
    assert result.needs_user
    assert result.handoff_deeplink and req.clip_id in result.handoff_deeplink


def test_handoff_explains_itself_in_the_creators_terms(req, uncredentialed):
    result = TikTokAdapter().publish(req)
    assert "rendered and staged" in result.error_message


def test_revoked_access_degrades_rather_than_retrying_forever(req, credentialed):
    """401 means the grant is gone. Retrying will not bring it back, and the
    creator should still be able to post today."""
    transport = FakeTransport(Response(401, {"error": {"code": "access_token_invalid",
                                                       "message": "revoked"}}))
    result = TikTokAdapter(transport).publish(req)
    assert result.status is PublishStatus.MANUAL_HANDOFF
    assert result.error_code == "access_token_invalid"


def test_an_unexpected_exception_still_leaves_the_creator_something(req, credentialed):
    class Exploding:
        def post(self, *a, **k):
            raise RuntimeError("connection reset")

        def put_file(self, *a, **k):
            raise RuntimeError("connection reset")

    result = TikTokAdapter(Exploding()).publish(req)
    assert result.status is PublishStatus.MANUAL_HANDOFF
    assert "connection reset" in result.error_message


# --- never invent a success ------------------------------------------------

def test_no_adapter_ever_fabricates_a_post_id(req, uncredentialed):
    """The original returned external_post_id='placeholder_post_id' with
    success=True, which writes a fake success into the database and reports a
    green publish rate."""
    for adapter in Registry().  _adapters.values():  # noqa: E211 - readability
        result = adapter.publish(req)
        assert not result.success
        assert result.external_post_id is None


def test_async_platform_reports_processing_not_published(req, credentialed):
    """TikTok finishes asynchronously. Claiming PUBLISHED at upload time makes
    our published count higher than the number of posts that exist."""
    transport = FakeTransport(
        Response(200, {"data": {"upload_url": "https://upload", "publish_id": "pub-9"}}),
        Response(200),
    )
    result = TikTokAdapter(transport).publish(req)
    assert result.status is PublishStatus.PROCESSING
    assert result.external_post_id == "pub-9"
    assert not result.success


def test_init_without_an_upload_url_is_a_handoff(req, credentialed):
    transport = FakeTransport(Response(200, {"data": {}}))
    result = TikTokAdapter(transport).publish(req)
    assert result.status is PublishStatus.MANUAL_HANDOFF


# --- retries ---------------------------------------------------------------

def test_rate_limiting_is_retried_with_a_delay(req, credentialed):
    transport = FakeTransport(Response(429, {"error": {"code": "rate_limit",
                                                       "message": "slow down"}}))
    result = TikTokAdapter(transport).publish(req)
    assert result.status is PublishStatus.FAILED
    assert result.retry_after is not None


def test_backoff_grows_and_is_capped():
    delays = [Adapter.backoff(i) for i in range(6)]
    assert delays == sorted(delays)
    assert delays[-1] == timedelta(seconds=3600)


# --- idempotency -----------------------------------------------------------

def test_idempotency_key_is_stable_per_clip_and_account(req):
    other = PublishRequest(
        clip_id="clip-1", workspace_id="ws-1", social_account_id="acct-2",
        video_path=req.video_path, caption="x",
    )
    assert req.idempotency_key == "clip-1:acct-1"
    assert req.idempotency_key != other.idempotency_key


def test_idempotency_key_is_sent_to_the_platform(req, credentialed):
    transport = FakeTransport(
        Response(200, {"data": {"upload_url": "https://upload", "publish_id": "p"}}),
        Response(200),
    )
    TikTokAdapter(transport).publish(req)
    _, headers = transport.calls[0]
    assert headers["X-Idempotency-Key"] == req.idempotency_key


# --- registry --------------------------------------------------------------

def test_capabilities_report_what_this_deployment_can_actually_do(uncredentialed, monkeypatch):
    monkeypatch.delenv("INSTAGRAM_APP_ID", raising=False)
    monkeypatch.delenv("YOUTUBE_CLIENT_ID", raising=False)
    caps = Registry().capabilities()
    assert set(caps) == {"tiktok", "instagram", "youtube"}
    assert all(v == "manual_handoff" for v in caps.values())


def test_unknown_platform_names_the_known_ones():
    with pytest.raises(ValueError, match="tiktok"):
        Registry().get("myspace")
