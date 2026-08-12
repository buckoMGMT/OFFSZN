# ClipR

An autonomous clip desk for live channels. It attaches to a stream when it goes
live, ranks moments in real time, cuts and captions the winners, and publishes
them to every account the creator owns.

This repository is the **production core**: the parts where being wrong costs
money, leaks data, or publishes something it shouldn't. The web app, worker loop
and infrastructure are not here, and nothing below claims otherwise.

```
clipr/
├── index.html                    marketing + pricing page (published artifact)
├── STRATEGY.md                   market teardown, pricing rationale, app decision
├── REVIEW.md                     defect report on the previous build, with fixes
├── packages/
│   ├── db/migrations/            schema, RLS, and the evidence tables
│   ├── auth/                     passwords, tokens, workspace context
│   ├── ai/                       detector, eval harness, reframing, safety, labeler
│   ├── analytics/                event taxonomy and emitter
│   ├── billing/                  plans, entitlements, overage, margin model
│   ├── publishing/               platform adapters + the degrade path
│   ├── pipeline/                 job queue: leases, retries, dead-letter
│   ├── observability/            cost ledger, unit economics, budget guard
│   └── audit/                    readiness scoring + evidence intake
├── tests/                        265 tests, ~7s
├── infra/                        CI gates, backup + restore verification
└── docs/PATH_TO_10.md            what the remaining 5.6 points take, and who does it
```

## Start here: put a video in and get clips out

```bash
make demo INPUT=/path/to/your/video.mp4
make verify-demo
```

Any local `mp4`, `mov`, `mkv` or `webm`. **No Twitch, TikTok, Instagram or
YouTube credentials. No Postgres, Redis or Stripe.** If any of those were
required to find out whether the clips are good, they would be in the way.

You get, in `demo_output/`:

| file | what it is |
| --- | --- |
| `clip_01.mp4` … | clean 1080x1920 clips. What you would post. No overlays. |
| `clip_01_debug.mp4` … | source beside result, with the score, the signals and the crop's swept range drawn on |
| `before_after.mp4` | original and ClipR output, synchronised |
| `contact_sheet.jpg` | frames from every clip, to spot a framing failure without watching |
| `transcript.txt` / `.json` | real speech recognition output, with word timings |
| `candidates.json` | every moment considered, its score, and why |
| `demo_report.md` | the run, in prose |

### What the demo will not do

* **It will not invent a transcript.** If no speech recognition engine can run,
  it fails and says so. Placeholder text would flow into the captions and be
  found by a customer rather than by us.
* **It will not call a clip good.** The report ends with two separate verdicts:

  > **TECHNICALLY VALID** — every clip decodes, is 1080x1920, has non-blank
  > frames, and carries audio when the source did.
  >
  > **HUMAN QUALITY VERIFIED** — false. No code path may set it.

  Automated checks establish that a clip is *watchable*. Nothing automated
  establishes that a moment is worth posting, and this pipeline is not allowed
  to claim it. That distinction exists because an earlier version reported a
  completed demo for a clip nobody could see anything in — ffmpeg exited 0, the
  container was valid, the dimensions were right, and the artifact was useless.

### Transcription

`faster-whisper` is the real engine and the one to install:

```bash
pip install faster-whisper       # downloads model weights once
```

Without network access it falls back to `pocketsphinx`, whose acoustic model
ships inside the wheel. That is genuine offline recognition, not a stub — and
it is a 2010-era model, so the words are substantially wrong. Every result
carries a `quality`, and anything below `good` makes the report state plainly
that the captions cannot be judged.

## Running the rest of it

```bash
cp .env.example .env          # set JWT_SECRET to 32+ chars
make up                       # postgres, redis, minio
make migrate                  # 0001 then 0002 — 0002 is what makes isolation real
make test-all
```

### Tests are in two halves, on purpose

```bash
make test-unit          # fast. mocks allowed. never sufficient on its own.
make test-integration   # real ffmpeg, real files, no mocks. slow.
```

Three hundred unit tests passed while the pipeline produced an unwatchable
clip, because they asserted against *assumptions about ffmpeg* rather than
against ffmpeg. Two of those assumptions were wrong and no amount of mocking
could have revealed either: `astats reset=N` counts audio frames rather than
seconds, and `drawbox` fixes its coordinates at filter init. Nothing in
`tests/integration` may mock a binary, a codec or a filter.

`make migrate` must run both files. `0001` creates the schema; `0002` creates
the non-owner application role and forces row-level security. Running the
application on `DATABASE_URL` instead of `DATABASE_APP_URL` silently disables
workspace isolation, because a table owner bypasses RLS.

## What is verified, and how

