// base44/functions/minorSafetyGuard.ts
//
// Why this file exists: lowering the platform floor to 13 does NOT, by
// itself, make the coach marketplace safe for 13-17 year-olds. Coaches can
// be adults selling paid video content and running promoted posts into the
// free feed. Without an explicit rule, a 13-year-old athlete and an adult
// coach can transact and message with zero additional friction beyond a
// content moderator that only looks at individual posts after the fact.
// This function is the friction. Call it from every code path that would
// let a coach and an athlete interact 1:1 — content purchase, direct
// message (if/when you build DMs), coach profile "contact" actions.
//
// Design, not just detection: moderation catches bad content after it's
// posted. This guard prevents an entire class of interaction from being
// possible in the first place for minor accounts, which is the stronger
// property to have here.

import { createClientFromRequest } from "@base44/sdk/server";

export class MinorSafetyError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Call before any coach<->athlete direct interaction: content purchase,
 * a future DM feature, booking a 1:1 session, etc. Athlete here means the
 * BUYER/recipient side of the interaction, not the coach.
 */
/**
 * SUNSET RULE: age is computed LIVE from date_of_birth at every check —
 * never trust the stored is_minor flag alone. A user who signed up at 17
 * has a stale is_minor=true forever; computing from DOB means guardian
 * requirements retire automatically at 18 with zero migration or cron job.
 * (Keep is_minor as a denormalized hint for UI, but enforcement uses this.)
 */
function isCurrentlyMinor(dobIso: string | null | undefined): boolean {
  if (!dobIso) return true; // no DOB on file = treat as minor, fail safe
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return true;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age < 18;
}

export async function assertCoachInteractionAllowed(base44: any, athleteUserId: string) {
  const user = await base44.asServiceRole.entities.User.get(athleteUserId);
  if (!user) throw new MinorSafetyError("USER_NOT_FOUND", "User not found");

  if (!isCurrentlyMinor(user.date_of_birth)) return; // adult — sunset applied automatically

  // Minor athletes (13-17): allowed to consume free/public content and
  // structured, moderated group content (Clans, public feed). NOT allowed
  // to initiate a paid 1:1 purchase or any direct-contact feature with a
  // coach without a parent/guardian on the account. This is the actual
  // safeguard — age alone isn't enough once real money and adult-minor
  // contact are both in play.
  const guardianLinked = await base44.asServiceRole.entities.GuardianLink.filter({
    minor_user_id: athleteUserId,
    status: "verified",
  });

  if (guardianLinked.length === 0) {
    throw new MinorSafetyError(
      "GUARDIAN_APPROVAL_REQUIRED",
      "Athletes under 18 need a linked, verified parent/guardian account before purchasing coach content or contacting a coach directly."
    );
  }
}

/**
 * SMART GATE — public exposure. Call before a minor athlete joins a
 * public leaderboard or a high-stakes ClanChallenge (anything that makes
 * their name/stats visible beyond their own clan). Same guardian
 * requirement as commerce, same automatic sunset at 18. Private,
 * within-clan features do NOT call this — core training stays
 * friction-free for 13-17 by design.
 */
export async function assertPublicExposureAllowed(base44: any, athleteUserId: string) {
  const user = await base44.asServiceRole.entities.User.get(athleteUserId);
  if (!user) throw new MinorSafetyError("USER_NOT_FOUND", "User not found");
  if (!isCurrentlyMinor(user.date_of_birth)) return;

  const guardianLinked = await base44.asServiceRole.entities.GuardianLink.filter({
    minor_user_id: athleteUserId,
    status: "verified",
  });
  if (guardianLinked.length === 0) {
    throw new MinorSafetyError(
      "GUARDIAN_APPROVAL_REQUIRED",
      "Public leaderboards and high-stakes challenges need a verified parent/guardian on the account for athletes under 18."
    );
  }
}

/**
 * Call before a coach's content can be shown to a minor at all, even for
 * free content — coaches themselves must be identity-verified adults in
 * good standing, not just Stripe-payout-active, before their content
 * reaches a known-minor audience.
 */
export async function assertCoachEligibleForMinorAudience(base44: any, coachAthleteId: string) {
  const coach = await base44.asServiceRole.entities.Athlete.get(coachAthleteId);
  if (!coach) throw new MinorSafetyError("COACH_NOT_FOUND", "Coach not found");

  if (coach.is_flagged) {
    throw new MinorSafetyError("COACH_FLAGGED", "Flagged coaches cannot reach minor audiences pending review.");
  }
  if (!coach.identity_verified) {
    throw new MinorSafetyError(
      "IDENTITY_VERIFICATION_REQUIRED",
      "Coaches must complete identity verification before their content is served to athletes under 18."
    );
  }
}
