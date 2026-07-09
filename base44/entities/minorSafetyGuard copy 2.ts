// base44/functions/minorSafetyGuard.ts — MERGED, CORRECTED VERSION
// This replaces BOTH prior versions. Fixes:
//  1. Live age from date_of_birth (the old deployed version trusted the
//     stored is_minor flag — a 17-year-old stayed "minor" forever; the
//     18 sunset never happened).
//  2. coach.identity_verified -> coach.identity_status === "verified"
//     (identity_verified does not exist on Athlete; the old check treated
//     EVERY coach as unverified and blocked all coach content to minors).
//  3. Restores assertPublicExposureAllowed (Smart Gate: public leaderboards
//     & high-stakes challenges) — missing from the deployed version.
//  4. Adds assertSweepstakes18Plus — the website promises "sweepstakes
//     eligibility is 18+ and separate from 13+ training access"; this is
//     the code that makes that promise true. Call it on any Join
//     Sweepstakes / prize-challenge path.

export class MinorSafetyError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * SUNSET RULE: age is computed LIVE from date_of_birth at every check —
 * never trust the stored is_minor flag alone (it goes stale at 18).
 * Fail safe: no DOB or bad DOB = treated as a minor.
 */
function ageFrom(dobIso: string | null | undefined): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function isCurrentlyMinor(dobIso: string | null | undefined): boolean {
  const age = ageFrom(dobIso);
  return age === null ? true : age < 18;
}

async function hasVerifiedGuardian(base44: any, athleteUserId: string): Promise<boolean> {
  const links = await base44.asServiceRole.entities.GuardianLink.filter({
    minor_user_id: athleteUserId,
    status: "verified",
  });
  return links.length > 0;
}

/**
 * Call before any coach<->athlete direct interaction: content purchase,
 * a future DM feature, booking a 1:1 session. Adults pass automatically
 * (sunset applied live); minors need a verified guardian.
 */
export async function assertCoachInteractionAllowed(base44: any, athleteUserId: string) {
  const user = await base44.asServiceRole.entities.User.get(athleteUserId);
  if (!user) throw new MinorSafetyError("USER_NOT_FOUND", "User not found");
  if (!isCurrentlyMinor(user.date_of_birth)) return;

  if (!(await hasVerifiedGuardian(base44, athleteUserId))) {
    throw new MinorSafetyError(
      "GUARDIAN_APPROVAL_REQUIRED",
      "Athletes under 18 need a linked, verified parent/guardian account before purchasing coach content or contacting a coach directly."
    );
  }
}

/**
 * SMART GATE — public exposure. Call before a minor joins a public
 * leaderboard or a high-stakes ClanChallenge (anything showing their
 * name/stats beyond their own clan). Within-clan features never call
 * this — core training stays friction-free for 13-17 by design.
 */
export async function assertPublicExposureAllowed(base44: any, athleteUserId: string) {
  const user = await base44.asServiceRole.entities.User.get(athleteUserId);
  if (!user) throw new MinorSafetyError("USER_NOT_FOUND", "User not found");
  if (!isCurrentlyMinor(user.date_of_birth)) return;

  if (!(await hasVerifiedGuardian(base44, athleteUserId))) {
    throw new MinorSafetyError(
      "GUARDIAN_APPROVAL_REQUIRED",
      "Public leaderboards and high-stakes challenges need a verified parent/guardian on the account for athletes under 18."
    );
  }
}

/**
 * SWEEPSTAKES — hard 18+ line, NO guardian override. The website states:
 * training is 13+, sweepstakes eligibility is 18+ and separate. A guardian
 * link does not make a 16-year-old sweepstakes-eligible; age of majority
 * is the law's line, not ours. Call on every Join Sweepstakes path.
 */
export async function assertSweepstakes18Plus(base44: any, athleteUserId: string) {
  const user = await base44.asServiceRole.entities.User.get(athleteUserId);
  if (!user) throw new MinorSafetyError("USER_NOT_FOUND", "User not found");
  const age = ageFrom(user.date_of_birth);
  if (age === null || age < 18) {
    throw new MinorSafetyError(
      "SWEEPSTAKES_18_PLUS",
      "Sweepstakes and prize-based promotions are open to eligible entrants 18 and older only."
    );
  }
}

/**
 * Call before a coach's content can be shown to a minor at all, even free
 * content. Uses the REAL schema field: identity_status enum
 * (unverified | pending | verified | failed) — only "verified" passes.
 */
export async function assertCoachEligibleForMinorAudience(base44: any, coachAthleteId: string) {
  const coach = await base44.asServiceRole.entities.Athlete.get(coachAthleteId);
  if (!coach) throw new MinorSafetyError("COACH_NOT_FOUND", "Coach not found");

  if (coach.is_flagged) {
    throw new MinorSafetyError("COACH_FLAGGED", "Flagged coaches cannot reach minor audiences pending review.");
  }
  if (coach.identity_status !== "verified") {
    throw new MinorSafetyError(
      "IDENTITY_VERIFICATION_REQUIRED",
      "Coaches must complete identity verification before their content is served to athletes under 18."
    );
  }
}
