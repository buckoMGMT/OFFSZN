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

## Running it

```bash
cp .env.example .env          # set JWT_SECRET to 32+ chars
make up                       # postgres, redis, minio
make migrate                  # 0001 then 0002 — 0002 is what makes isolation real
make test
```

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
