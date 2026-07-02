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
export async function assertCoachInteractionAllowed(base44: any, athleteUserId: string) {
  const user = await base44.asServiceRole.entities.User.get(athleteUserId);
  if (!user) throw new MinorSafetyError("USER_NOT_FOUND", "User not found");

  if (!user.is_minor) return; // adult athlete, no additional restriction

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
