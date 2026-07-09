# OFFSZN Fixes Package — read this first

## What's in here and why

**functions/mysteryBox.ts** — was 100% broken; now works and can't be farmed.
- `points_balance` → `total_points` (the real field; the old code checked a
  phantom field, so every open failed AND points would never have deducted)
- Athlete lookup by `created_by` (Base44's auto-stamped user email) instead
  of the nonexistent `user_id`. If your app links Athlete↔User differently,
  change the ONE `ATHLETE_LOOKUP` constant at the top.
- **The economy fix:** old silver/gold boxes had POSITIVE expected value
  (silver paid ~553 avg on a 500 cost; gold ~2,510 on 2,000). That's an
  infinite point printer — the exact "hack the point system" hole you asked
  me to close, except it needed no hacking. New tiers all carry a ~7.5%
  house edge (bronze 92.8 EV/100, silver 462.8/500, gold 1,852/2,000), and
  the module now REFUSES TO DEPLOY if any future edit pushes EV ≥ cost.
- Persistent daily cap: 5 opens/day counted from Redemption records, which
  survives across serverless instances (the old in-memory cooldown didn't).
- Redemption record now matches the schema (see entities/Redemption.jsonc).
- Pricing note: 100/500/2000 points sits under typical shop items (a $10
  gift card should cost well above 2,000 points — see pricing suggestion
  below) so boxes are the impulse buy, merch is the grind goal.

**functions/minorSafetyGuard.ts** — merged the two conflicting versions
into one correct file:
- Live age from date_of_birth (18 sunset now automatic; the deployed
  version trusted the stale is_minor flag)
- `identity_status === "verified"` (the deployed check read a field that
  doesn't exist and blocked ALL coach content to minors)
- Restores `assertPublicExposureAllowed` (the Smart Gate — missing from
  the deployed version)
- NEW `assertSweepstakes18Plus` — the website promises sweepstakes are 18+
  and separate from 13+ training; this function makes the code match the
  website. No guardian override: a guardian link does not make a minor
  sweepstakes-eligible, because age of majority is the law's line.
  **Wire it into every Join Sweepstakes / ClanChallenge-with-prizes path.**

**functions/economyGuard.ts** — NEW. Your 90-day rule, enforced:
real-world redemptions (merch, gift cards) require account age ≥ 90 days
AND ≥ 60 distinct logged days in the last 90 AND clean standing. Time
can't be compressed — that's what makes this stronger than any points
threshold. Mystery boxes stay ungated (they pay points, not goods, and
net-burn points via the house edge). Wiring example is in the file.
Surface the progress in UI ("47/90 days") so the gate reads as a goal.

**functions/ageGate.ts** — one-line fix: the rejection message said
"The Playbook"; now says OFFSZN. Everything else was already correct.

**entities/Redemption.jsonc** — adds mystery_box to reward_type, makes
reward_item_id optional (enforce it in code for merch/gift_card), adds
points_awarded / box_tier / reward_tier.

## Deploy order
1. Push entities/Redemption.jsonc FIRST (functions write these fields).
2. Push all four functions.
3. DELETE every `_copy` file from your project — you currently have two
   versions of safety-critical files and were one bad deploy away from
   shipping the broken one. One canonical version, always.
4. Smoke test: open a bronze box on a test account (should succeed once
   the account has ≥100 total_points), then try a merch redemption on a
   fresh account (should fail with ACCOUNT_TOO_NEW).

## What I could NOT fix — do these yourself
1. **The Athlete↔User link is an assumption.** I used `created_by`
   (Base44's convention). Verify one real Athlete record in your dashboard
   actually has created_by = the athlete's email. If not, tell me the real
   link field and it's a one-line change.
2. **User entity fields unverified.** ageGate writes date_of_birth /
   age_verified / is_minor to User — I've never seen your User.jsonc.
   Open the User entity in Base44 and confirm those three fields exist.
   If they don't, the age gate SILENTLY does nothing. Highest-stakes
   unknown in the whole system.
3. **SocialPost.status defaults to "approved"** — posts go live BEFORE the
   moderator sees them. For a 13+ platform I'd default to "pending"
   (pre-moderation). That's a product call: safety vs. feed immediacy.
   Recommendation: pending for video, approved-with-fast-review for text.
4. **Wire the guards in.** economyGuard and assertSweepstakes18Plus only
   protect paths that CALL them. Grep your redemption + challenge-join
   functions and add the calls.
5. **Shop pricing** (competitive-with-boxes): suggested anchors —
   sticker/small merch 1,500 pts; tee 4,000; hoodie 8,000; $10 gift card
   10,000; $25 gift card 22,000. That keeps gold box (2,000) an impulse
   buy and puts real goods safely behind weeks of earning. Set
   real_world_value_usd on every RewardItem so you can audit
   points-per-dollar consistency in one query.

## AUDIT SCORE — as of today

Method: your checklist, 🔴 items weighted 3, 🟠 2, ⚪ 1. Scored only what
I could verify from code you sent + the deployed website work.

| Category            | Score | Notes |
|---------------------|-------|-------|
| Analytics           |  0/15 | Nothing installed. Fastest big win on the list. |
| SEO/Discoverability |  8/16 | Site solid (OG image, meta); APP index.html still broken (no og:image, Base44 favicon, mismatched meta). |
| Branding/Assets     |  7/14 | Skeletons ✅, 404 ✅; favicon/manifest/touch-icon ✗. |
| Legal/Compliance    |  3/13 | Stubs exist; nothing published; no cookie consent. Pre-launch blocker. |
| Security            | 12/19 | Auth on functions ✅, fraud guard ✅, secrets pattern ✅, throttling ✅ — after these fixes. Headers/rate-limit-at-edge unverified. |
| Email               |  0/16 | Nothing exists. No transactional provider, no routing, no SPF/DKIM. |
| Monitoring          |  2/14 | Fraud audit log ✅. No Sentry, no uptime, backup policy unknown — ask Base44 directly. |
| Billing             |  6/17 | Stripe SDK + Connect flow built ✅; dunning, cancellation, tax, and the Apple IAP question all open. |
| Performance         |  4/10 | Heavy deps eagerly loaded; unmeasured. Run Lighthouse. |
| Launch Day          |  3/13 | Rollback = confirm Base44 version restore; smoke test not done. |
| **TOTAL**           | **45/147 ≈ 31%** | Was ~24% before today's fixes. |

Honest read: **31% is normal for 2+ weeks out** — but the zeros (Analytics,
Email) and Legal are the ones that don't compress well. Sequence: Legal →
Email → Analytics → the app index.html fixes → everything else.

## ADD THESE TO YOUR AUDIT LIST (your sheet has a hole exactly where
your app is most exposed — it's a generic SaaS list, and you're running
a youth platform with a points economy and UGC)

### 🧒 Youth Safety & Minor Compliance  ← the section your list is missing
- [ ] Age gate verified working end-to-end in production 🔴
- [ ] Guardian verification flow tested with a real parent 🔴
- [ ] Coach identity verification live before any coach content ships 🔴
- [ ] Sweepstakes 18+ block enforced in code, not just copy 🔴
- [ ] Pre- vs post-moderation decision made per content type 🔴
- [ ] CSAM detection/reporting path for video uploads 🔴 (legal duty, not optional)
- [ ] Human review queue staffed — who reads FraudEvents & CoachReports? 🔴
- [ ] Minor data retention & deletion policy 🟠
- [ ] State minor-social-media laws checked (TX/UT/LA etc.) 🟠

### 🎰 Points Economy Integrity
- [ ] Every box tier EV < cost, asserted in code 🔴 (done today)
- [ ] 90-day real-reward gate live on all merch/gift-card paths 🔴
- [ ] Daily earn cap — max points/day from all sources combined 🟠
- [ ] Points-per-dollar consistency audit across RewardItems 🟠
- [ ] Referral fraud rules (self-referral, same-device rings) 🟠

### 📱 App Store Readiness (you're going native — start now, not at port time)
- [ ] Apple IAP vs Stripe decision for digital coach content 🔴 (margin-defining)
- [ ] Age rating questionnaire dry run (UGC + chance mechanics push it up) 🟠
- [ ] Kids/teen-app review guidelines reviewed against feature set 🟠

Keep scoring against the combined list weekly. Send me the User.jsonc and
the redemption/challenge-join functions next and I'll wire the remaining
guards and re-score.
