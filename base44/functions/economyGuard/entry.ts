// economyGuard — assertRealRewardEligible. Pre-check for the UI: account ≥ 90
// days old AND ≥ 60 distinct DailyLog days in the last 90 AND not flagged /
// throttled. Actual enforcement happens again inside redeemReward.
// Rules live in base44/shared/rewardEligibility.ts (shared with redeemReward).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { checkRewardEligibility } from '../../shared/rewardEligibility.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const { athleteId } = await req.json();
    // User-scoped get: only the athlete's owner (or an admin) can check.
    const athlete = await base44.entities.Athlete.get(athleteId);
    if (!athlete) return Response.json({ error: 'ATHLETE_NOT_FOUND', message: 'Athlete not found' }, { status: 404 });

    const result = await checkRewardEligibility(base44.entities, athlete);
    if (!result.ok) return Response.json(result.body, { status: result.status });

    return Response.json({ eligible: true, accountAgeDays: result.accountAgeDays, loggedDays: result.loggedDays });
  } catch (error) {
    console.error('economyGuard error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});