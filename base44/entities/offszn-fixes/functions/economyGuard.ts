// base44/functions/economyGuard.ts — NEW
//
// Owner requirement: "at least 90 days of consistent hard use before
// players receive anything for real." This guard enforces it server-side.
//
// SCOPE — what counts as "real":
//   - Redemptions with reward_type "merch" or "gift_card" (real-world value)
//   - GATED by this guard.
//   Mystery boxes are NOT gated — they pay points, not goods, and the
//   house edge means they net-burn points. Gating them would kill the fun
//   loop with zero fraud benefit.
//
// THE THREE TESTS (all must pass):
//   1. Account age >= 90 days (from the athlete record's created_date)
//   2. Consistency: >= 60 distinct DailyLog days within the last 90
//      (roughly 5 days/week — "consistent hard use", not just an old account)
//   3. Clean standing: not flagged, not throttled
//
// Why this beats a points threshold alone: points can be farmed fast by a
// determined cheater; TIME cannot be compressed. 90 days of real calendar
// time + 60 logged days means the cheapest attack on your merch shop costs
// three months of daily effort per account — which is just... being a user.

export class EconomyGuardError extends Error {
  code: string;
  detail: Record<string, unknown>;
  constructor(code: string, message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

const MIN_ACCOUNT_AGE_DAYS = 90;
const MIN_LOGGED_DAYS_IN_WINDOW = 60;
const WINDOW_DAYS = 90;

export async function assertRealRewardEligible(base44: any, athleteId: string) {
  const athlete = await base44.asServiceRole.entities.Athlete.get(athleteId);
  if (!athlete) throw new EconomyGuardError("ATHLETE_NOT_FOUND", "Athlete not found");

  // Test 3 first — cheapest check, and flagged accounts get no further info.
  if (athlete.is_flagged) {
    throw new EconomyGuardError("ACCOUNT_UNDER_REVIEW", "Account is under review. Redemptions are paused.");
  }
  if (athlete.throttle_until && new Date(athlete.throttle_until) > new Date()) {
    throw new EconomyGuardError("THROTTLED", "Account is temporarily throttled.");
  }

  // Test 1 — account age. Base44 stamps created_date on every record.
  const createdAt = new Date(athlete.created_date);
  const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
  if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
    throw new EconomyGuardError(
      "ACCOUNT_TOO_NEW",
      `Real-world rewards unlock after ${MIN_ACCOUNT_AGE_DAYS} days of training on OFFSZN.`,
      { accountAgeDays, required: MIN_ACCOUNT_AGE_DAYS }
    );
  }

  // Test 2 — consistency. Count DISTINCT days with a DailyLog in the window.
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
  const logs = await base44.asServiceRole.entities.DailyLog.filter({
    athlete_id: athleteId,
    created_date: { $gte: windowStart },
  });
  const distinctDays = new Set(
    logs.map((l: any) => (l.date ?? l.created_date ?? "").slice(0, 10))
  );
  distinctDays.delete("");
  if (distinctDays.size < MIN_LOGGED_DAYS_IN_WINDOW) {
    throw new EconomyGuardError(
      "CONSISTENCY_NOT_MET",
      `Real-world rewards need ${MIN_LOGGED_DAYS_IN_WINDOW} logged days in the last ${WINDOW_DAYS}. Keep showing up.`,
      { loggedDays: distinctDays.size, required: MIN_LOGGED_DAYS_IN_WINDOW }
    );
  }

  return {
    eligible: true,
    accountAgeDays,
    loggedDaysInWindow: distinctDays.size,
  };
}

/**
 * Wire this into whatever backend function creates merch/gift_card
 * Redemptions. Example:
 *
 *   import { assertRealRewardEligible, EconomyGuardError } from "./economyGuard.ts";
 *   ...
 *   if (rewardItem.type === "merch" || rewardItem.type === "gift_card") {
 *     try {
 *       await assertRealRewardEligible(base44, athlete.id);
 *     } catch (e) {
 *       if (e instanceof EconomyGuardError) {
 *         return json({ error: e.code, message: e.message, ...e.detail }, 403);
 *       }
 *       throw e;
 *     }
 *   }
 *
 * UI note: surface the progress ("47/90 days · 31/60 logged") instead of a
 * flat rejection — the gate then reads as a goal, not a wall, which is
 * exactly the retention mechanic you want it to be.
 */
