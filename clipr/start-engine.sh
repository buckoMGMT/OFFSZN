#!/usr/bin/env bash
#
# Start the ClipR engine and print the URL to paste into the web app.
#
#   ./start-engine.sh              start locally on :8000
#   ./start-engine.sh --public     also open a public HTTPS tunnel
#
# Everything this does by hand is in docs/DEPLOY.md. This exists so that
# getting an engine running is one command rather than six, because six
# commands is five opportunities to paste the wrong thing.

set -euo pipefail

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
CYAN=$'\033[36m'; OFF=$'\033[0m'

say()  { printf '%s\n' "$*"; }
step() { printf '\n%s==>%s %s%s%s\n' "$CYAN" "$OFF" "$BOLD" "$*" "$OFF"; }
ok()   { printf '%s  ok%s  %s\n' "$GREEN" "$OFF" "$*"; }
die()  { printf '\n%sPROBLEM%s  %s\n\n' "$RED" "$OFF" "$*" >&2; exit 1; }

cd "$(dirname "$0")"
PUBLIC=0
[[ "${1:-}" == "--public" ]] && PUBLIC=1

# --- 1. docker -------------------------------------------------------------
step "Checking Docker"
command -v docker >/dev/null 2>&1 || die \
"Docker is not installed.

  macOS    download Docker Desktop from docker.com and open it
  Ubuntu   sudo apt-get install -y docker.io docker-compose-v2

Then run this script again."

docker info >/dev/null 2>&1 || die \
"Docker is installed but not running.

  macOS    open the Docker Desktop app and wait for it to say 'running'
  Linux    sudo systemctl start docker

Then run this script again."
ok "Docker is running"

# --- 2. the key ------------------------------------------------------------
step "Checking your API key"
if [[ ! -f .env ]]; then
    cp .env.example .env
    say "  created .env"
fi

# Read it without sourcing the file: a stray character in .env should not
# execute as shell.
CURRENT_KEY="$(grep -E '^CLIPR_API_KEY=' .env | head -1 | cut -d= -f2- || true)"

if [[ -z "$CURRENT_KEY" ]]; then
    NEW_KEY="clipr_live_$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))' 2>/dev/null \
              || head -c 24 /dev/urandom | base64 | tr -d '/+=')"
    # BSD sed and GNU sed disagree about -i, so write a new file instead.
    grep -v '^CLIPR_API_KEY=' .env > .env.tmp || true
    printf 'CLIPR_API_KEY=%s\n' "$NEW_KEY" >> .env.tmp
    mv .env.tmp .env
    CURRENT_KEY="$NEW_KEY"
    ok "generated a new key"
else
    ok "using the key already in .env"
fi

# --- 3. build and start ----------------------------------------------------
step "Starting the engine (first run takes a few minutes)"
docker compose up -d --build

# --- 4. wait for it to be healthy ------------------------------------------
step "Waiting for the engine to answer"
HEALTHY=0
for _ in $(seq 1 60); do
    if curl -fsS -H "Authorization: Bearer $CURRENT_KEY" \
            http://127.0.0.1:8000/api/v1/health >/tmp/clipr-health.json 2>/dev/null; then
        HEALTHY=1; break
    fi
    sleep 3
done

if [[ "$HEALTHY" -ne 1 ]]; then
    say ""
    docker compose logs --tail 40 engine || true
    die "The engine did not come up. The last 40 log lines are above."
fi
ok "engine is answering"

# The health check reports whether speech recognition can actually run. A
# missing model is not a crash -- it is silently bad captions, which is worse.
if grep -q '"no model on disk"' /tmp/clipr-health.json; then
    say ""
    say "  ${RED}WARNING${OFF}  No speech model found. Clips will have no captions."
    say "  ${DIM}Rebuild with: docker compose build --no-cache${OFF}"
fi

# --- 5. the URL ------------------------------------------------------------
step "Your settings for the web app"
say ""
say "  ${BOLD}CLIPR_API_KEY${OFF}"
say "  $CURRENT_KEY"
say ""

if [[ "$PUBLIC" -eq 1 ]]; then
    if command -v cloudflared >/dev/null 2>&1; then
        say "  ${BOLD}CLIPR_ENGINE_URL${OFF}"
        say "  ${DIM}starting a public tunnel -- the https:// address below is the one${OFF}"
        say ""
        exec cloudflared tunnel --url http://localhost:8000
    elif command -v ngrok >/dev/null 2>&1; then
        say "  ${BOLD}CLIPR_ENGINE_URL${OFF}"
        say "  ${DIM}starting a public tunnel -- the https:// address below is the one${OFF}"
        say ""
        exec ngrok http 8000
    else
        die \
"--public needs a tunnel tool, and neither is installed.

  macOS    brew install cloudflared
  Linux    see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

Or run without --public and the engine stays on this machine only."
    fi
fi

say "  ${BOLD}CLIPR_ENGINE_URL${OFF}"
say "  http://localhost:8000"
say ""
say "  ${DIM}That address only works on THIS computer. A hosted web app cannot"
say "  reach it. To give the app a public address, stop this and run:${OFF}"
say "  ${BOLD}./start-engine.sh --public${OFF}"
say ""
say "  ${DIM}Stop the engine with:  docker compose down${OFF}"
say ""
