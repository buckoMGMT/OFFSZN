# Review of the Build 1–30 monorepo starter

Every defect below was found by reading the code you pasted, and every one is
fixed in this repository with a test that fails against the original behaviour.
Verification status is stated per item: **proven** means a test in `tests/` runs
red on the old code and green on the new; **reasoned** means the defect is
demonstrable by inspection but the surrounding system does not exist here to
test it end to end.

The starter's stated principle — *every stub is honest, every metric that needs
real users says `INSUFFICIENT DATA`* — is the right principle, and it is worth
keeping. The problem is that several of the things marked ✅ Complete could not
have run at all, and three of them fail in the direction that looks like
success.

---

## Critical — these fail silently in the direction of "everything is fine"

### C1. Row-level security was entirely inert

`0001_init.sql` enabled RLS on eight tables and wrote policies for two, and the
application connected as `clipr` — the role that owns every table.

**A table owner bypasses RLS unless `FORCE ROW LEVEL SECURITY` is set.** So the
isolation was decorative: `SELECT * FROM vods` as the app returned every
workspace's rows. Meanwhile the six tables with RLS enabled and no policy would
have denied *everything* to any non-owner, because RLS with no policy is
deny-all. One half was a leak, the other was an outage, and the test suite could
not see either because `test_rls_blocks_at_database_level` used a fixture rather
than a real connection as a real role.

*Fixed:* `0002_rls.sql` creates a non-owner `clipr_app` role, FORCEs RLS on all
19 protected tables, writes a policy for every one, and raises at migration time
if any table has RLS on with no policy. Policies carry `WITH CHECK` as well as
`USING`, so a caller cannot plant a row in someone else's workspace — the
direction a `USING`-only policy leaves wide open.

*Proven:* `tests/test_rls.py`, 9 tests against a live Postgres, including
cross-workspace read by primary key, unfiltered scan, insert into another
workspace, and moving a row across workspaces.

### C2. The RLS context was never actually set

```python
await request.state.db.execute("SET LOCAL app.current_workspace_id = $1", workspace_id)
```

`SET` does not take bind parameters in Postgres — this raises a syntax error.
And it sat behind `if hasattr(request.state, "db")`, so on any path without that
attribute it silently did nothing. Combined with C1, no request ever had a
workspace context.

*Fixed:* `select set_config('app.current_workspace_id', $1, true)`, which is a
function and takes parameters. `establish_context()` additionally asserts it is
inside a transaction, because `set_config(..., true)` is transaction-scoped and
outside one it applies to a single statement — a failure that looks like an
empty account, not an error.

*Reasoned* (no FastAPI app here to drive), but the SQL form is proven by
`tests/test_rls.py`, which sets context exactly this way.

### C3. Cost per stream-hour was inflated by a fan-out join

```sql
FROM processing_costs pc
LEFT JOIN vods v ON pc.workspace_id = v.workspace_id
   AND pc.job_id IN (SELECT id FROM processing_jobs WHERE vod_id = v.id)
...
GROUP BY pc.cost_category
```

