# ClipR engine.
#
# What this image is for: giving the web app a public HTTPS URL to call.
# Base44 (or any hosted front end) cannot reach localhost, so the engine has to
# live somewhere with an address.
#
# CPU only, and deliberately so. ASR is a per-minute cost line in the margin
# model -- renting someone else's speech endpoint is what turns a 55% gross
# margin into a 20% one. A 4 vCPU box processes a 20-minute VOD in about seven
# minutes with no GPU.
#
#   docker build -t clipr .
#   docker run -p 8000:8000 -e CLIPR_API_KEY=... -v clipr-data:/data clipr

FROM python:3.11-slim-bookworm

# ffmpeg does the media work; fontconfig and DejaVu are what libass needs to
# draw a caption. Without the fonts, captions render as empty boxes and the
# failure looks like a bug in the caption code.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        fonts-dejavu-core \
        fontconfig \
        curl \
        ca-certificates \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so a code change does not re-download PyTorch-sized
# wheels on every build.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Speech recognition weights, baked into the image.
#
# Downloading these at first request instead would make the first customer wait
# several minutes and would fail entirely on a host with no egress. They come
# from a GitHub release rather than Hugging Face because HF is blocked on more
# networks than people expect, and a model that cannot be fetched is a product
# that cannot transcribe.
ENV CLIPR_ASR_MODEL_DIR=/opt/clipr/models
RUN mkdir -p "$CLIPR_ASR_MODEL_DIR" && cd "$CLIPR_ASR_MODEL_DIR" \
    && curl -sSL -o w.tar.bz2 \
        https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.en.tar.bz2 \
    && tar xjf w.tar.bz2 && rm w.tar.bz2 \
    && curl -sSL -O \
        https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx \
    # The float32 encoder/decoder are ~290 MB and unused: inference runs int8,
    # which is several times faster on CPU and makes no difference a caption
    # can show.
    && rm -f sherpa-onnx-whisper-base.en/base.en-encoder.onnx \
             sherpa-onnx-whisper-base.en/base.en-decoder.onnx \
    && rm -rf sherpa-onnx-whisper-base.en/test_wavs

COPY packages/ ./packages/
COPY pyproject.toml Makefile ./

# Jobs and rendered media. Mount a volume here -- a container restart must not
# lose a customer's clips.
ENV CLIPR_DATA_DIR=/data
RUN mkdir -p /data

# Run as a non-root user. The engine executes ffmpeg on customer-supplied
# media, which is exactly the code path where root is worth not being.
RUN useradd --system --uid 10001 clipr && chown -R clipr:clipr /data /app
USER clipr

EXPOSE 8000

# One video at a time. Each job already parallelises across the cores it has;
# running three at once makes all three slow rather than one fast. Scale by
# adding containers, not by raising this.
ENV CLIPR_CONCURRENT_JOBS=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/v1/health || exit 1

# A single worker, because job state is per-process. Multiple uvicorn workers
# would each keep their own thread pool and disagree about what is running --
# the point at which to move the queue into Postgres, which the repo already
# has a proven implementation of.
CMD ["python", "-m", "uvicorn", "packages.api.service:app", \
     "--host", "0.0.0.0", "--port", "8000", "--workers", "1", \
     "--timeout-keep-alive", "75"]
