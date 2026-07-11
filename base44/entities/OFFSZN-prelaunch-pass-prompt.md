# PASTE INTO BASE44 — OFFSZN PRE-LAUNCH FUNCTIONALITY & AESTHETIC PASS

You are executing the final feature-polish pass before launch. Follow every
section. Rules that apply to everything:

- Use the existing design tokens (surface ladder, Cone Orange accent,
  Archivo Black/Inter) — zero new colors, zero hex literals in components.
- Fields referenced below exist in the schemas UNLESS marked "SCHEMA ADD" —
  never invent field names beyond those.
- Produce the change report in the QA section when done.

---

## 1. THE BUSINESS MODEL CORRECTION (do this first — it touches everything)

**Athletes subscribe to COACHES. There is no per-video price. Anywhere.**

- Remove every per-video/per-drill price display, price pill, "buy" button,
  and any price field UI on individual drills or videos.
- A coach's monetization surface is their **monthly subscription**
  (`Athlete.coach_sub_price_usd`, records in `CoachSubscription`), which
  includes their drill library, 1-on-1 messaging, and personalized feedback.
- Every place a video price used to appear now shows the COACH: avatar,
  name, verified check (identity_status === "verified" only), and
  "$X/mo" with a **Subscribe** button.
- Free drills stay free for everyone. Locked drills say
  "Subscribe to [Coach] to unlock" — never a per-item price.
- Guardian gate: if the viewer is a minor without a verified GuardianLink,
  the Subscribe action shows the plain-language guardian step (existing
  minorSafetyGuard flow) — a normal step, not an error state.

## 2. DRILLS PAGE — EXPLORE-GRID REDESIGN + FULL-SCREEN VIEWER

**The grid (Instagram Explore / Pinterest energy):**
- Replace the current list with a 2-column masonry grid of video
  thumbnail cards, edge-to-edge with 8px gutters, varied tile heights
  (portrait video tiles taller). Thumbnail fills the card; bottom scrim
  gradient; overlaid: drill title (2-line max), coach avatar + name +
  verified check, duration chip, small lock icon ONLY if
  subscription-locked (no price — see §1).
- Top of page: horizontal filter chips (All · My Sport · [sport tags] ·
  Free · My Coaches). "My Coaches" = drills from coaches the athlete
  subscribes to.
- Infinite scroll with skeleton tiles while loading; pull-to-refresh.

**The viewer (fixes the broken half-sheet):**
- Tapping a drill opens a **full-screen takeover**, not a half sheet. The
  current half-height sheet that can't scroll is the bug — remove it
  entirely.
- Layout: video fills the top (16:9 or vertical as uploaded), plays
  immediately muted with tap-to-unmute. Below the video, the info panel:
  title, coach row (avatar/name/verified/Subscribe or Subscribed state),
  full description, tags, related drills from the same coach.
- **Swipe DOWN on the video (or top drag-handle / X button) dismisses**
  back to the grid with a 250ms transition.
- **The info panel scrolls fully** — the entire description must be
  reachable. If the panel is scrolled down, swiping down first scrolls
  back up, THEN dismisses (standard sheet physics — never trap the user).
- Locked drill: show the video's first frame blurred with the lock +
  "Subscribe to [Coach] — $X/mo" CTA centered. Tapping opens the coach
  subscribe sheet.

## 3. TEAMS PAGE — STATE-AWARE, NOT ONE-SIZE

The page renders based on membership state:

**State A — not on a team (current bug state):**
- Show ONLY: Discover (default tab) and Create.
- Discover: searchable list of teams with name, member count, sport,
  join-code entry. NO roster tab, NO challenges tab — the user has no
  roster or challenges yet. Remove the orange circle overlay currently
  hovering on every team card — active/selection accents are for the
  user's OWN team state, not a browse list.
- Empty-state header: "No team yet. Find yours or start one."

**State B — on a team:**
- Default tab: **Challenges**, second tab **Roster**, third **Discover**
  (for browsing other teams — read-only).
- Joining via Discover/join-code or creating a team transitions
  immediately into State B with Challenges open.

## 4. LOCKER ROOM — MYSTERY BOX FULLY REMOVED

- Remove the mystery box tiles, the box-open flow, and **the live feed /
  ticker of box wins** — all of it, not hidden, removed.
- Locker Room is now: points balance hero (nameplate treatment), the
  rewards grid (merch/gift cards from RewardItem), and the 90-day
  eligibility progress ("47/90 days · 31/60 logged") so the real-reward
  gate reads as a goal, not a wall.
