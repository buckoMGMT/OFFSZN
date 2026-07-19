// Shared eligibility rules for real-world reward redemptions.
// Used by economyGuard (pre-check for the UI) and redeemReward (enforced at redemption).
export const MIN_ACCOUNT_AGE_DAYS = 90;
export const MIN_LOGGED_DAYS = 60;
export const WINDOW_DAYS = 90;

// entities: a Base44 entities client (user-scoped or service-role).
// Returns { ok: true, accountAgeDays, loggedDays } or { ok: false, status, body }.
export async function checkRewardEligibility(entities, athlete) {
  if (athlete.is_flagged) {
    return { ok: false, status: 403, body: { error: 'ACCOUNT_UNDER_REVIEW', message: 'Account is under review. Redemptions are paused.' } };
  }
  if (athlete.throttle_until && new Date(athlete.throttle_until) > new Date()) {
    return { ok: false, status: 403, body: { error: 'THROTTLED', message: 'Account is temporarily throttled.' } };
  }

  const accountAgeDays = Math.floor((Date.now() - new Date(athlete.created_date).getTime()) / 86400000);
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
  const logs = await entities.DailyLog.filter({
    athlete_id: athlete.id,
    created_date: { $gte: windowStart },
  });
  const distinctDays = new Set(logs.map((l) => (l.date ?? l.created_date ?? '').slice(0, 10)));
  distinctDays.delete('');
  const loggedDays = distinctDays.size;
  const progress = { accountAgeDays, loggedDays, requiredDays: MIN_ACCOUNT_AGE_DAYS, requiredLoggedDays: MIN_LOGGED_DAYS };

  if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
    return { ok: false, status: 403, body: { error: 'ACCOUNT_TOO_NEW', message: `Real-world rewards unlock after ${MIN_ACCOUNT_AGE_DAYS} days of training on OFFSZN.`, ...progress } };
  }
  if (loggedDays < MIN_LOGGED_DAYS) {
    return { ok: false, status: 403, body: { error: 'CONSISTENCY_NOT_MET', message: `Real-world rewards need ${MIN_LOGGED_DAYS} logged days in the last ${WINDOW_DAYS}. Keep showing up.`, ...progress } };
  }
  return { ok: true, accountAgeDays, loggedDays };
}