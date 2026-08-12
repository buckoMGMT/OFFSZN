# ClipR — teardown, product model, and self-audit

Status: concept work. Nothing here is wired to OFFSZN's app code; `clipr/` is a
self-contained landing page plus this document.

---

## 1. What Opus Clip's pricing page is actually doing

I could not fetch `opus.pro` directly — the session's egress proxy blocks that
host — so the structure below comes from indexed third-party breakdowns
(quso.ai, ssemble.com, eesel.ai, klap.app, dynalord.com, checkthat.ai) rather
than from the live page. Treat the numbers as "as reported, mid-2026", not as a
scrape.

**The plan ladder**

| Plan | Price | Allowance | What unlocks |
|---|---|---|---|
| Free | $0 | 60 credits/mo | Watermarked, exports expire in 3 days |
| Starter | $15/mo | 150 credits/mo | Watermark off, 20+ caption languages, 1 brand template. No annual option, **no scheduler** |
| Pro | $29/mo | 300 credits/mo (annual: 3,600/yr upfront at $174 ≈ $14.50/mo) | AI B-roll, social scheduler, all aspect ratios, 2 seats, Premiere/CapCut export |
| Business | Custom | — | API access, enterprise terms |

**The mechanics worth stealing**

1. **One credit = one minute of source video, charged on ingest.** Billing
   before value is delivered. Twenty clips or two clips from a 60-minute file
   costs the same 60 credits.
2. **The scheduler is the ladder rung.** Starter deliberately withholds
   publishing so the "I actually want this in my workflow" user is pushed to
   Pro. That single feature is doing most of the $15 → $29 upgrade work.
3. **Annual is credit-granted, not month-metered.** 3,600 credits dropped
   upfront reads as generous, and it front-loads cash while quietly making
   churn feel wasteful.
4. **The free tier is real but decays.** 3-day export expiry converts on
   urgency rather than on capability.
5. **API is enterprise-gated**, which is the industry norm (Klap and Submagic
   both meter it separately) and leaves an obvious opening.

**The exploitable flaw:** per-source-minute pricing is a podcast/webinar model.
It is actively hostile to the highest-volume video producers alive — live
streamers. A single 6-hour Twitch session is 360 credits. That is more than the
entire Pro monthly allowance, spent in one night, and Opus is charging for the
5h 45m it correctly threw away.

That's the whole wedge. ClipR isn't "a better clipper" — it's the same category
priced and plumbed for a customer the incumbents' meter can't serve.

---

## 2. What ClipR is

An **autonomous clip desk for live channels**. It attaches to a stream when it
goes live, ranks moments in real time, cuts and captions the winners, and posts
them natively to every account the creator owns — all before the stream ends.
The user's involvement is optional and mobile: approve or kill.

Three things must be true or the product is just another clipper:

- **Zero-touch.** If the creator has to remember to do anything, the product
  failed. Go-live detection is the entire onboarding.
- **Distribution is the feature.** Rendering a good vertical clip is table
  stakes in 2026. Getting it onto 6 accounts across 4 platforms with per-platform
  pacing is not.
- **It gets better at *your* audience.** Retention data flowing back into the
  ranker is the only defensible moat here; models and FFmpeg pipelines are not.

---

## 3. Pricing model and why these numbers

| | Rail | Control Room | Network |
|---|---|---|---|
| Monthly | $29 | $79 | $249 |
| Annual (2 mo free) | $24/mo | $66/mo | $207/mo |
| Live sources | 1 | 3 | 12 |
| Monitored hours | 60/mo | 200/mo | Unmetered |
| Published clips | 80/mo | 400/mo | 2,000/mo |
| Connected accounts | Unlimited | Unlimited | Unlimited |
| Seats | 1 | 4 | Unlimited |

**Design decisions**

- **Two meters, both aligned with value.** *Monitored hours* covers our real
  fixed cost (a watcher process on a live feed). *Published clips* covers the
  expensive part (GPU render + upload) and only bills when the creator got
  something they wanted. **A rejected clip is free** — which makes our ranker
  being wrong our cost, not theirs. That sentence alone is a landing-page
  headline the incumbents structurally cannot copy.
