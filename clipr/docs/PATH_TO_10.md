# The path from 4.40 to 10

Nothing in this document can be done by writing code. That is the point: the
engineering side of every sector is finished, and `make audit` says so in a line
it computes rather than asserts.

```
Reachable by writing code: 0 points.
```

What follows is the shortest honest route to the remaining 5.6, in the order
that gets the most weight per unit of effort. Each item lists the command that
records it, so the score moves the moment the work is genuinely done — and only
then.

---

## The order

| # | Sector | Weight | What it takes | Realistic effort |
|---|---|---|---|---|
| 1 | Problem & Market | 0.50 | 10 interviews | a week of DMs |
| 2 | AI Quality | 0.60 | 50+ labeled moments | one afternoon |
| 3 | Product | 0.60 | 5 usability sessions | a week |
| 4 | Offer & Business | 0.20 | 1 paying customer | first close |
| 5 | Analytics + Landing + Retention | 0.90 | traffic, then 7 days | 2–6 weeks |
| 6 | AI Economics | 0.60 | production cost data | first month of load |
| 7 | Security | 0.20 | external penetration test | $8–20k, 2–3 weeks |
| 8 | Legal | 1.00 | five signed reviews | $3–8k, 2–4 weeks |

Two of these — Legal at 1.00 and the analytics cluster at 0.90 — carry more
weight than everything engineering did this whole time. That ratio is correct
for a product with no users, and it is worth sitting with before writing more
code.

---

## 1. Problem & Market — 0.50, cheapest point on the board

Ten conversations. Not a survey: a call where you shut up and listen.

The interview exists to falsify the wedge, not confirm it. The whole thesis is
that per-source-minute pricing punishes streamers, so the question that matters
is the one that could prove it wrong.

**Ask, in this order:**

1. Walk me through the last time you turned a stream into a clip. What did you
   actually do?
2. Who does it now — you, a clipper, nobody?
3. What are you paying for that today, if anything? *(The answer "nothing" is
   data, not a failure.)*
4. Last time you tried a clipping tool, what made you stop using it?
5. How many hours a week are you live?
6. If clips posted themselves overnight and you reviewed them in the morning,
   what would go wrong?

Question 6 is the one that finds the objection you have not thought of. Write
the answer down verbatim, even when it is inconvenient — **especially** then.

```bash
python -m packages.audit.evidence interview \
  --handle @someone --platform twitch --hours-per-week 22 \
  --pays-for-clipping no --date 2026-08-14 --by "your name" \
  --notes "verbatim answer to Q6"
```

Ten of those and the sector verifies. If six of ten say they already pay
someone, the pricing is wrong and you found out for the cost of ten calls
instead of a launch.

---

## 2. AI Quality — 0.60, one afternoon with the labeler

The requirement is 50+ moments labeled from real streams. Unassisted that is a
week of scrubbing timelines; `packages/ai/labeler.py` makes it an afternoon.

```bash
# One VOD descriptor per stream: id, duration, transcript, chat events.
python -m packages.ai.labeler propose --vod stream1.json --out s1.json
python -m packages.ai.labeler review s1.json          # g / b / s per candidate
python -m packages.ai.labeler export s1.json s2.json s3.json \
  --out tests/ai/datasets/real.jsonl
python -m packages.ai.cli_eval --dataset tests/ai/datasets/real.jsonl
```

Three or four hour-long VODs gets you past 50. **Keep blind sampling on.** It
mixes in random spans so moments the detector missed can still be labeled;
without it recall is measured only over what the detector already found, which
is circular, and the export marks the dataset `recall_biased` so the harness
reports recall as unmeasured rather than as a good number nobody should trust.

Label what a stranger would stop scrolling for, not what you remember being fun
to stream. Those are different, and the second one is why creators' own clip
picks underperform.

---

## 3. Product — 0.60, five people and a screen recorder

Five sessions, 80% completing the task. Not five friends: five streamers who
have never seen it.

**The task:** *"Connect your channel and get one clip posted."* Then say nothing.
The silence is the method — every question you answer is a finding you just
destroyed.

