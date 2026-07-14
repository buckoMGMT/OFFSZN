// economyGuard — assertRealRewardEligible. Gates every merch/gift_card
// redemption: account ≥ 90 days old AND ≥ 60 distinct DailyLog days in the
// last 90 AND not flagged/throttled. Error responses include progress
// (accountAgeDays, loggedDays) so the UI shows "47/90 days" as a goal.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const MIN_ACCOUNT_AGE_DAYS = 90;
const MIN_LOGGED_DAYS = 60;
const WINDOW_DAYS = 90;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const { athleteId } = await req.json();
    // User-scoped get: only the athlete's owner (or an admin) can check.
    const athlete = await base44.entities.Athlete.get(athleteId);
    if (!athlete) return Response.json({ error: 'ATHLETE_NOT_FOUND', message: 'Athlete not found' }, { status: 404 });

    // Cheapest check first — flagged accounts get no further info.
    if (athlete.is_flagged) {
      return Response.json({ error: 'ACCOUNT_UNDER_REVIEW', message: 'Account is under review. Redemptions are paused.' }, { status: 403 });
    }
    if (athlete.throttle_until && new Date(athlete.throttle_until) > new Date()) {
      return Response.json({ error: 'THROTTLED', message: 'Account is temporarily throttled.' }, { status: 403 });
    }

    const accountAgeDays = Math.floor((Date.now() - new Date(athlete.created_date).getTime()) / 86400000);

    const windowStart = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
    const logs = await base44.entities.DailyLog.filter({
      athlete_id: athleteId,
      created_date: { $gte: windowStart },
    });
    const distinctDays = new Set(logs.map((l) => (l.date ?? l.created_date ?? '').slice(0, 10)));
    distinctDays.delete('');
    const loggedDays = distinctDays.size;

    if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
      return Response.json({
        error: 'ACCOUNT_TOO_NEW',
        message: `Real-world rewards unlock after ${MIN_ACCOUNT_AGE_DAYS} days of training on OFFSZN.`,
        accountAgeDays, loggedDays,
        requiredDays: MIN_ACCOUNT_AGE_DAYS, requiredLoggedDays: MIN_LOGGED_DAYS,
      }, { status: 403 });
    }
    if (loggedDays < MIN_LOGGED_DAYS) {
      return Response.json({
        error: 'CONSISTENCY_NOT_MET',
        message: `Real-world rewards need ${MIN_LOGGED_DAYS} logged days in the last ${WINDOW_DAYS}. Keep showing up.`,
        accountAgeDays, loggedDays,
        requiredDays: MIN_ACCOUNT_AGE_DAYS, requiredLoggedDays: MIN_LOGGED_DAYS,
      }, { status: 403 });
    }

    return Response.json({ eligible: true, accountAgeDays, loggedDays });
  } catch (error) {
    console.error('economyGuard error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});