- **No free tier, 14-day trial instead.** Live monitoring is a standing cost
  per connected channel, unlike batch jobs. A free tier here is a
  permanently-running GPU bill for non-payers. The trial is full-featured;
  urgency does the converting.
- **$29 entry matches Opus Pro on price** and beats it on the one axis
  streamers feel: 60 monitored hours vs. 5 hours of source video.
- **No feature is withheld to force an upgrade.** Auto-posting, unlimited
  destination accounts and watermark-free export are in the $29 tier. Upgrades
  are bought on *volume and team*, which is a healthier expansion curve than
  hostage-taking and doesn't produce the "I pay $15 and can't publish" review
  that Starter generates.
- **Overage is a soft ceiling.** $0.35/published clip, capped at the price of
  the next plan up. Nobody's pipeline dies mid-stream, and nobody gets a $900
  invoice. The cap is effectively a self-service upsell.

**Unit economics sanity check (per monitored hour)**

| Cost | Estimate |
|---|---|
| Ingest + segment watch (CPU, chat socket) | ~$0.02 |
| ASR on candidate windows only (~12% of stream, batched GPU) | ~$0.06 |
| LLM ranking over candidate transcripts | ~$0.08 |
| Render + upload, ~2.5 published clips/hr | ~$0.09 |
| **Total** | **~$0.25/hr** |

Rail at 60 hours ≈ $15 COGS against $29 — about 48% gross margin, which is
*thin* and is the single biggest number to re-check before launch (see audit).
Control Room at 200 hours ≈ $50 against $79 is worse. **These two tiers need
either a monitored-hour trim (Rail 40h, Control Room 150h) or a materially
cheaper detection path before the pricing is safe to ship.** The site currently
publishes the optimistic version; that's a known, deliberate gap flagged here.

The key lever is the **cheap-first cascade**: chat velocity, emote bursts,
native clip-button events and audio RMS are nearly free and run on 100% of the
stream. Transcription and LLM judgment — the expensive parts — only touch the
~10-15% of windows that survive. Any competitor transcribing everything pays
roughly 6-8× our per-hour cost. That cascade is the business model.

---

## 4. Should this be an app?

**Yes, but not as the primary surface, and not first.**

The work is server-side and permanent — an always-on pipeline. The control
surface is a web dashboard. But there is one genuinely mobile moment, and it's
the product's emotional core: **approve or kill, on your phone, in the 20
minutes after you stop streaming.** Swipe left/right on a stack of vertical
clips that are already rendered and already captioned. That interaction is bad
on desktop and excellent on a phone, and it's what makes the product feel alive.

Recommended order:

1. **Web app (responsive, PWA-installable)** — dashboard, connections, brand
   kits, billing, review queue. Ships first, no app-store dependency.
