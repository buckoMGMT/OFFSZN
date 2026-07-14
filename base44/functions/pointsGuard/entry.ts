// pointsGuard — awardPointsSafely. DAILY_EARN_CAP = 300.
// Sums today's DailyLog.points_earned, clips the award to the remaining cap,
// updates total_points, returns {awarded, capped, remainingToday}.
// ALL total_points increases must go through this — one door, one guard.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const DAILY_EARN_CAP = 300;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const { athleteId, points, reason } = await req.json();
    if (!athleteId || !points || points <= 0) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }

    // User-scoped get: callers can only award to their own athlete record.
    const athlete = await base44.entities.Athlete.get(athleteId);
    if (!athlete) return Response.json({ error: 'athlete_not_found' }, { status: 404 });
    if (athlete.is_flagged) return Response.json({ awarded: 0, capped: false, reason: 'account_under_review' });
    if (athlete.throttle_until && new Date(athlete.throttle_until) > new Date()) {
      return Response.json({ awarded: 0, capped: false, reason: 'throttled' });
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const logs = await base44.entities.DailyLog.filter({
      athlete_id: athleteId,
      created_date: { $gte: dayStart.toISOString() },
    });
    const already = logs.reduce((sum, l) => sum + (l.points_earned || 0), 0);
    const remaining = Math.max(0, DAILY_EARN_CAP - already);
    const award = Math.min(points, remaining);

    if (award > 0) {
      await base44.entities.Athlete.update(athleteId, {
        total_points: (athlete.total_points ?? 0) + award,
      });
    }

    return Response.json({
      awarded: award,
      capped: award < points,
      remainingToday: remaining - award,
      dailyCap: DAILY_EARN_CAP,
      reason,
    });
  } catch (error) {
    console.error('pointsGuard error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});