# PASTE INTO BASE44 — COACH SERVICE LAYER (optional for coaches, present for Apple)

Purpose: structure every coach subscription as a 1:1 personal SERVICE,
not digital content. Features are OPTIONAL for coaches to enable but the
framework exists platform-wide — that presence is the point.

## 1. SCHEMA — add to Athlete.jsonc
```jsonc
"coach_services": {
  "type": "array",
  "items": { "type": "string",
    "enum": ["messaging", "form_checks", "weekly_programming", "progress_checkins"] },
  "default": ["messaging"],
  "description": "Services included in this coach's subscription. Messaging is always on; the rest are optional but encouraged."
},
"coach_response_sla_hours": {
  "type": "number", "default": 48,
  "description": "Coach's committed reply time for subscriber messages."
}
```

## 2. COACH SETTINGS (coach role only): "Your subscription includes"
- Messaging — toggle LOCKED ON, labeled "Included in every subscription"
- Form-check video reviews — optional toggle, sub-label "Encouraged: coaches offering form checks convert more subscribers"
- Weekly programming — optional toggle
- Monthly progress check-ins — optional toggle
- Response time picker: 24h / 48h / 72h (default 48)
- Copy at top, plain register: "OFFSZN subscriptions are 1-on-1 coaching services. Pick what yours includes — athletes see this before they subscribe."

## 3. SURFACES THAT DISPLAY IT
- Coach profile sheet + subscribe sheet: "WHAT'S INCLUDED" list built
  from coach_services, each with a Lucide icon; response SLA shown as
  "Replies within 48h". Never show an empty list — messaging is always there.
- Drill viewer locked state: the subscribe CTA lists the top 2 services.
- Post-subscribe confirmation: "You now have direct access to [Coach] —
  message anytime, replies within 48h."

## 4. RULES
- Do NOT gate any existing feature behind these toggles — additive only.
- Wording everywhere says "coaching service" / "1-on-1 coaching", never
  "content subscription" — this language is deliberate and load-bearing.
- QA: screenshot coach settings, profile sheet, subscribe sheet showing
  services list; grep zero instances of "content subscription".