2. **Native shell via Capacitor** — for push notifications ("4 clips ready from
   tonight") and the swipe review UI. This repo already runs Capacitor 8 with
   iOS configured, plus `@capacitor/haptics`, `@capacitor/preferences` and
   `@capacitor/share` — the review-queue haptics and share sheet are close to
   free.
3. **No native-first build.** The differentiator is a backend that never
   sleeps. Spending the first two months on app-store review is the wrong trade.

Push notification is the retention mechanic, not a nicety: it's the thing that
turns "a tool I subscribed to" into "a thing that talks to me after every
stream."

---

## 5. Architecture sketch

```
go-live webhook (Twitch EventSub / YouTube PubSubHubbub / Kick poll)
        │
        ▼
  watcher (one lightweight worker per live channel)
    ├── HLS segment tail  ──► audio RMS + scene-change
    └── chat socket       ──► msg/sec, emote burst, clip-button events
        │
        ▼  fused moment score, sliding 90s windows
   candidate windows (top ~12% only)
        │
        ▼
  ASR (batched, self-hosted faster-whisper) ──► LLM ranker
        │  hook / payoff / clean in-out points
        ▼
  render farm (FFmpeg + speaker tracking or HUD-aware crop, burned captions)
        │
        ▼
  publish queue  ──► per-platform pacing + native upload APIs
        │
        ▼
  metrics collector (48h retention pull) ──► per-creator ranker weights
```

Reuse from this repo: Stripe integration and the subscription/past-due patterns
in `src/components/monetization/`, the `PremiumGate` gating primitive, the
Sentry wiring, and the surface-ladder token system in `tailwind.config.js`.
ClipR keeps its own accent (tally red / signal cyan) so the two products stay
visually distinct.

---

## 6. Self-audit — what's weak

Ranked by how likely each is to kill the product.

**1. Platform API access is the existential risk.** TikTok's Content Posting
API requires audit and approval; unattended multi-account posting is exactly
the pattern platforms police. Instagram's Graph API reels publishing has rate
limits and a business-account requirement. If auto-post gets revoked, the core
promise evaporates. *Mitigation:* build a per-account fallback to a scheduled
draft + one-tap push notification, so the product degrades to "one tap" rather
than to nothing. Do this before launch, not after the first suspension.

**2. Margins on the lower two tiers are too thin** (48% and 37% modeled). Either
cut monitored hours, raise Rail to $39, or drive the candidate rate below 12%.
The page as written publishes the optimistic allowances — that must be resolved
before real billing.

**3. "Rejected clips are free" is gameable.** A user can auto-reject everything,
pull the rendered file over the API, and pay for nothing. *Fix:* rejection only
voids the charge if the file was never downloaded or published, and rejects are
capped at ~3× the plan's clip allowance.

**4. The cost calculator on the page is doing competitor math with an assumed
overage rate ($0.10/credit).** It's labeled as an estimate, which is the honest
minimum, but comparative pricing claims against a named competitor invite
complaints. Before this goes public, either source a real published overage
rate or reframe the comparison generically ("credit-based tools") — the copy
currently says "credit tool", which is the safer framing, and the competitor is
not named in the calculator.

**5. Moment detection on small channels degrades badly.** Chat velocity is the
strongest signal and a 30-viewer stream barely has any. The cheap-first cascade
quietly assumes an audience. *Fix:* fall back to audio energy + speech-rate +
game-event detection when chat volume is below a threshold, and be honest that
early-stage streamers get a weaker product.

**6. Legal exposure on music and third-party footage.** We are automatically
republishing live content that routinely contains copyrighted audio, reacted-to
videos and other people's voices. Rights flagging is currently a Network-tier
feature. That is backwards — detection should be on every tier, with only the
bulk-management tooling gated.

**7. Brand and name.** "ClipR" is a crowded, near-generic name in a category
that already contains Klap, Clipwise, Clips.ai and OpusClip. Trademark search
before anything is printed.

**8. No moat for 6-12 months.** The pipeline is reproducible. The retention
feedback loop is the only accumulating asset, and it only compounds once there
are enough creators and enough published clips. Everything before that point is
a land-grab funded by being the only tool that doesn't punish streamers.

**9. The landing page has no evidence.** No logos, no numbers, no clip examples,
no testimonials — because none exist yet. It's honest, but it will underconvert
against competitors flashing "10M creators". First real customers should be
recruited by hand and turned into on-page proof immediately.

**10. Typography is system-stack, not licensed.** The Artifact CSP blocks font
CDNs, and I chose not to inline a webfont as a data URI for a concept page. A
real launch needs a licensed display face — the current look is deliberate, but
it's carried by layout and color rather than by type ownership.

---

## 7. What I'd do next, in order

1. Re-run the unit economics against a real GPU bill and fix the tier
   allowances. Nothing else matters if the margin is wrong.
2. Apply for TikTok Content Posting API and Instagram Graph publishing access
   now — approval lead time is the real critical path.
3. Build the watcher + cheap-cascade detector against one Twitch channel and
   measure candidate precision. If the top 12% of windows don't contain the
   moments a human would pick, the whole cost model collapses.
4. Only then build the dashboard, and hand-recruit ten streamers for proof.
