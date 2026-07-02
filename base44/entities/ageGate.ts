// base44/functions/ageGate.ts
//
// Hard enforcement of the platform's 13+ minimum age. Call this from your
// signup/onboarding flow BEFORE an Athlete record is created — the User
// entity's date_of_birth field alone does nothing; this function is the
// actual gate.
//
// 13 is the COPPA line (COPPA governs operators of services collecting
// data from children UNDER 13) — staying at 13+ keeps you off COPPA's
// direct-compliance hook. It does NOT mean 13-17 year-olds are unregulated:
// this function also sets is_minor (age < 18), which minorSafetyGuard.ts
// uses to restrict coach<->minor contact and purchases. Do not skip that
// file — a 13+ floor without it means adult coaches can DM and sell paid
// content to 13-year-olds with no additional safeguard, which is a real
// legal and trust-and-safety problem independent of COPPA.
//
// Where to call it from:
//   1. Frontend onboarding step, right after date_of_birth is collected —
//      call this function via the SDK and block navigation until it resolves ok.
//   2. Also call it server-side before Athlete.create() as defense in depth —
//      never trust a client-only check for something this important.
//
// Note on scope: this blocks signup. It does NOT retroactively purge any
// existing under-16 accounts if the app previously had no age gate. If
// you're migrating from "no minimum" to "16+", pair this with a one-time
// backend_function that lists existing Users, computes age from
// date_of_birth (if you already collected it) and flags accounts for
// manual review/removal. If you never collected date_of_birth before now,
// you cannot programmatically determine existing users' ages — that needs
// a re-verification prompt on next login, not a silent backend sweep.

import { createClientFromRequest } from "@base44/sdk/server";

const MIN_AGE_YEARS = 13;
const ADULT_AGE_YEARS = 18; // used to compute is_minor, not for the gate itself

function calculateAge(dobIso: string): number {
  const dob = new Date(dobIso);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export default async function handler(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return new Response(JSON.stringify({ error: "not_authenticated" }), { status: 401 });
  }

  let body: { date_of_birth?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_body" }), { status: 400 });
  }

  const dob = body.date_of_birth;
  if (!dob || Number.isNaN(new Date(dob).getTime())) {
    return new Response(JSON.stringify({ error: "invalid_date_of_birth" }), { status: 400 });
  }

  const age = calculateAge(dob);

  if (age < MIN_AGE_YEARS) {
    // Do NOT create an Athlete record, do NOT set age_verified: true.
    // Return a clear, non-punitive message — this is an age gate, not a
    // trust-and-safety action, so don't flag or log the account as fraud.
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "under_minimum_age",
        message: `The Playbook is available to users ${MIN_AGE_YEARS} and older.`,
      }),
      { status: 403 }
    );
  }

  // asServiceRole bypasses row-level security — required here because the
  // signup flow runs before the user has any Athlete-scoped permissions yet.
  const isMinor = age < ADULT_AGE_YEARS;
  await base44.asServiceRole.entities.User.update(user.id, {
    date_of_birth: dob,
    age_verified: true,
    is_minor: isMinor,
  });

  // is_minor drives minorSafetyGuard.ts (coach contact + purchase restrictions).
  // It is NOT a moderation flag — don't treat it like is_flagged on Athlete.
  return new Response(JSON.stringify({ allowed: true, is_minor: isMinor }), { status: 200 });
}
