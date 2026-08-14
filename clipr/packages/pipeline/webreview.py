"""The review surface. Stream ends, four clips are waiting, swipe.

    make review-web            # then open http://127.0.0.1:8765

This is the product's core interaction, not a debugging tool. Everything
upstream -- detection, ranking, reframing, captions -- exists to fill this
screen with clips worth keeping, and every number that matters comes out of
it: Publishable Rate, and the reasons a clip was rejected.

Deliberately built on the standard library. A review queue that needs a
framework, a build step and a node_modules before a creator can look at four
clips is a review queue that does not get used on a Sunday night.

Design rules, learned from what the terminal version could not do:

* the clip plays. A score breakdown with no video is an engineering report.
* one clip at a time. A grid invites skimming; the question is per clip.
* rejecting asks why. The rate says something is wrong, the reason says what,
  and "bad crop" and "missing context" send you to different code.
* keyboard first. K, M and J. A creator reviewing forty clips should never
  touch the mouse.
* **blind by default.** The score and the reasoning stay hidden until after
  the verdict. Showing a creator "87/100" before they judge anchors them, and
  a baseline dataset collected that way measures agreement with ClipR rather
  than whether the clip is good. Pass --show-scores to review with them
  visible; the mode is recorded on every verdict so a contaminated batch can
  be told apart later.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import webbrowser
from datetime import UTC, datetime
from functools import partial
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from packages.ai.clip_eval import band
from packages.ai.ranking import RANKING_VERSION

REJECT_REASONS = [
    "bad moment", "missing context", "bad boundary", "bad crop",
    "caption error", "duplicate", "too long", "too short", "not my style",
]

PAGE = """<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ClipR review</title>
<style>
  :root {
    --bg:#0b0e12; --panel:#141920; --line:#232b36; --text:#e8edf4;
    --muted:#8b96a5; --keep:#3FC9DE; --reject:#FF4B32; --track:#1d242e;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text);
         font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { padding:14px 20px; border-bottom:1px solid var(--line);
           display:flex; justify-content:space-between; align-items:center; gap:16px;
           flex-wrap:wrap; }
  .brand { font-weight:700; letter-spacing:.02em; }
  .rate { font-variant-numeric:tabular-nums; color:var(--muted); font-size:13px; }
  .rate b { color:var(--text); font-size:16px; }
  main { max-width:1180px; margin:0 auto; padding:22px 20px 60px;
         display:grid; grid-template-columns:minmax(280px,420px) 1fr; gap:28px; }
  @media (max-width:900px){ main{ grid-template-columns:1fr; } }
  /* Reserve the real shape up front. Without an explicit ratio the element
     collapses to a squat box until metadata loads, which on a product whose
     entire output is 9:16 is the first thing a reviewer sees. */
  video { width:100%; aspect-ratio:9/16; max-height:74vh; object-fit:contain;
          border-radius:12px; background:#000; display:block;
          border:1px solid var(--line); margin:0 auto; }
  h2 { margin:0 0 4px; font-size:22px; }
  .sub { color:var(--muted); font-size:13px; margin-bottom:18px; }
  .score { font-size:44px; font-weight:700; line-height:1; }
  .score span { font-size:15px; color:var(--muted); font-weight:400; }
  .dims { margin:18px 0 22px; }
  .dim { display:grid; grid-template-columns:110px 1fr 38px; gap:10px;
         align-items:center; margin-bottom:7px; font-size:13px; }
  .bar { height:7px; background:var(--track); border-radius:4px; overflow:hidden; }
  .bar i { display:block; height:100%; background:var(--keep); }
  .num { text-align:right; color:var(--muted); font-variant-numeric:tabular-nums; }
  .why { border-top:1px solid var(--line); padding-top:14px; margin-top:6px; }
  .why div { margin-bottom:6px; font-size:13px; color:var(--muted); }
  .why b { color:var(--text); font-weight:600; }
  .actions { display:flex; gap:10px; margin:24px 0 8px; flex-wrap:wrap; }
  button { font:inherit; border:1px solid var(--line); background:var(--panel);
           color:var(--text); padding:11px 20px; border-radius:9px; cursor:pointer; }
  button:hover { border-color:var(--muted); }
  .keep { background:var(--keep); color:#06222a; border-color:var(--keep);
          font-weight:700; }
  .reject { background:var(--reject); color:#fff; border-color:var(--reject);
            font-weight:700; }
  .maybe { background:#3a4250; color:var(--text); border-color:#4a5464;
           font-weight:600; }
  .blind { border:1px dashed var(--line); border-radius:10px; padding:16px;
           color:var(--muted); font-size:13px; margin:18px 0 22px; }
  .reasons { display:none; gap:8px; flex-wrap:wrap; margin-top:14px; }
  .reasons.open { display:flex; }
  .chip { padding:7px 13px; border-radius:20px; border:1px solid var(--line);
          background:var(--panel); cursor:pointer; font-size:13px; }
  .chip.on { background:var(--reject); border-color:var(--reject); color:#fff; }
  .hint { color:var(--muted); font-size:12px; margin-top:16px; }
  .done { text-align:center; padding:70px 20px; }
  .done h2 { font-size:26px; }
  .reasonlist { margin-top:20px; text-align:left; display:inline-block; }
  .hook { font-style:italic; color:var(--muted); margin-top:10px; font-size:13px; }
</style>
<header>
  <div class="brand">ClipR</div>
  <div class="rate" id="rate"></div>
</header>
<main id="app"></main>
<script>
const REASONS = __REASONS__;
const BLIND = __BLIND__;
let clips = [], i = 0, picked = new Set(), reviewed = [];

async function boot() {
  const r = await fetch('/api/clips');
  const data = await r.json();
  clips = data.clips; reviewed = data.reviewed || [];
  i = clips.findIndex(c => !reviewed.some(v => v.clip === c.file));
  if (i < 0) i = clips.length;
  render();
}

function rate() {
  const el0 = document.getElementById('rate');
  if (BLIND) { el0.textContent = `${clips.length} clips to review`; return; }
  const done = reviewed.filter(v => v.verdict !== 'skip' && v.verdict !== 'unreviewed');
  const kept = done.filter(v => v.verdict === 'post').length;
  const el = document.getElementById('rate');
  if (!done.length) { el.textContent = `${clips.length} clips to review`; return; }
  const pct = Math.round(100 * kept / done.length);
  el.innerHTML = `Publishable Rate <b>${pct}%</b> &nbsp;${kept}/${done.length}`;
}

function render() {
  rate();
  const app = document.getElementById('app');
  if (i >= clips.length) {
    const done = reviewed.filter(v => v.verdict !== 'skip' && v.verdict !== 'unreviewed');
    const kept = done.filter(v => v.verdict === 'post').length;
    const maybe = done.filter(v => v.verdict === 'maybe').length;
    const pct = done.length ? Math.round(100 * kept / done.length) : 0;
    const counts = {};
    reviewed.forEach(v => (v.reasons || []).forEach(x => counts[x] = (counts[x]||0)+1));
    const list = Object.entries(counts).sort((a,b) => b[1]-a[1])
      .map(([k,v]) => `<div>${v}&times; ${k}</div>`).join('') || '<div>No rejections.</div>';
    app.style.gridTemplateColumns = '1fr';
    app.innerHTML = `<div class="done"><h2>Done — ${kept} of ${done.length} worth posting${maybe ? ` (${maybe} maybe)` : ''}</h2>
      <div class="score">${pct}%<span> publishable rate</span></div>
      <div class="reasonlist"><div class="sub">Why clips were rejected</div>${list}</div>
      <div class="hint">Saved to reviews.json. One session is an anecdote —
      the rate means something after a few hundred clips.</div></div>`;
    return;
  }

  const c = clips[i];
  picked = new Set();
  const dims = Object.entries(c.dimensions || {}).sort((a,b) => b[1]-a[1]);
  app.style.gridTemplateColumns = '';
  app.innerHTML = `
    <div><video id="v" src="/media/${encodeURIComponent(c.file)}" controls autoplay
         muted playsinline></video>
      <div class="hint">Clip ${i+1} of ${clips.length} &middot;
        ${c.start}s&ndash;${c.end}s &middot; ${c.strategy || ''}</div></div>
    <div>
      <h2>Would you post this?</h2>
      <div class="sub">${c.file}</div>
      ${BLIND ? `<div class="blind">Blind review — ClipR's score and reasoning are
        hidden until you decide, so your judgement is your own. Watch it and
        answer: would you post this?</div>`
      : `<div class="score">${(c.clip_score ?? 0).toFixed(0)}<span> / 100 &nbsp;ClipR thinks this is worth reviewing</span></div>
      ${c.hook_text ? `<div class="hook">Opens with: &ldquo;${c.hook_text.slice(0,90)}&rdquo;</div>` : ''}
      <div class="dims">${dims.map(([k,v]) => `
        <div class="dim"><span>${k}</span>
          <span class="bar"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></span>
          <span class="num">${v.toFixed(0)}</span></div>`).join('')}</div>
      <div class="why">${Object.entries(c.why || {}).map(([k,v]) =>
        v ? `<div><b>${k}</b> — ${v}</div>` : '').join('')}</div>`}
      <div class="actions">
        <button class="keep" onclick="send('post')">Keep &nbsp;K</button>
        <button class="maybe" onclick="send('maybe')">Maybe &nbsp;M</button>
        <button class="reject" onclick="openReasons()">Reject &nbsp;J</button>
        <button onclick="send('skip')">Skip</button>
      </div>
      <div class="reasons" id="reasons">
        ${REASONS.map(r => `<span class="chip" onclick="toggle(this,'${r}')">${r}</span>`).join('')}
        <button class="reject" onclick="send('reject')">Confirm reject</button>
      </div>
      <div class="hint">K keep &middot; M maybe &middot; J reject &middot; S skip &middot; Space play/pause</div>
    </div>`;
}

function openReasons() { document.getElementById('reasons').classList.add('open'); }
function toggle(el, r) {
  el.classList.toggle('on');
  picked.has(r) ? picked.delete(r) : picked.add(r);
}

async function send(verdict) {
  const c = clips[i];
  const body = { clip: c.file, verdict, reasons: [...picked],
                 clip_score: c.clip_score, blind: BLIND };
  reviewed = reviewed.filter(v => v.clip !== c.file).concat([body]);
  await fetch('/api/verdict', { method:'POST',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  i++; render();
}

document.addEventListener('keydown', e => {
  if (i >= clips.length) return;
  const k = e.key.toLowerCase();
  if (k === 'k') send('post');
  else if (k === 'm') send('maybe');
  else if (k === 'j') openReasons();
  else if (k === 's') send('skip');
  else if (e.code === 'Space') {
    e.preventDefault();
    const v = document.getElementById('v');
    if (v) v.paused ? v.play() : v.pause();
  }
});
boot();
</script>
"""


class Handler(BaseHTTPRequestHandler):
    directory: Path
    blind: bool = True

    def log_message(self, *args) -> None:  # noqa: D102 - quiet by default
        pass

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        # This serves local files to a local browser and nothing else.
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _clips(self) -> dict:
        report_path = self.directory / "demo_report.json"
        if not report_path.exists():
            return {"clips": [], "reviewed": [],
                    "error": f"No demo_report.json in {self.directory}"}
        report = json.loads(report_path.read_text())
        clips = []
        for clip in report.get("clips", []):
            clips.append({
                "file": Path(clip["path"]).name,
                "start": clip.get("start"),
                "end": clip.get("end"),
                "clip_score": clip.get("clip_score"),
                "dimensions": clip.get("dimensions", {}),
                "why": clip.get("why", {}),
                "hook_text": clip.get("hook_text", ""),
                "strategy": clip.get("strategy", ""),
            })
        reviewed = []
        verdicts = self.directory / "verdicts.json"
        if verdicts.exists():
            reviewed = json.loads(verdicts.read_text())
        return {"clips": clips, "reviewed": reviewed}

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        path = urlparse(self.path).path

        if path in ("/", "/index.html"):
            page = (PAGE.replace("__REASONS__", json.dumps(REJECT_REASONS))
                        .replace("__BLIND__", "true" if self.blind else "false"))
            self._send(200, page.encode(), "text/html; charset=utf-8")
            return

        if path == "/api/clips":
            self._send(200, json.dumps(self._clips()).encode(), "application/json")
            return

        if path.startswith("/media/"):
            name = unquote(path[len("/media/"):])
            # Serve only files sitting directly in the review directory. A
            # name like ../../etc/passwd must not escape it.
            target = (self.directory / Path(name).name).resolve()
            if target.parent != self.directory.resolve() or not target.is_file():
                self._send(404, b"not found", "text/plain")
                return
            data = target.read_bytes()
            kind = "video/mp4" if target.suffix == ".mp4" else "application/octet-stream"
            self._send(200, data, kind)
            return

        self._send(404, b"not found", "text/plain")

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if urlparse(self.path).path != "/api/verdict":
            self._send(404, b"not found", "text/plain")
            return

        length = int(self.headers.get("Content-Length") or 0)
        payload = json.loads(self.rfile.read(length) or b"{}")
        payload["at"] = datetime.now(UTC).isoformat()
        payload["ranking_version"] = RANKING_VERSION
        # Recorded per verdict, not per session: a batch reviewed with the
        # scores showing is contaminated for baseline purposes and has to be
        # separable later rather than silently averaged in.
        payload["blind"] = bool(payload.get("blind", self.blind))

        store = self.directory / "verdicts.json"
        existing = json.loads(store.read_text()) if store.exists() else []
        # Re-reviewing a clip replaces the earlier call rather than double
        # counting it, so the rate cannot drift by revisiting a clip.
        existing = [v for v in existing if v.get("clip") != payload.get("clip")]
        existing.append(payload)
        store.write_text(json.dumps(existing, indent=2))

        # Publishable Rate is approvals over everything ClipR *offered*, so a
        # "maybe" sits in the denominator: it was recommended and not approved.
        # Excluding maybes would let a model that produces borderline clips
        # score the same as one that produces confident keeps.
        decided = [v for v in existing
                   if v.get("verdict") in ("post", "maybe", "reject")]
        kept = sum(1 for v in decided if v["verdict"] == "post")
        rate = kept / len(decided) if decided else 0.0
        self._send(200, json.dumps({
            "ok": True, "reviewed": len(decided),
            "publishable_rate": round(rate, 4), "band": band(rate),
        }).encode(), "application/json")


def serve(directory: Path, port: int = 8765, open_browser: bool = True,
          blind: bool = True) -> int:
    directory = directory.resolve()
    if not (directory / "demo_report.json").exists():
        print(f"No demo_report.json in {directory}. Run `make demo INPUT=...` first.",
              file=sys.stderr)
        return 2

    handler = partial(Handler)
    Handler.directory = directory
    Handler.blind = blind
    server = HTTPServer(("127.0.0.1", port), handler)

    url = f"http://127.0.0.1:{port}"
    print(f"ClipR review  →  {url}")
    print(f"  serving {directory}")
    print(f"  mode: {'BLIND — scores hidden until you decide' if blind else 'scores visible'}")
    print("  K keep · M maybe · J reject · S skip · Ctrl-C to stop\n")

    if open_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        server.server_close()

    verdicts = directory / "verdicts.json"
    if verdicts.exists():
        data = json.loads(verdicts.read_text())
        decided = [v for v in data
                   if v.get("verdict") in ("post", "maybe", "reject")]
        if decided:
            kept = sum(1 for v in decided if v["verdict"] == "post")
            rate = kept / len(decided)
            print(f"\nPublishable Rate: {rate:.0%} ({kept}/{len(decided)}) — {band(rate)}")
            print(f"Saved to {verdicts}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m packages.pipeline.webreview")
    parser.add_argument("--dir", type=Path, default=Path("demo_output"))
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--show-scores", action="store_true",
                        help="Show ClipR's score while reviewing. Off by "
                             "default: seeing the score first anchors the "
                             "verdict and contaminates a baseline dataset.")
    args = parser.parse_args(argv)
    return serve(args.dir, args.port, not args.no_browser,
                 blind=not args.show_scores)


if __name__ == "__main__":
    raise SystemExit(main())
