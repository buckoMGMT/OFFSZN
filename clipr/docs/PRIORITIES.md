# Twenty priorities, and the economics behind them

Every number here comes from `packages/billing/economics.py`, which is locked by
30 tests. Re-run it with `make economics` after any pricing change.

---

## The economics, first

**The headline: it does not lose money, and breakeven is 26 paying customers.**

At 55% allowance utilisation, on a 70/25/5 plan mix:

| Customers | MRR | Variable | Fixed | Profit |
|---:|---:|---:|---:|---:|
| 25 | $1,312 | $431 | $900 | **−$19** |
| 50 | $2,625 | $863 | $900 | $862 |
| 100 | $5,250 | $1,726 | $900 | $2,624 |
| 300 | $15,750 | $5,178 | $900 | $9,672 |

Contribution is **$35.24 per customer per month**. Twenty-six of them covers a
$900 fixed base. That is a reachable number, and it is the main reason this is
worth starting.

### Per customer, at 100% of allowance — the worst realistic case

| | Rail $29 | Control Room $79 | Network $249 |
|---|---:|---:|---:|
| Infrastructure | $5.29 | $19.04 | $57.12 |
| Support | $9.00 | $9.00 | $9.00 |
| Payment fees | $1.14 | $2.59 | $7.52 |
| **Contribution** | **$13.35** | **$48.16** | **$175.15** |
| Contribution margin | 46.1% | 61.0% | 70.3% |
| LTV | $167 | $747 | $2,863 |
| LTV:CAC | **2.6** ⚠ | 11.8 | 45.1 |
| CAC payback | 6.3 mo | 1.4 mo | 0.4 mo |

### No customer any plan permits can lose money

Stress-tested against the four shapes each plan actually allows — full
allowance, sitting at the overage cap, one source live 24/7, and rejecting
everything up to the free-rejection cap. **Worst case across all twelve
scenarios is Rail with a source live around the clock: +$8.26/month.** Thin,
but never negative.

### What hurts most if an assumption is wrong

| If this is wrong | Profit impact at 300 customers |
|---|---:|
| Support is 40 min/customer, not 12 | **−$6,300** |
| Fixed platform is $2,500, not $900 | −$1,600 |
| Everyone uses 100% of allowance | −$1,529 |
| ASR is hosted API, not self-hosted | −$828 |
| Trials convert at 10%, not 25% | −$128 |
| Churn is 10%/mo, not 6% | −$44 |

Each of those alone leaves the business profitable. **Support load is four
times the next-largest risk** — and on Rail, human minutes ($9.00) cost more
than every machine combined ($5.29). Everyone worries about the GPU bill. The
GPU bill is 18% of revenue and it is not the problem.

### The one number that fails

**Rail's LTV:CAC is 2.6, against a 3.0 floor.** Every Rail sale is marginally
value-destroying at a $60 CAC. Four ways out, all tested:

| Fix | LTV:CAC | Payback |
|---|---:|---:|
| Do nothing | 2.6 ✗ | 6.3 mo |
| Raise Rail to $39 | 5.2 | 3.2 mo |
| Halve support to 6 min | 3.8 | 4.4 mo |
| Cut CAC to $35 | 4.3 | 3.8 mo |
| Support 6 min **and** CAC $45 | 5.0 | 3.3 mo |

The last row is the one to aim at: it fixes the ratio without touching the
price, and both halves are things worth doing anyway.

---

## The twenty

Ordered by expected value, not by effort. Numbers 1–5 decide whether there is a
business at all.

### Existential — do these before writing another feature

**1. Apply for TikTok Content Posting API and Instagram Graph publishing today.**
Approval lead time is the critical path and nothing else can start it. Unattended
multi-account posting is exactly the pattern platforms police, and if the answer
is no, the product is a different product. Find out now, not after launch.

**2. Ten creator interviews.** 0.50 audit weight, a week of DMs, and the cheapest
possible way to discover the pricing is wrong. Question six — *"if clips posted
themselves overnight, what would go wrong?"* — is the one that finds the
objection nobody has thought of.