| Claim | Evidence |
|---|---|
| Workspace A cannot read workspace B | 9 tests against a live Postgres, as the non-owner role |
| A caller cannot write into another workspace | `WITH CHECK` policies, tested |
| No request context means no rows | tested — fails closed, not open |
| Overage never exceeds the next plan's price | tested |
| Rejected clips are free, but not exploitable | tested (egress rule + cap) |
| Every tier clears a 70% gross margin at full use | tested against the cost model |
| Plan numbers agree across SQL, Python and the pricing page | tested — this one has already caught a real drift |
| Publishing degrades instead of failing when a platform revokes access | tested |
| No adapter reports a post that does not exist | tested |
| The eval gate blocks a real regression and abstains on noise | tested |
| Injected instructions in a transcript are not obeyed | tested |
| Two workers never claim the same job | tested against a live Postgres |
| A dead worker's job is reclaimed, and reclaiming counts as an attempt | tested |
| A duplicate go-live webhook cannot double-process a stream | tested |
| `alg=none` and refresh-as-access token forgeries are rejected | tested |
| A demoted admin loses access immediately, not at token expiry | tested |
| A fixture dataset cannot verify AI quality or gate a deploy | tested |
| The queue loses, duplicates or strands no work under 8 concurrent workers | measured: 1,366 operations, 0 errors |
| Every audit sector has a reachable path to verified | tested |
| Analytics refuses unknown event names, and PII at the warehouse door | tested |
| Cost ledger and margin model agree on prices | tested |
| Every new SQL statement parses and runs | executed against a live Postgres |
| A dataset labeled without blind sampling is marked recall-biased | tested |
| Evidence intake rejects placeholder names, missing artifacts, future dates | tested |

```
265 passed in 6.97s
ruff:   All checks passed
bandit: 0 issues at medium or high
```

## What is deliberately not built

**No web or mobile app.** Everything here is server-side. The client is a
separate concern and the decision on it is in `STRATEGY.md`: web first, then a
Capacitor shell for the swipe review queue and push notifications.

**No FastAPI app.** The auth layer, request context and job queue underneath one
are built and tested; the HTTP routes and the Next.js client are not.

**No real eval dataset.** `make eval` runs end to end against a synthetic
fixture, which proves the harness executes and nothing more. The harness knows
it is synthetic and refuses to let it gate a deploy or verify the audit
sector — labelling real streams is the remaining work, and it is labelling work,
not engineering work.

**No k6 load test, no Terraform.** The previous README claimed 1,000 concurrent
users at p95 < 2s and a verified restore test. Neither claim had anything behind
it, so neither is repeated here.

## Why the audit will not read 10/10

Because it cannot from here, and a version that could would be worthless.

Every sector *can* reach 10 — `test_every_sector_can_actually_reach_verified`
constructs the database state that verifies all twelve and asserts the score is
exactly 10.0, so the bar is real rather than decorative. What it takes is:

| Sector | Needs | Who |
|---|---|---|
| Problem & Market | 10 recorded interviews | founder |
| Product | 5 usability sessions, 80% task completion | founder |
| AI Quality | F1 ≥ 0.70 over 50+ moments labeled from real streams | labeling |
| Offer & Business | one active paid subscription | market |
| AI Economics | measured cost < $0.10 per monitored hour in production | market |
| Analytics | 1,000+ events across 20+ types | market |
| Landing Page | 1,000+ sessions with a measured signup rate | market |
| Growth | one referral converted to paid | market |
| Retention | a cohort of 20+ at D7 ≥ 40% | time |
| Security | external penetration test, no open criticals | vendor |
| Legal | five signed reviews | counsel |
| Engineering | ✅ verified — 1,366 operations, 0 errors, 0.42% dead-letter | — |

Seeding those tables to move the number would be fabricating interviews that
never happened and subscriptions nobody paid for. The engine is built to make
that indistinguishable from lying rather than indistinguishable from progress:
every evidence table requires an artifact a human had to produce — a named
person, a date, a document URL — and the application role cannot write to any
of them.

## What cannot be known yet

These are not gaps in the code. No amount of building closes them.

| Metric | Blocker |
|---|---|
| Publishable rate | Real streams through a real ranker |
| Activation, D7, D30 | Users, and time |
| Actual cost per monitored hour | Production traffic (`make audit` reads it once it exists) |
| Conversion, LTV, CAC | Revenue |
| Legal and platform ToS posture | External counsel |
| Penetration test | An external tester |

`make audit` computes a readiness score from evidence in the database. A
code-complete sector scores 6 out of 10 and there is no writable score column
anywhere in the schema, so the remaining 4 points cannot be argued into
existence.

A fresh install reports **4.20 / 10**. After `make loadtest`, **4.40** — the
queue run is real evidence about a mechanism, so it verifies Engineering and
nothing downstream of customers. The report ends with the line that matters:

```
Reachable by writing code: 0 points.
The rest needs people, money, time or counsel.
```

That number is computed, not asserted. When it is above zero, there is
engineering left to do; it is currently zero.

`docs/PATH_TO_10.md` is the sequenced route for the remaining 5.6 points —
what each takes, roughly what it costs, and the one command that records it.
Three tools exist to make that route cheap rather than to shortcut it:

```bash
make label      # turn real VODs into a labeled eval dataset (an afternoon, not a week)
make evidence   # record an interview, usability session, pentest or legal review
make audit      # see what it moved
```

## Two things worth knowing before changing anything

**Self-hosted ASR is the business model, not an optimisation.** On hosted speech
APIs the same plan table runs 67–77% gross margin and Control Room breaks the
floor; self-hosted it runs 77–85%. `make margins` shows both.

**The cheap-first cascade is where the economics live.** Audio level, chat
velocity and viewer clip presses run over 100% of a stream; transcription and
LLM ranking run over ~12% of it. Raising `CANDIDATE_FRACTION` raises COGS per
monitored hour directly, which is why it is a named constant with a test on it.