- Keep the code path clean: no dead imports or unreachable box components
  left behind.

## 5. STATS PAGE — ADVANCED STATS MOVE IN, OTHER PEOPLE MOVE OUT

- **Move Advanced Stats from the Player page into the Stats page** as a
  second tab: Stats page = [ Today | Advanced ].
- **Remove "top coaches by points" and ANY other-user leaderboard from
  Advanced Stats.** Advanced stats are about MY numbers. Team/leaderboard
  comparison lives on the Teams page, nowhere else.
- Advanced tab contains two tappable comparison cards (collapsed by
  default, tap to expand — not everything dumped on screen at once):
  1. **"vs. NCAA Benchmarks"** — expands to compare the athlete's
     bench/squat/deadlift/mile (Athlete fields) against NCAA-style
     benchmark values for their sport/position, each as a labeled bar:
     my number vs benchmark, delta in positive/negative semantic color.
  2. **"Percentile"** — expands to show where each of their numbers sits
     as a percentile among OFFSZN athletes in their sport/grade,
     displayed as their own percentile only (aggregate math server-side;
     never render another named athlete's data here).
- All-SZN gating stays: free users see the two cards with the ALL-SZN
  ribbon; Pass holders see the data.

## 6. PLAYER PAGE — HEADER FIRST

- Restructure top-to-bottom: (1) avatar + display_name + OFFSZN badge
  number (jersey-number treatment: Archivo Black, big), (2) **bio directly
  under the name** — it introduces the athlete, it does not belong at the
  bottom, (3) sport · position · grade · school line, (4) SZN streak +
  points chips, (5) highlight video if set, (6) weight-room numbers as
  stat tiles, (7) recent posts.
- Remove whatever advanced-stats block lived here (moved to Stats, §5).

## 7. GOALS TAB — EVERYTHING EDITABLE

- Editable fields, each with a stepper or numeric input, saved to the
  Athlete record: goal_calories, goal_protein_g, goal_carbs_g,
  goal_fats_g, goal_weight_lbs, weekly_budget_usd.
- **SCHEMA ADD (two fields on Athlete):**
  ```jsonc
  "water_goal_oz":     { "type": "number", "default": 128 },
  "sleep_goal_hours":  { "type": "number", "default": 8 }
  ```
  Wire the Stats page water tile (currently hardcoded /128) and sleep
  chips to read these instead of constants.
- Include a "Reset to recommended" action that recomputes macro targets
  from current weight_lbs + training_goals (same formula as onboarding).

## 8. SOCIAL + FITNESS POLISH (owner said use judgment — these are the calls)

- **Double-tap to like** on Field posts and drill videos (heart burst in
  accent, single haptic if available).
- **Share a drill to The Field** — from the drill viewer, "Post this to
  your Field" pre-fills a post referencing the drill (drives the
  social↔fitness loop the app is built on).
- **Streak visibility** — the athlete's streak flame chip on their Field
  posts and comments (streaks are social currency; let them flex it).
- **Empty states everywhere** in athlete voice + one action: Field
  ("Nothing logged. Fix that."), Drills-My-Coaches ("No coaches yet.
  Find one worth paying."), Teams State A per §3, Locker Room pre-90-day.
- **Pull-to-refresh** on Field, Drills, Teams; skeletons on all loads —
  zero spinners anywhere in the app.
- **Notifications entry point** — bell in the Field header wired to the
  existing Notification entity (likes, comments, challenge updates,
  subscription events). Badge dot in accent when unread.
- **Coach profile sheet** — tapping any coach avatar anywhere opens a
  consistent coach sheet: verified badge, bio, sport, drill count,
  $X/mo + Subscribe. One component, used everywhere.

## 9. QA / CHANGE REPORT

1. Grep proof: zero remaining per-video price UI, zero "mystery" strings,
   zero references to the removed half-sheet component.
2. Screenshots: drills grid, full-screen viewer (free + locked states),
   Teams State A and State B, Locker Room without boxes, Stats Advanced
   tab (both cards expanded), Player page new order, Goals tab editing,
   guardian-gate subscribe state.
3. Confirm swipe-dismiss physics: viewer dismisses on swipe-down from
   top of info panel, scrolls when panel is mid-scroll.
4. Confirm no other athlete's individual stats render anywhere in
   Advanced Stats.
5. List the two Athlete schema fields added (§7) and every file touched.