Every cost row joined every VOD in the workspace, then `SUM(duration/3600)` was
summed *again* across categories. The denominator came out multiplied by roughly
(#vods × #categories), so cost-per-hour read low by an order of magnitude — on
the single number the pricing depends on, in the direction that says margins are
healthy.

*Fixed:* `processing_costs.stream_session_id` attributes spend directly.
Numerator and denominator are now two independent single-table aggregates that
cannot fan out (`packages/observability/cost.py`).

### C4. Adapters fabricated successful posts

```python
return PublishResult(success=True, external_post_id="placeholder_post_id", ...)
```

That writes a fake success to the database, reports a green publish rate, and
tells a creator their clip is live when nothing was posted. The README's honesty
principle and this line cannot both be true.

*Fixed:* no adapter returns an ID it did not receive. TikTok finishes
asynchronously, so a successful upload reports `PROCESSING`, not `PUBLISHED`.

*Proven:* `tests/test_publishing.py::test_no_adapter_ever_fabricates_a_post_id`,
`::test_async_platform_reports_processing_not_published`.

---

## High — these crash, or make a metric read better than reality

### H1. The eval harness had never been executed

`false_positive_rate` referenced `true_negatives`, which is never defined
anywhere in the file. Any call raised `NameError` before returning. The README
lists the evaluation framework as ✅ Complete and the CI workflow gates deploys
on it.

FPR is also the wrong metric here — there is no enumerable set of true negatives
in a continuous stream. Precision is the right measure.

*Fixed and proven:* `packages/ai/evaluation.py`, 22 tests.

### H2. Unmeasured quality metrics were stored as 0.0

`caption_wers` and `crop_accuracies` were initialised empty, never appended to,
then averaged — yielding `0.0`, which is written to `ai_evaluations.caption_wer`
and reads on a dashboard as a *perfect* word error rate.

*Fixed:* `None` unless a scorer is supplied; the column is nullable and the
audit engine treats null as "not measured", not as a score.

*Proven:* `test_unmeasured_metrics_are_none_not_zero`.

### H3. Quadratic ffmpeg usage in the detector

`_audio_features_stub` ran `ffmpeg -i FILE -ss START` once per 30-second window,
and `_scene_change_score` did it again. Placing `-ss` *after* `-i` is output
seeking: ffmpeg decodes from byte zero every time. A 6-hour stream meant ~2,800
processes whose individual cost grew with position — quadratic total decode.

*Fixed:* one pass over the file producing an RMS envelope
(`ffmpeg_loudness_envelope`), sliced per window in memory.

### H4. The loudness signal was sign-inverted

`astats` reports RMS in **dBFS** — negative, roughly −60 (quiet) to −5 (loud).
The heuristic did `score += min(20, rms * 100)`, so −45 dB contributed −4500,
clamped to 0. Every window scored identically at the floor, and louder audio
scored *lower*.

*Fixed:* `_db_to_unit()` normalises to 0..1 before use.

*Proven:* `test_loudness_maps_dbfs_onto_a_unit_scale`,
`test_louder_audio_scores_higher_than_quiet`.

### H5. Scene detection parsed a string ffmpeg never emits

`result.stderr.count("Parsed_scene")` — the filter is `metadata`, and the key is
`lavfi.scene_score`. The count was always 0, so the signal contributed nothing
while appearing in the scoring formula.

*Fixed:* removed in favour of signals that are actually free at stream time
(chat velocity, viewer clip presses, audio level jump). Scene change belongs in
the render stage, not the cascade.

### H6. LLM cost was multiplied by the candidate count

```python
for i, c in enumerate(candidates):
    c["cost_usd"] = self._estimate_llm_cost(prompt, response)
```

One call's cost assigned to each of N candidates. With 40 candidates the ledger
overstated inference spend 40×. The cost ledger is the input to pricing.

*Fixed and proven:*
`test_llm_cost_is_charged_once_per_call_not_per_candidate`.

### H7. Smart reframing threw its own output away

`SmartCropper.render()` computed per-second crops, smoothed them, then applied
**one static crop from the middle frame**. `crop_expr` was assigned and never
used. Every clip got a fixed centre-ish crop and the whole detection pipeline
was dead code — invisible from the output, because a centre crop looks
plausible.

*Fixed:* `Reframer.render()` emits an ffmpeg `sendcmd` script that moves the
crop window over time, which is how you drive a filter parameter temporally.

*Proven:* `test_render_without_a_track_refuses_rather_than_centre_cropping`,
`test_sendcmd_is_valid_ffmpeg_syntax`, `test_sendcmd_emits_only_actual_movement`.

### H8. Face detection sampled the same second repeatedly

The loop called `cap.read()` once per intended second, but `read()` returns the
*next frame*. At 30 fps it read the first N frames and labelled them seconds
0..N — so a 60-second clip's crop track came entirely from its first two
seconds. The Haar cascade was also reloaded from disk inside the loop.

*Fixed:* seeks by frame index; cascade loaded once.

### H9. Backups wrote no file

```python
subprocess.run(["pg_dump", DATABASE_URL, "|", "gzip", ">", str(path)],
               shell=True, check=True)
```

With `shell=True` and a list argument on POSIX, only element 0 is the command
and the rest become `$0, $1...`. This ran bare `pg_dump` with no arguments, no
pipe, no redirect. The next line checksummed a file that did not exist.
`size_bytes` was read from a path that had just been `unlink()`ed, so it was
always `None`. `verify_restore` had the identical bug.

*Fixed:* `pg_dump --format=custom` piped through gzip in Python, checksummed
before cleanup; restore verification asserts table count *and* row content,
because a restore that yields an empty schema is a successful-looking disaster.

### H10. The audit engine could not run

`_problem_market` queried a non-existent `interviews` table; asyncpg raises
`UndefinedTableError`, which `or 0` does not catch. `compute_all_sectors`
dispatched to eleven methods of which seven were never written —
`AttributeError` on the first call. `float(latest["f1_score"])` would raise on a
nullable column.

*Fixed:* `interviews` table added; every sector implemented; missing tables
distinguished from zero counts; `run()` raises if any weighted sector is absent
rather than averaging over a subset.

*Proven:* `tests/test_audit.py`, 15 tests.

---

## Medium — schema and correctness

### M1. Migrations aborted on line 1

`CITEXT` was used with no `CREATE EXTENSION citext`, and `VECTOR(1536)` with no
pgvector. Neither is a contrib default. The migration could not complete on a
clean Postgres, which means it had never been run.

*Fixed:* citext created; embeddings moved to an optional migration so a
deployment without pgvector still gets a working schema.

*Proven:* the migrations in this repo were applied to a live Postgres 16 during
this review.

### M2. `updated_at` was decorative

Declared "for audit" on most tables, never written by anything. Every row would
have reported its creation time forever.

*Fixed:* `set_updated_at()` trigger on every table that has the column.

### M3. `docker-entrypoint-initdb.d` only runs once

Mounting migrations there means schema changes silently stop applying the moment
anyone has a data volume, and the next developer debugs a phantom.

*Fixed:* removed from compose; `make migrate` runs them explicitly.

### M4. No worker lease

`processing_jobs.status='running'` with no lease means a worker that dies leaves
the job running forever, and nothing requeues it.

*Fixed:* `lease_expires_at` plus a partial index for the claim query.

### M5. Stripe webhooks had no idempotency

Stripe retries. Without a processed-events table, a retry double-grants
entitlements.

*Fixed:* `stripe_events` table keyed on the Stripe event ID.

### M6. Three different plan vocabularies

The pricing page said Rail / Control Room / Network; `plan_limits` said
starter / creator / pro / agency; `.env.example` said `STRIPE_PRICE_STARTER`,
`_CREATOR`, `_PRO`. Three copies of the same concept that nothing reconciled —
the classic route to "customer paid for one thing and was granted another".

*Fixed:* one vocabulary everywhere, plus a test that parses the SQL, the Python
plan table *and* the HTML pricing page and fails if any of them drift.

*Proven:* `test_sql_and_python_plan_tables_agree`,
`test_pricing_page_quotes_the_same_numbers`. This test caught a real drift
during this work: after the margin fix changed Network's allowances, the page
still advertised the old ones.

### M7. Role was trusted from the JWT

`payload.get("role")` with a 7-day token means a demoted admin keeps admin
rights for up to a week.

*Fixed:* role is read from `memberships` per request. Access token TTL cut from
7 days to 30 minutes.

### M8. Test asserted its own comment was wrong

`test_rate_limit_engages` loops 11 times, then asserts the *12th* returns 429,
while the comment says "11th attempt should be 429" — so the boundary is
untested either way.

---

## What the audit list still gets right, and what it now misses

Your audit table is honest about needing users, and I have not touched that
framing. Two items I would add:

**Nothing in the list covers loss of platform API access**, which is the largest
single risk to the business — unattended multi-account posting is exactly the
pattern platforms police. It is not a checklist item because it is not a task;
it is a design constraint. This build answers it with a third publish state:
`manual_handoff` renders, captions, stages and notifies, so revocation degrades
the product rather than ending it. Because dev has no credentials, that path is
the one that runs by default, so it is exercised constantly instead of being
discovered on the worst day.

**Nothing covers the free-rejection hole.** "Rejected clips don't count" is the
best line in the pricing, and as written it was an unlimited free tier: reject
everything after pulling the render over the API. `clips.first_egress_at` plus a
rejection cap closes it without punishing an honest picky creator.

---

## The number that changed

The earlier strategy note estimated 48% and 37% gross margin on the two lower
tiers and flagged it as the top open question. That estimate was wrong, in our
favour, for two reasons: it priced ASR at hosted-API rates (~$0.36/audio-hour)
and carried a storage allowance about five times what clips actually consume.

With self-hosted ASR (~$0.035/audio-hour on an L4 at ~25× realtime) and
realistic storage, at 100% allowance consumption:

| Plan | Price | Modeled COGS | Gross margin |
|---|---|---|---|
| Rail | $29 | $4.45 | 84.7% |
| Control Room | $79 | $17.84 | 77.4% |
| Network | $249 | $57.12 | 77.1% |

The sensitivity is the finding, not the margin: on hosted ASR the same plans run
67–77%, and Control Room drops below the 70% floor. **Self-hosted ASR is not an
optimisation, it is the business model** — `make margins` recomputes both cases.

Network changed from "unmetered monitored hours" to 600/month. Twelve sources
against an unmetered watcher was the one shape in the plan table that could run
a negative margin, and no test could have caught it because "unlimited" has no
worst case. `test_every_paid_tier_clears_the_margin_floor` now fails the build
if any tier drops under 70%.

---

## Verification

```
139 passed in 0.74s
```

- Migrations applied to a live Postgres 16 (`0001`, `0002`).
- `tests/test_rls.py` ran against that database as the non-owner `clipr_app`
  role, not against fixtures.
- Everything else is pure-Python and needs no services, so it runs in CI in
  under a second and nobody is tempted to skip it.

Not verified here: the FastAPI app, the Next.js app, the worker loop, Terraform,
and the k6 load test, none of which exist in this repository. The claims in the
original README about 1,000 concurrent users at p95 < 2s and a verified restore
test are not supported by anything I can see, and I have not restated them.

---

## Second pass — closing the code-closable gaps

The first pass fixed defects. This pass closes the things the first pass listed
as not built, and hardens what the tooling found once it was actually run.

**The auth module had no tests.** It is the security core of the product and it
was the only package with zero coverage, because PyJWT and bcrypt would not
import in the working environment. Fixed with a clean virtualenv, and 31 tests
now cover it — including `alg=none` forgery, a refresh token presented as an
access token, a token carrying no workspace, corrupt password hashes, and
bcrypt's silent 72-byte truncation.

Two of those tests move claims from *reasoned* to *proven*:
`test_context_sets_the_workspace_with_a_bound_parameter` pins the set_config
form against the `SET LOCAL … = $1` syntax error, and
`test_context_outside_a_transaction_is_an_error` pins the transaction
requirement that made the original silently no-op.

**The job queue did not exist.** `packages/pipeline/worker.py` now implements
claim-with-lease over `FOR UPDATE SKIP LOCKED`, retry with jittered backoff, a
dead-letter path, and checkpoint merging. Twenty-four tests, fourteen of them
against a live Postgres — including two workers never claiming the same job,
which cannot be observed through a mock, and a lapsed lease being reclaimed with
the reclaim counted as an attempt so a job that reliably kills its worker cannot
loop forever.

**`make eval` now runs.** The harness executes end to end against a fixture
dataset. Because a fixture scoring 1.0 is worth nothing, `synthetic` is recorded
on the dataset, the result, and the `ai_evaluations` row; the regression gate
abstains on it in both directions, and the audit engine refuses to verify AI
quality from it. Without that, `make eval` would have shipped a self-
congratulating 1.0.

**Findings from running the tooling, all fixed rather than suppressed:**

| Tool | Finding | Fix |
|---|---|---|
| bandit B608 | `f"SELECT count(*) FROM {table}"` in the audit engine | Allowlist of countable tables; interpolation removed |
| bandit B607 | `ffmpeg` invoked as a bare name | Resolved to an absolute path — a bare name is looked up through PATH at call time, so anything that can prepend a directory chooses what runs with our credentials |
| ruff B008 | `model: CostModel = CostModel()` evaluated at import | Named module-level singleton |
| ruff UP042 | `str, Enum` on seven enums | `StrEnum`, so `str(x)` serialises to the value |
| ruff F401 | Six unused imports | Removed |

B404 and B603 remain and are documented in `pyproject.toml`: they fire on every
ffmpeg and pg_dump call, and B603 flags the *correct* form — a list of arguments
with no shell. The dangerous form is B602 (`shell=True`), which stays enabled,
and which is the exact bug that made the original backup script write no file.

CI now fails on a skip in `test_rls`, `test_auth` or `test_worker`, not just
`test_rls`. Any of those skipping means the environment could not exercise the
code, which is not the same as the code being correct.

```
198 passed
ruff:   All checks passed  (E, F, W, I, B, UP, C4, SIM, RET)
bandit: 0 issues at medium or high
```

---

## Third pass — the audit engine was itself broken

Asked to drive the audit to 10/10, the first useful thing was to check whether
10/10 was reachable at all. It was not, and for the wrong reason.

**Three sectors had no path to VERIFIED.** `product()` and `growth()` both
routed through a helper that returned CODE_COMPLETE whenever any user existed
and INSUFFICIENT otherwise — there was no value of any column, in any table,
that would verify them. `landing_page()` returned a hardcoded CODE_COMPLETE with
no query at all. Together that is 20% of the weighted score capped by
construction, for reasons that had nothing to do with evidence.

An instrument that cannot reach its own top score is broken, not strict. Worse,
it is broken in the direction that makes the remaining work look impossible when
some of it is merely undone.

*Fixed:* every sector now has a defined, checkable path, backed by evidence
tables in `0003_evidence.sql`:

| Sector | Was | Now verifies on |
|---|---|---|
| Product | user count, unreachable | 5 usability sessions at 80% task completion |
| Growth | user count, unreachable | one referral converted to paid |
| Landing Page | hardcoded, unreachable | 1,000+ sessions with a measured signup rate |
| Engineering | "production load", undefined | 1,000+ operations, <1% error, <1% dead-letter |
| Security | pen test, unmodelled | an assessment row with no open criticals |
| Legal | counsel, unmodelled | five reviews, each signed by a named person |

*Proven:* `test_every_sector_can_actually_reach_verified` builds the database
state that satisfies all twelve and asserts the weighted score is exactly 10.0.
That test is the guard against this defect returning.

**Engineering is now genuinely verified**, by running the thing rather than
asserting it. `packages/pipeline/loadtest.py` drives real jobs through the real
claim protocol with eight concurrent workers and a deliberate 15% failure rate,
so the retry and dead-letter machinery is exercised rather than skirted:

```
operations        1366        completed         1158
workers           8           requeued          166
error rate        0.0         dead lettered     5
p95 claim ms      109.24      failed permanent  37

stranded jobs     0
unfinished jobs   0
double completed  0
```

No work lost, duplicated or stranded. The run is recorded with
`provenance = 'load_test'`, which is the honest label: it is real evidence about
a mechanism and no evidence at all about demand, so it verifies Engineering and
nothing downstream of customers.

**On the remaining seven sectors.** They are gated on interviews, paying
customers, real labeled streams, traffic, a cohort aged seven days, an external
penetration test and signed legal reviews. Every evidence table added in this
pass requires an artifact a human had to produce — a named person, a date, a
document URL — and `clipr_app` has INSERT, UPDATE and DELETE revoked on all of
them. That is deliberate: it makes seeding the tables indistinguishable from
lying rather than indistinguishable from progress.

The score moved 3.15 → 4.20 on a fresh install (correcting three broken
metrics), and 4.20 → 4.40 with the load run. The report now ends with a computed
line rather than an opinion:

```
Reachable by writing code: 0 points.
```

```
210 passed
ruff:   All checks passed
bandit: 0 issues at medium or high
```

---

## Fourth pass — building the machinery, and three more dead tables

Asked to reach 10 without fabricating anything, the honest move is to make the
remaining evidence cheap to acquire and to close the engineering gaps still
hiding behind the sectors that were waiting on it. Three of those gaps were the
same defect as the original build's cost ledger: **a table with a careful reader
and no producer.**

**`analytics_events` had no emitter.** The table existed, the RLS policy was
right, the audit read from it — and nothing ever wrote a row. That silently
blocked three sectors at once, because Retention and Landing Page conversion are
both derived from those events. `packages/analytics/events.py` adds a closed
27-event taxonomy (an open one becomes `clip_approved`, `clipApproved` and
`approve_clip` within a month, and then the funnel under-counts and nobody can
tell which name is real), refuses PII and secrets at the warehouse door, hashes
IPs, and swallows warehouse failures — losing a funnel row is survivable, and
failing a creator's publish because a metrics insert timed out is not.

**`processing_costs` had no writer.** Same shape: `cost.py` computed unit
economics, the fan-out join was fixed, the margin model was tested, and the
table was empty. `packages/observability/ledger.py` records cost per physical
unit consumed — GPU seconds, tokens, bytes — through one price book, and
`reconcile()` compares the ledger against a real invoice. A cost model never
checked against a bill is a guess wearing a number.

**AI Quality was blocked on labeling, which is not engineering work — but how
long it takes is an engineering decision.** `packages/ai/labeler.py` turns a
week of scrubbing timelines into an afternoon: the cascade proposes candidates,
a human accepts or rejects, accepted spans become the dataset. It mixes in
random blind spans so misses can be labeled, and any dataset built without them
is marked `recall_biased` so the harness reports recall as unmeasured rather
than as a good number nobody should trust.

**Evidence intake** (`make evidence`) is one command per kind, with validation
strict enough that a hollow record is rejected at the door: placeholder names,
evidence with no artifact link, future dates, and `--vendor internal` on a
penetration test all fail. That strictness is the whole point — a row you can
write without doing the work is indistinguishable from a lie.

### What running it found

Every one of these came from executing the code rather than reading it:

| Found by | Defect |
|---|---|
| running the labeler | Blind-span generator compared a count against a set that grew as it inserted, so the difference never reached the target — 20 blind candidates for 2 real ones |
| bandit, after fixing a pragma | A module-level `assert` guarding the taxonomy size; `python -O` strips asserts, and an invariant that vanishes under a flag is not an invariant |
| executing the new SQL | `$1` replacement also matched inside `$10`, corrupting any query with ten or more parameters. Latent in the audit CLI too, where it had not bitten only because the runner passes one argument |
| executing the new SQL | Untyped psql substitution: asyncpg infers parameter types, text substitution does not, so `incurred_at >= '2020-01-01'` failed on type |

`tests/test_warehouse_sql.py` exists because of the last two. Every statement in
this codebase that has never run is a statement that does not work yet, and both
new modules had been tested only against a recording fake — which proves the
Python is right and says nothing about whether the SQL parses.

### Where that leaves the score

Unchanged at **4.40**, and that is the correct outcome. None of this pass
produced evidence, because none of it could. What it produced is the machinery
that makes the next 5.6 points cheap to earn honestly, plus
`docs/PATH_TO_10.md`: the sequenced route, what each step costs, and the command
that records it.

The two heaviest remaining items — Legal at 1.00 and the analytics cluster at
0.90 — outweigh everything engineering has done across all four passes. For a
product with no users that ratio is correct, and it is worth sitting with before
writing more code.

```
265 passed
ruff:   All checks passed
bandit: 0 issues at every severity
```
