// base44/functions/pointsGuard.ts — DAILY EARN CAP
//
// THE MATH (why 300/day):
//   Reward anchors: sticker 1,500 pts · tee 4,000 · hoodie 8,000 ·
//   $10 gift card 10,000 · $25 gift card 22,000.
//   At 300 pts/day MAX:
//     - $10 gift card = 10,000/300 ≈ 34 days of PERFECT earning
//     - hoodie        =  8,000/300 ≈ 27 days
//     - implied liability ceiling ≈ $0.30/user/day — sustainable at scale
//   Combined with the 90-day + 60-logged-days gate (economyGuard), the
//   cheapest possible attack on a $10 reward = 90 real days AND ~5 weeks
//   of maxed daily earning. Microsoft Rewards' model (low daily ceiling +
//   weeks-per-reward ratio) — plus a tenure gate they don't have.
//
// WIRING: call awardPointsSafely() for EVERY total_points increase —
// daily logs, challenge completions, referral bonuses, all of it. Never
// write total_points += X directly anywhere else. One door, one guard.

import { createClientFromRequest } from "@base44/sdk/server";

export const DAILY_EARN_CAP = 300;

async function earnedToday(base44: any, athleteId: string): Promise<number> {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  // DailyLog is the canonical earn record. If you add other earn sources,
  // log them as DailyLog rows (type: "bonus") so this sum stays complete.
  const logs = await base44.asServiceRole.entities.DailyLog.filter({
    athlete_id: athleteId,
    created_date: { $gte: dayStart.toISOString() },
  });
  return logs.reduce((sum: number, l: any) => sum + (l.points_awarded || 0), 0);
}

/**
 * Awards up to `points`, clipped to today's remaining cap. Returns what
 * was actually awarded so the UI can say "Daily cap reached — back
 * tomorrow" instead of silently shorting people.
 */
export async function awardPointsSafely(base44: any, athleteId: string, points: number, reason: string) {
  const athlete = await base44.asServiceRole.entities.Athlete.get(athleteId);
  if (!athlete) throw new Error("Athlete not found");
  if (athlete.is_flagged) return { awarded: 0, capped: false, reason: "account_under_review" };
  if (athlete.throttle_until && new Date(athlete.throttle_until) > new Date())
    return { awarded: 0, capped: false, reason: "throttled" };

  const already = await earnedToday(base44, athleteId);
  const remaining = Math.max(0, DAILY_EARN_CAP - already);
  const award = Math.min(points, remaining);

  if (award > 0) {
    await base44.asServiceRole.entities.Athlete.update(athleteId, {
      total_points: (athlete.total_points ?? 0) + award,
    });
  }
  return { awarded: award, capped: award < points, remainingToday: remaining - award, reason };
}
