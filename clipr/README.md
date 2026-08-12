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
│   ├── db/migrations/            schema; RLS is a separate, verified migration
│   ├── auth/                     passwords, tokens, workspace context
│   ├── ai/                       detector, eval harness, reframing, safety
│   ├── billing/                  plans, entitlements, overage, margin model
│   ├── publishing/               platform adapters + the degrade path
│   ├── observability/            unit economics + budget guard
│   └── audit/                    readiness scoring from evidence
├── tests/                        139 tests, ~0.7s
└── infra/                        CI gates, backup + restore verification
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

```
139 passed in 0.74s
```

## What is deliberately not built

**No web or mobile app.** Everything here is server-side. The client is a
separate concern and the decision on it is in `STRATEGY.md`: web first, then a
Capacitor shell for the swipe review queue and push notifications.

**No worker loop or FastAPI app.** The schema supports both (job leases, a
dead-letter queue, an idempotent publish key) but neither is written.

**No k6 load test, no Terraform.** The previous README claimed 1,000 concurrent
users at p95 < 2s and a verified restore test. Neither claim had anything behind
it, so neither is repeated here.

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
existence. On a fresh install it reports **3.15 / 10** with 0 of 12 sectors verified,
which is the correct answer for a product with no users.

## Two things worth knowing before changing anything

**Self-hosted ASR is the business model, not an optimisation.** On hosted speech
APIs the same plan table runs 67–77% gross margin and Control Room breaks the
floor; self-hosted it runs 77–85%. `make margins` shows both.

**The cheap-first cascade is where the economics live.** Audio level, chat
velocity and viewer clip presses run over 100% of a stream; transcription and
LLM ranking run over ~12% of it. Raising `CANDIDATE_FRACTION` raises COGS per
monitored hour directly, which is why it is a named constant with a test on it.
