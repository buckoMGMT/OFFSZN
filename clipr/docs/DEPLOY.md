# Giving the web app an engine to call

Base44 asks for two secrets. One is trivial; the other requires the engine to
be running somewhere on the public internet.

| Secret | What it is |
| --- | --- |
| `CLIPR_API_KEY` | A token you invent. Generate it below. |
| `CLIPR_ENGINE_URL` | The **public HTTPS address** of a running engine. |

`http://localhost:8000` will not work. Base44 runs in the cloud; it cannot
reach a port on your laptop. That is the whole problem this document solves.

## The key

```bash
python -c "import secrets; print('clipr_live_' + secrets.token_urlsafe(32))"
```

Set the same value in two places: the engine's environment, and Base44's
secrets. It is a **server-to-server** key. Base44 must call the engine from a
backend function, never from client-side code — a key shipped to the browser is
a key any visitor can read, and the thing they can do with it is spend your
processing budget.

## Where to run it

The engine needs ffmpeg, about 4 vCPU, and disk. It does not need a GPU.

### A VPS — most control, ~$24–48/month

Hetzner, DigitalOcean, Vultr. Four dedicated vCPU and 8 GB is the sweet spot.

```bash
# on a fresh Ubuntu box, as root
apt-get update && apt-get install -y docker.io docker-compose-v2 git
git clone https://github.com/buckoMGMT/OFFSZN.git
cd OFFSZN/clipr && git checkout claude/remote-tczb7a

cp .env.example .env
# put your generated key in CLIPR_API_KEY, and set
# CLIPR_CORS_ORIGINS to your Base44 app's origin
nano .env

docker compose up -d --build
curl -H "Authorization: Bearer $KEY" http://localhost:8000/api/v1/health
```

Then put it behind HTTPS, because Base44 will refuse to call a plain-HTTP
origin from a secure page:

```bash
apt-get install -y caddy
# /etc/caddy/Caddyfile — Caddy gets a certificate automatically
cat > /etc/caddy/Caddyfile <<'EOF'
engine.yourdomain.com {
    # Uploads are large and processing is slow; the defaults are not built
    # for either.
    request_body {
        max_size 8GB
    }
    reverse_proxy localhost:8000 {
        transport http {
            read_timeout 900s
            write_timeout 900s
        }
    }
}
EOF
systemctl restart caddy
```

`CLIPR_ENGINE_URL` is then `https://engine.yourdomain.com`.

### A PaaS — fastest, less control

Railway, Render, Fly.io. All three build the `Dockerfile` directly and hand
back an HTTPS URL. Two things to get right or it will look broken:

- **Attach a persistent volume at `/data`.** Without it, every deploy and every
  restart deletes customers' clips. Most PaaS filesystems are ephemeral by
  default and this is the failure people hit.
- **Raise the request timeout and body limit.** Uploading a multi-gigabyte VOD
  through a 30-second proxy timeout fails at the proxy, and the error will look
  like an engine bug.

Instances under 2 GB of RAM will be killed while loading the ASR model.

### Today, without deploying anything

To let Base44 talk to an engine on your own machine for an afternoon:

```bash
docker compose up -d
cloudflared tunnel --url http://localhost:8000     # or: ngrok http 8000
```

Either prints a public HTTPS URL — that is your `CLIPR_ENGINE_URL`. It dies
when you close the terminal and your laptop does the processing, which is fine
for wiring the app up and useless for customers.

## Checking it before pointing the app at it

```bash
ENGINE=https://engine.yourdomain.com
KEY=clipr_live_...

# 1. is it alive, and can it actually transcribe?
curl -sS -H "Authorization: Bearer $KEY" $ENGINE/api/v1/health

# expect ffmpeg true and an asr engine with a model, e.g.
#   "sherpa-onnx-whisper": "installed, model sherpa-onnx-whisper-base.en"
# if that says "no model on disk", captions will be wrong or missing.

# 2. does the key actually protect it?
curl -sS -o /dev/null -w "%{http_code}\n" $ENGINE/api/v1/health    # expect 401

# 3. end to end with a real file
JOB=$(curl -sS -X POST "$ENGINE/api/v1/jobs?clips=3" \
  -H "Authorization: Bearer $KEY" -F "file=@vod.mp4" | jq -r .id)

curl -sS -H "Authorization: Bearer $KEY" $ENGINE/api/v1/jobs/$JOB
# poll until state is ready | abstained | failed
```

If step 2 returns 200, the key is not set on the engine and anyone who finds
the URL can use it.

## Operational notes

**Disk fills quietly.** Budget roughly three times the source size per job for
intermediates. Nothing deletes old jobs on a timer yet, so either add a cron
that calls `DELETE /api/v1/jobs/{id}` for reviewed jobs, or watch the disk.

**One video at a time per container.** Each job already parallelises across the
cores it has; `CLIPR_CONCURRENT_JOBS=3` makes three jobs slow rather than
adding throughput. Scale by running more containers.

**Job state is a JSON file per job.** It survives a restart and is fine for a
beta on one machine. The moment there is a second worker, move the queue into
Postgres — the schema and a queue implementation proven at 8 concurrent workers
are already in `packages/db/` and `packages/pipeline/worker.py`.

**Model weights are baked into the image** (~154 MB, int8). Downloading them at
first request instead would make the first customer wait several minutes and
fail outright on a host without egress.

**The container runs as a non-root user.** It executes ffmpeg on media supplied
by strangers, which is precisely the code path where root is worth not being.
