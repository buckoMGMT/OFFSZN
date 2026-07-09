# OFFSZN Launch-Readiness Pack — what this raises and what's left

## What I just built (drop these in — raises your score now)

### app/ — replace/add in your Base44 repo (SEO + Branding categories)
- index.html — fixes ALL of: Base44 favicon removed, og:image added,
  twitter card added, canonical added, meta made consistent, fonts now
  match your tailwind config. (Was the single most broken file.)
- manifest.json — the file your index.html referenced but didn't exist
  (was a 404 every load). Add real icon PNGs at the referenced paths.
- robots.txt — blocks search indexing of the app (it's behind auth).

### site/ — add to your Cloudflare marketing site (SEO + Security)
- robots.txt + sitemap.xml — lets Google index the marketing site;
  submit sitemap in Google Search Console.
- .well-known/security.txt — responsible-disclosure contact.

### legal/ — DRAFTS for your attorney (Legal category, your weakest)
- privacy-policy-DRAFT.md
- terms-of-service-DRAFT.md
  Both tailored to OFFSZN's real features. Your lawyer EDITS these
  instead of writing from scratch — cheaper and faster. NOT publishable
  as-is; every [FILL] needs your facts and a legal pass.

## Estimated audit impact once these are deployed
- SEO/Discoverability: 8/16 -> ~14/16 (og:image, canonical, sitemap, robots)
- Branding/Assets: 7/14 -> ~11/14 (favicon, manifest, apple-touch-icon,
  theme-color — you still need to CREATE the actual icon image files)
- Security: 12/19 -> ~13/19 (security.txt)
- Legal: 3/13 -> ~7/13 once drafts are attorney-reviewed & published
- **Projected total: 31% -> ~42-45%** after deploy + attorney sign-off.

## What ONLY YOU can do (the dashboard-signup items — I can't click these)
Fastest points-per-hour, in order:
1. Sentry (error tracking) — free, ~30 min — Monitoring category 🔴
2. PostHog (analytics) — free, ~1 hr — the entire Analytics category is 0
3. Cloudflare Email Routing — free, ~10 min — Email category 🔴
4. Transactional email (Resend) + test password reset — ~1 hr — Email 🔴
5. UptimeRobot — free, ~15 min — Monitoring 🟠
6. Google Search Console — verify + submit the sitemap above — SEO 🔴
7. Create favicon/icon image files (use a tool like realfavicongenerator)
   — the meta tags above POINT to them; you supply the images.

## What needs a decision (I can draft, you decide)
- SocialPost.status default: "approved" (instant feed) vs "pending"
  (pre-moderation). For 13+ + video, I recommend pending for video.
- Apple IAP vs Stripe for in-app coach content (margin-defining).
- Shop pricing anchors (in the fixes README).

Deploy the three folders, kick the legal drafts to your attorney, then
knock out the 7 dashboard items. That path takes you from 31% to the
mid-40s this week, and the attorney review + email flow push you past 50%
the week after.
