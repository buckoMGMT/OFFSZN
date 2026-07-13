# OFFSZN Audit Scorecard — July 12

Weights: 🔴=3 🟠=2 ⚪=1. "Delivered" = code exists in a package I gave you;
points only count as ✅ once deployed/clicked. Two columns so you can see
exactly what deploying this bundle is worth.

| Category | Verified today | After you deploy bundle + 6 clicks |
|---|---|---|
| Analytics | 2/15 (PostHog delivered) | 10/15 (wired + consent + funnel) |
| SEO | 10/16 (site live, domain fixed) | 13/16 (+GSC submit, app index deploy) |
| Branding | 8/14 (404, skeletons, manifest) | 10/14 (+favicon files you generate) |
| Legal | 4/13 (drafts + consent banner) | 7/13 (attorney review still pending) |
| Security | 13/19 (_headers, guards, auth) | 16/19 (+npm-audit workflow, secrets check) |
| Email | 6/16 (routing + SPF live ✅) | 8/16 (transactional still open) |
| Monitoring | 5/14 (Sentry ✅) | 10/14 (+uptime workflow, +feedback loop) |
| Billing | 6/17 | 6/17 (test in smoke run; dunning open) |
| Performance | 4/10 | 4/10 (run Lighthouse during test week) |
| Launch Day | 4/13 (rollback Q pending) | 10/13 (+help, +feedback, +smoke script) |
| **TOTAL** | **62/147 = 42%** | **94/147 = 64%** |

## The 6 clicks that move you 42% -> ~64%
1. Commit/push this bundle (workflows auto-arm on push)
2. PostHog account + VITE_POSTHOG_KEY in Base44 env
3. Google Search Console: verify offsznapp.com, submit /sitemap.xml
4. Generate favicon set (realfavicongenerator.net) into the app repo
5. One message to Base44 support: "backup/restore + rollback procedure?"
6. Route /help + mount <FeedbackWidget/> + <ConsentBanner/> in AppLayout

You asked for 50-60 by testing on July 20: deploy + clicks gets you ~64%,
with the remaining gap = attorney (Legal), transactional email, dunning,
and Lighthouse — all fine to close during test week.
