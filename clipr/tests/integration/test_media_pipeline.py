"""Integration tests: real ffmpeg, real files, no mocks.

The reason this directory exists separately from `tests/` is a specific
failure. Three hundred unit tests passed while the pipeline produced a clip
nobody could see anything in, because the unit tests asserted against
*assumptions about ffmpeg* rather than against ffmpeg. Two of those
assumptions were wrong in ways no amount of mocking could ever have revealed:

* `astats reset=N` counts audio frames, not seconds
* `drawbox` fixes its coordinates at filter init and ignores `eval`

Mocks are fine in `tests/`. Nothing in here may mock a binary, a codec, or a
filter. If a test in this file passes, that behaviour is real.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from packages.ai import captions as C
from packages.ai.reframe import (
    Strategy,
    decide,
    letterbox_filter,
    probe_filter,
    static_crop_filter,
)
from packages.ai.signals import find_candidates, loudness_series
from packages.ai.transcribe import (
    TranscriptionUnavailable,
    available_engines,
    transcribe,
)
from packages.media.probe import MediaError, probe, sample_frames, validate_output
from packages.pipeline.render import before_after, contact_sheet, render_clip
from tests import fixtures

pytestmark = pytest.mark.integration

HAVE_FFMPEG = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None
requires_ffmpeg = pytest.mark.skipif(not HAVE_FFMPEG, reason="ffmpeg not installed")


@pytest.fixture(scope="module")
def media(tmp_path_factory) -> Path:
    return tmp_path_factory.mktemp("media")


@pytest.fixture(scope="module")
def talking(media: Path) -> Path:
    return fixtures.talking_head(media / "talking.mp4", seconds=70)


@pytest.fixture(scope="module")
def screen_rec(media: Path) -> Path:
    return fixtures.screen_recording(media / "screen.mp4", seconds=40)


# --- input validation ------------------------------------------------------

@requires_ffmpeg
def test_probe_reads_real_file(talking: Path):
    info = probe(talking)
    assert info.width == 1280 and info.height == 720
    assert info.duration_seconds > 60
    assert info.has_audio
    assert info.fps > 0


@requires_ffmpeg
def test_missing_file_is_rejected_with_a_useful_message(media: Path):
    with pytest.raises(MediaError, match="No such file"):
        probe(media / "nope.mp4")


@requires_ffmpeg
def test_a_text_file_named_mp4_is_rejected(media: Path):
    fake = media / "fake.mp4"
    fake.write_text("this is not a video")
    with pytest.raises(MediaError):
        probe(fake)


@requires_ffmpeg
def test_audio_only_file_is_rejected_as_having_no_video(media: Path):
    wav = fixtures.speech_wav(media / "audio_only.wav")
    with pytest.raises(MediaError, match="no video stream"):
        probe(wav)


@requires_ffmpeg
def test_paths_with_spaces_and_special_characters(media: Path, talking: Path):
    odd = media / "my clip's file, v2 [final].mp4"
    shutil.copy(talking, odd)
    info = probe(odd)
    assert info.duration_seconds > 0


# --- the validator actually catches unwatchable output ---------------------

@requires_ffmpeg
def test_black_video_fails_validation(media: Path):
    black = fixtures.black_video(media / "black.mp4")
    result = validate_output(black, expect_width=1280, expect_height=720,
                             min_seconds=5, expect_audio=False)
    assert not result.passed
    assert any("black" in f.lower() for f in result.failures)


@requires_ffmpeg
def test_flat_fill_fails_validation_even_though_it_is_bright(media: Path):
    """The colour-bar failure: valid file, correct size, nothing to see."""
    flat = media / "flat.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "lavfi",
         "-i", "color=c=0x909090:s=1080x1920:r=24:d=12",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", str(flat)],
        check=True, capture_output=True, timeout=300,
    )
    result = validate_output(flat, min_seconds=5, expect_audio=False)
    assert not result.passed
    assert any("flat" in f.lower() for f in result.failures)


@requires_ffmpeg
def test_dark_but_visible_content_is_not_called_black(media: Path):
    """Night gameplay must not be rejected for being dark.

    A letterboxed dark clip measured mean luma 15 with stddev 10.8 -- clearly
    visible content that a brightness-only rule threw out. Judging emptiness by
    brightness would reject horror games, night scenes and most of the content
    this product exists for.
    """
    dark = media / "dark_but_visible.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "lavfi",
         "-i", "color=c=0x080808:s=1080x1920:r=24:d=14",
         "-vf", ("drawbox=x=200:y=700:w=680:h=400:color=0x9a9a9a:t=fill,"
                 "drawtext=text='VISIBLE':x=300:y=1200:fontsize=90:fontcolor=white"),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", str(dark)],
        check=True, capture_output=True, timeout=300,
    )
    # min_bytes is lowered only here. This fixture is a still image, so H.264
    # compresses 14 seconds of it to ~35 KB -- real footage never does that,
    # and the default floor stays where it is. The claim under test is about
    # luma classification, so the size rule is scoped out rather than relaxed.
    result = validate_output(dark, min_seconds=10, expect_audio=False,
                             min_bytes=20_000)
    samples = result.frame_samples
    assert all(s["mean_luma"] < 60 for s in samples), "fixture should be dark"
    assert not any(s["black"] or s["flat"] for s in samples), (
        "dark content with real detail must not be classified as empty"
    )
    assert result.passed, result.failures


@requires_ffmpeg
def test_real_content_passes_validation(media: Path, talking: Path):
    out = media / "valid.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(talking), "-t", "12",
         "-vf", "scale=1080:1920", "-c:v", "libx264", "-c:a", "aac",
         "-pix_fmt", "yuv420p", str(out)],
        check=True, capture_output=True, timeout=600,
    )
    result = validate_output(out, min_seconds=10)
    assert result.passed, result.failures


@requires_ffmpeg
def test_frame_sampling_reports_real_variation(talking: Path):
    samples = sample_frames(talking)
    assert len(samples) == 3
    assert any(s.stddev_luma > 3 for s in samples), (
        "a moving subject must produce spatial variation; all-zero stddev "
        "means the measurement is broken, not the video"
    )


# --- signals come from the media -------------------------------------------

@requires_ffmpeg
def test_loudness_series_has_the_sample_rate_it_claims(talking: Path):
    """Guards the bug that made every window read the wrong audio.

    astats' `reset` counts audio frames. At two samples a second a 70-second
    file must give ~140 values -- not 70, and not 3,000.
    """
    series = loudness_series(talking, per_second=2.0)
    duration = probe(talking).duration_seconds
    assert abs(len(series) / duration - 2.0) < 0.25, (
        f"{len(series)} samples over {duration}s is not 2/second"
    )


@requires_ffmpeg
def test_detection_finds_moments_without_chat_or_labels(talking: Path):
    info = probe(talking)
    candidates, context = find_candidates(talking.as_posix(), info.duration_seconds)
    assert candidates, "no moments found in a file with clear loud sections"
    assert context["windows_examined"] > 0
    for cand in candidates:
        assert cand.reasons, "every candidate must say why it was chosen"
        assert cand.end > cand.start


@requires_ffmpeg
def test_candidates_do_not_all_overlap(talking: Path):
    info = probe(talking)
    candidates, _ = find_candidates(talking.as_posix(), info.duration_seconds)
    for i, a in enumerate(candidates):
        for b in candidates[i + 1:]:
            overlap = min(a.end, b.end) - max(a.start, b.start)
            assert overlap <= 0 or overlap / min(a.duration, b.duration) <= 0.4


# --- transcription is real or it fails -------------------------------------

@requires_ffmpeg
def test_transcription_produces_real_words_with_timings(talking: Path, media: Path):
    result = transcribe(talking, work_dir=media)
    assert result.word_count > 0
    # Checked against the engine registry rather than a hardcoded set. The
    # hardcoded version went stale the moment a third engine was added and
    # failed a run that was working correctly -- the test was asserting which
    # engines existed when it was written, not that transcription worked.
    assert result.engine in available_engines()
    assert not result.is_empty
    words = [w for s in result.segments for w in s.words]
    assert words, "an engine with no word timings cannot drive captions"
    assert all(w.end >= w.start for w in words)
    assert all(w.text.strip() for w in words)


@requires_ffmpeg
def test_a_named_engine_that_cannot_run_raises_rather_than_downgrading(media: Path):
    """Silently substituting a worse engine is the failure mode this prevents."""
    wav = fixtures.speech_wav(media / "named.wav")
    with pytest.raises(TranscriptionUnavailable):
        transcribe(wav, engine="definitely-not-an-engine", work_dir=media)


# --- captions --------------------------------------------------------------

@requires_ffmpeg
def test_captions_burn_in_and_are_visible(talking: Path, media: Path, tmp_path: Path):
    transcript = transcribe(talking, work_dir=media)
    result = C.prepare(transcript, 5.0, 20.0, tmp_path / "c.ass")
    assert result.rendered_anything

    out = tmp_path / "capped.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-ss", "5", "-t", "15", "-i", str(talking),
         "-vf", f"scale=1080:1920,{C.ass_filter(result.ass_path)}",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", str(out)],
        check=True, capture_output=True, timeout=600,
    )
    assert validate_output(out, min_seconds=10, expect_audio=False).passed


@requires_ffmpeg
def test_caption_lines_fit_the_frame(talking: Path, media: Path, tmp_path: Path):
    transcript = transcribe(talking, work_dir=media)
    cues = C.cues_for_clip(transcript, 0.0, 40.0, width=1080)
    assert cues
    assert not C.check_fits(cues, 1080), "wrap width and fit check must agree"


def test_ass_escaping_survives_a_path_that_would_break_the_filter_graph(tmp_path):
    awkward = tmp_path / "a,b:c[d].ass"
    awkward.write_text("[Events]\n")
    fragment = C.ass_filter(awkward)
    assert r"\," in fragment and r"\:" in fragment


# --- reframing decisions ---------------------------------------------------

@requires_ffmpeg
def test_a_single_subject_is_tracked_or_cropped_not_letterboxed(talking: Path):
    decision = decide(talking.as_posix(), 5, 20, 1280, 720)
    assert decision.strategy is not Strategy.LETTERBOX_BLUR
    assert decision.concentration > 0.6


@requires_ffmpeg
def test_spread_out_content_is_letterboxed_not_cropped(screen_rec: Path):
    """The 'do not blindly crop gameplay' requirement, as a measurement."""
    decision = decide(screen_rec.as_posix(), 2, 20, 1280, 720)
    assert decision.strategy is Strategy.LETTERBOX_BLUR
    assert "discard" in decision.reason


@requires_ffmpeg
def test_portrait_input_is_not_cropped_further(media: Path):
    portrait = fixtures.portrait_video(media / "portrait.mp4")
    decision = decide(portrait.as_posix(), 1, 10, 720, 1280)
    assert decision.strategy is Strategy.CENTER_CROP
    assert "already vertical" in decision.reason


@requires_ffmpeg
def test_filter_graphs_are_valid_at_the_sizes_they_are_built_for():
    probe_filter(letterbox_filter(), 1280, 720)
    probe_filter(static_crop_filter(1280, 720, 0.5), 1280, 720)
    probe_filter(static_crop_filter(1920, 1080, 0.3), 1920, 1080)


# --- rendering -------------------------------------------------------------

@requires_ffmpeg
def test_render_produces_a_watchable_vertical_clip(talking: Path, tmp_path: Path):
    decision = decide(talking.as_posix(), 10, 20, 1280, 720)
    out = render_clip(talking.as_posix(), tmp_path / "clip.mp4",
                      start=10, duration=20, decision=decision,
                      source_w=1280, source_h=720)
    result = validate_output(out, min_seconds=15)
    assert result.passed, result.failures
    assert result.width == 1080 and result.height == 1920
    assert result.has_audio


@requires_ffmpeg
def test_letterbox_render_keeps_the_whole_frame(screen_rec: Path, tmp_path: Path):
    decision = decide(screen_rec.as_posix(), 2, 20, 1280, 720)
    out = render_clip(screen_rec.as_posix(), tmp_path / "lb.mp4",
                      start=2, duration=20, decision=decision,
                      source_w=1280, source_h=720)
    assert validate_output(out, min_seconds=15).passed


@requires_ffmpeg
def test_silent_source_renders_without_audio_and_does_not_crash(media: Path, tmp_path: Path):
    silent = fixtures.silent_video(media / "silent.mp4", seconds=30)
    info = probe(silent)
    assert not info.has_audio

    decision = decide(silent.as_posix(), 2, 20, info.width, info.height)
    out = render_clip(silent.as_posix(), tmp_path / "silent_clip.mp4",
                      start=2, duration=20, decision=decision,
                      source_w=info.width, source_h=info.height,
                      has_audio=False)
    result = validate_output(out, min_seconds=15, expect_audio=False)
    assert result.passed, result.failures


@requires_ffmpeg
def test_contact_sheet_and_before_after_are_real_files(talking: Path, tmp_path: Path):
    decision = decide(talking.as_posix(), 10, 16, 1280, 720)
    clip = render_clip(talking.as_posix(), tmp_path / "c1.mp4", start=10,
                       duration=16, decision=decision, source_w=1280, source_h=720)

    sheet = contact_sheet([clip], tmp_path / "sheet.jpg")
    assert sheet.exists() and sheet.stat().st_size > 5_000

    comparison = before_after(talking.as_posix(), clip, tmp_path / "ba.mp4",
                             start=10, duration=16)
    assert probe(comparison).width == 1080