**3. Get support to 6 minutes per customer per month.** This is the largest
single risk in the model by 4×, and it also fixes Rail's LTV:CAC. Self-serve
OAuth, a status page that answers "where is my clip", and an onboarding that
never needs a human. Treat every support ticket in the first 90 days as a
product bug with a root cause.

**4. IP assignment, this month.** If anyone has written a line of this without a
contract assigning it, that problem compounds monthly and it is the first thing
diligence finds. Cheap now, expensive later, unrelated to the audit score.

**5. Label 50 moments from real streams.** `make label` turns a week into an
afternoon. Until this exists, "our AI picks better clips" is a claim with
nothing behind it, and the eval gate cannot protect a model nobody has measured.

### Pricing and packaging

**6. Fix Rail's LTV:CAC before spending a dollar on ads.** At 2.6 every paid
acquisition destroys value. Either land the support and CAC targets first, or
raise Rail to $39. Do not scale a leaky funnel.

**7. Require a card for the trial.** 14 days full-featured with no card is the
most abusable surface here. Cards do not stop trials converting — they stop
trials that were never going to. Alternatively cap trial monitored hours at 10.

**8. Publish the runway, not just the price.** "60 monitored hours" means
nothing to a streamer. "About 15 four-hour streams a month" means everything.
The comparison that sells is *2.5 hours versus 60*, not $15 versus $29.

**9. Add an annual option to Rail.** Opus Starter is monthly-only. Annual
front-loads cash at exactly the stage where cash is the constraint, and halves
effective churn on the tier where churn hurts most.

**10. Meter what you can defend and nothing else.** Two meters is already one
more than ideal. Resist a third, ever — every additional meter is a support
ticket generator and another number that can silently bind before the headline.

### Product

**11. Ship the review queue before the dashboard.** Approve-or-kill on a phone
is the product's emotional core and the only genuinely mobile moment. A web
dashboard nobody opens after week one is not what makes this feel alive.

**12. Instrument the activation funnel from day one.** The taxonomy is built and
`ACTIVATION_FUNNEL_SQL` computes median time from signup to first clip. That
single number tells you more about the product than any survey.

**13. Make "where is my clip" answerable without asking.** Every unanswered
status question is a support minute, and support minutes are the #1 risk. A
visible pipeline state per stream pays for itself.

**14. Five usability sessions with people who have never seen it.** Say nothing
while they try. Every question you answer is a finding you just destroyed.

**15. Build the degrade path into the UI, not just the adapter.** `manual_handoff`
works in code. A creator needs to understand, in the moment, that the clip is
ready and needs one tap. That is a design problem, currently unsolved.

### Engineering

**16. Wire the ledger into the pipeline the day it processes anything real.**
The writers exist; nothing calls them yet. Cost data is the input to every
pricing decision, and a month of untracked processing is a month of guessing.

**17. Reconcile against the first cloud invoice.** `Ledger.reconcile()` exists
for this. **Drift over 10% means the price book is wrong and the plan
allowances derived from it are wrong too.** Put it in the calendar for the
first of every month.

**18. Measure the real clips-per-hour rate and re-balance the meters.** The
whole plan table is sized against an assumed 2.5 clips/hour. If real streams
yield 4, every allowance is 60% too generous and the margins move with it.

**19. Cap concurrent monitored sources per workspace at the plan limit in the
watcher, not just in the API.** Entitlements are enforced at the entitlement
layer today. The watcher is what actually costs money.

**20. Write the incident runbook before the first incident.** Specifically: a
platform revokes OAuth for every customer at once. That is the most likely
serious outage, it is not a code problem, and the worst time to think about it
is while it is happening.

---

## What would change the answer

The model says start it. Three things would make it say otherwise:

- **Platform API access denied.** Not a pricing problem, a product-existence
  problem. Hence priority 1.
- **Support settling above ~40 minutes per customer.** That alone costs more
  than every other assumption being wrong combined.
- **Real clips-per-hour materially above 2.5**, which would mean every allowance
  is over-generous and the meters need re-sizing before, not after, launch.

None of the three can be resolved by writing more code, and all three are
measurable within the first month of real traffic.
