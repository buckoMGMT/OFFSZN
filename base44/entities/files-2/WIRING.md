# OFFSZN Onboarding — wiring it in (3 changes)

## 1. Add ONE field to Athlete.jsonc
Everything else onboarding writes already exists in your schema. Add this
to the properties block:

```jsonc
"training_goals": {
  "type": "array",
  "items": {
    "type": "string",
    "enum": ["starting_spot", "gain_muscle", "cut_weight", "get_faster", "recruiting", "stay_ready"]
  },
  "default": [],
  "description": "Selected during onboarding; drives macro targets and drill recommendations later."
}
```

## 2. Drop the file in
`src/pages/Onboarding.jsx` (this package). If your SDK paths differ from
`@/api/entities` and `@/api/functions`, adjust the two import lines —
those are Base44's standard generated paths.

## 3. Route + gate in App.jsx
Add the route OUTSIDE AppLayout (no tab bar during onboarding), and gate
the app so an incomplete athlete always lands there:

```jsx
import Onboarding from '@/pages/Onboarding';
// inside <Routes>, as a sibling of the AppLayout route:
<Route path="/onboarding" element={<Onboarding />} />
```

Then in AuthenticatedApp (or AppLayout), after auth resolves:

```jsx
// Pseudocode — adapt to however you already fetch the athlete record:
const { data: athletes } = useQuery({
  queryKey: ['me-athlete'],
  queryFn: async () => Athlete.filter({ created_by: (await User.me()).email }),
});
const myAthlete = athletes?.[0];
if (athletes && (!myAthlete || !myAthlete.onboarding_complete)) {
  return <Navigate to="/onboarding" replace />;
}
```

That single guard is what makes onboarding unskippable and "synced with
the rest of the app": every page behind AppLayout requires a completed
Athlete record, so the app can rely on sport/weight/goals existing.

## What it does (design notes)
- One question per screen, thumb-zone primary button, endowed progress
  (bar starts with "Account created ✓" filled), 250ms transitions with
  reduced-motion fallback — all per the OFFSZN design system tokens
  already in your tailwind.config.js.
- Step 1 is the AGE GATE: calls your ageGate backend function, hard-stops
  under-13 with kind copy ("NOT YET — BUT SOON."), and threads is_minor
  through so 13-17s see one honest line about guardian approval later.
- Macro targets are auto-computed from weight + goals (1g protein/lb,
  calorie multiplier by goal) so Day 1 of the tracker shows real targets
  instead of 0/0/0/0 — and the finish screen tells them their numbers.
- Coach selection sets role="coach" but explicitly tells them selling is
  locked behind identity verification — role alone unlocks nothing
  money-related (your identity_status + Stripe gates stay in charge).
- Every write goes to a field that exists in Athlete.jsonc today, except
  training_goals (step 1 above). No phantom fields.

## Smoke test after deploy
1. Fresh account → onboarding appears automatically (the gate works)
2. DOB 2015 → hard stop screen
3. DOB 2009 → continues, sees the minor note on step 2
4. Finish → lands in app; Track shows the computed macro targets
5. Kill the app, reopen → goes straight to the feed (onboarding_complete
   is persisted, gate doesn't re-fire)
