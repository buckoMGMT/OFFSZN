# OFFSZN Smoke Test — run this on July 20, on the LIVE app, as strangers would

Print it, run it top to bottom, check every box. Anything that fails is a
launch blocker. Recruit one real teenager and one real parent for #2/#8.

## 1. The front door
- [ ] Sign up with a brand-new email on the deployed URL (not preview)
- [ ] Sign out, sign back in
- [ ] Password reset email arrives and works end-to-end

## 2. The age gate (get this on video)
- [ ] New account, DOB 2015 -> hard-stopped, kind copy, cannot proceed
- [ ] New account, DOB 2009 -> proceeds, sees minor note in onboarding
- [ ] New account, DOB 2000 -> proceeds, no guardian mentions anywhere

## 3. Onboarding
- [ ] Full flow completes; macro targets appear on Track from the numbers given
- [ ] Kill app, reopen -> lands in feed, onboarding does NOT re-fire
- [ ] Fresh account with onboarding_complete=false -> forced into onboarding

## 4. Money paths
- [ ] All-SZN Pass subscribe with Stripe TEST card 4242… -> tier flips to premium
- [ ] Pass features actually unlock (post to Field, advanced stats, playlists)
- [ ] Cancel path exists and is reachable in settings
- [ ] Coach subscribe as ADULT -> works
- [ ] Coach subscribe as MINOR without guardian -> guardian step, NOT an error
- [ ] Coach with identity_status != verified -> cannot be subscribed by a minor

## 5. Points economy
- [ ] Log a workout -> points credit once (refresh, confirm no double-credit)
- [ ] Merch redemption on a fresh account -> blocked ACCOUNT_TOO_NEW
- [ ] Spam-tap every point-earning button 20x fast -> no duplicate awards

## 6. Social
- [ ] Post to Field (as Pass user), like, comment — all persist after refresh
- [ ] Moderation: post obvious profanity -> status flips to rejected
- [ ] Teams: no-team state shows Discover/Create only; join -> Challenges opens

## 7. Guards & monitoring
- [ ] Trigger a deliberate error (temp crash button) -> appears in Sentry
- [ ] PostHog shows pageviews from your test session (after consent OK)
- [ ] Feedback widget submission appears in Feedback entity
- [ ] offsznapp.com/asdf -> branded 404
- [ ] Waitlist form on site -> green confirmation + email in Formspree

## 8. The parent test
- [ ] Hand a real parent the guardian flow cold. If they hesitate or ask
      "is this safe?" — the copy failed; note exactly where.

## 9. Rollback readiness
- [ ] You know (in writing, from Base44) how to restore the previous
      version if a publish breaks. If you don't, ask them TODAY.