Record: where they hesitated, what they clicked that did nothing, what they
called things. If four of five call it "the queue" and the UI says "review
inbox", the UI is wrong.

```bash
python -m packages.audit.evidence usability \
  --participant "P3 — variety streamer, 40 avg viewers" \
  --completed --seconds-to-first-clip 480 \
  --blocking-issues "looked for Twitch login under Settings for 2 min" \
  --observation https://drive.example/rec/p3 \
  --date 2026-08-20 --by "your name"
```

The intake refuses a session with no observation link. A usability finding you
cannot re-watch is a memory, and memories agree with whoever is arguing hardest.

---

## 4–6. The market sectors — 1.70 combined, and they need users

Nothing accelerates these except shipping. What is already built for the day
traffic exists:

- **Analytics** (`packages/analytics/events.py`) — 27 canonical events, closed
  taxonomy, PII refused at the door, warehouse failures swallowed so a metrics
  outage never breaks a publish. Emit them from the app and the sector fills on
  its own.
- **Landing Page** — `ROLLUP_SQL` aggregates `landing_viewed → signup_started →
  signup_completed` into `landing_page_daily`. Run it nightly.
- **Retention** — D7 is computed from those same events. This one needs seven
  days to pass; there is no way to buy it.
- **AI Economics** — `packages/observability/ledger.py` records cost per
  physical unit consumed. Call `reconcile()` against your first real cloud
  invoice. **A drift over 10% means the price book is wrong, and the plan
  allowances derived from it are wrong too** — that is the check that stops the
  margin table from being fiction.

---

## 7. Security — 0.20, and the cheapest way to buy it badly

An external penetration test with no open criticals. Do two things first, or you
will pay a specialist hourly to find what a linter finds free:

1. Give them the threat model rather than a login. The interesting surface is
   workspace isolation, the OAuth token store, and the publish path — not the
   marketing page.
2. Fix the boring findings before the engagement. `make security` and the RLS
   suite already cover a chunk of what a scanner reports.

```bash
python -m packages.audit.evidence pentest \
  --vendor "the firm's name" --scope "API, workspace isolation, OAuth storage" \
  --report https://reports.example/clipr-2026 \
  --criticals-open 0 --highs-open 0 --date 2026-09-30
```

The intake rejects `--vendor internal`. Testing yourself is a code audit, and a
code audit cannot verify this sector.

---

## 8. Legal — 1.00, the largest single block

Five reviews: entity formation, IP assignment, terms and privacy, platform ToS,
incident response. **This is the heaviest sector in the whole audit** and it is
entirely somebody else's signature.

Two of the five are worth doing early for reasons that have nothing to do with
the score:

- **IP assignment.** If anyone has written a line of this who is not on a
  contract that assigns it, that is a problem which gets more expensive every
  month, and it is the first thing diligence finds.
- **Platform ToS.** Unattended multi-account posting is the pattern platforms
  police. A lawyer reading Twitch's and TikTok's terms *before* you build the
  business on them costs less than finding out after.

```bash
python -m packages.audit.evidence legal \
  --type platform_tos --counsel "their name" --firm "their firm" \
  --document https://docs.example/tos-review.pdf --date 2026-09-15
```

Send counsel the draft, not a blank brief — review is cheaper than drafting, and
`docs/legal/` is where those drafts belong. (Drafts for a lawyer to review. They
are not legal advice and are not a substitute for one.)

---

## What the score does as you go

| After | Score |
|---|---|
| now | 4.40 |
| + 10 interviews | 4.90 |
| + 50 labeled moments | 5.50 |
| + 5 usability sessions | 6.10 |
| + first paying customer | 6.30 |
| + traffic and a 7-day cohort | 7.20 |
| + a month of production cost data | 7.80 |
| + penetration test | 8.00 |
| + five legal reviews | 10.00 |

Every row is a real thing that happened. That is the only kind of 10 worth
having — and the reason the engine refuses to hand it over any other way.
