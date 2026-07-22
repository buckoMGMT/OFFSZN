// Server-side reward redemption — the ONLY path that spends points.
// Verifies the caller's own athlete, eligibility, and live balance before
// creating the Redemption and deducting points via service role.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { checkRewardEligibility } from '../../shared/rewardEligibility.ts';

Deno.serve(async (req) => {
  const started = Date.now();
  let caller = 'anon';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    caller = user.id;

    const { rewardItemId, shippingAddress } = await req.json();
    if (!rewardItemId) return Response.json({ error: 'rewardItemId is required' }, { status: 400 });

    // Caller's OWN athlete — user-scoped read, never taken from the payload.
    const mine = await base44.entities.Athlete.list('-created_date', 1);
    const athlete = mine[0];
    if (!athlete) return Response.json({ error: 'No athlete profile found' }, { status: 404 });

    const item = await base44.asServiceRole.entities.RewardItem.get(rewardItemId).catch(() => null);
    if (!item || item.is_active === false) {
      return Response.json({ error: 'REWARD_NOT_FOUND', message: 'This reward is not available.' }, { status: 404 });
    }
    if (item.type === 'merch') {
      return Response.json({ error: 'COMING_SOON', message: 'Merch redemptions are coming soon.' }, { status: 400 });
    }

    const gate = await checkRewardEligibility(base44.asServiceRole.entities, athlete);
    if (!gate.ok) return Response.json(gate.body, { status: gate.status });

    // Fresh server-side balance check + deduction — the client never touches points.
    const fresh = await base44.asServiceRole.entities.Athlete.get(athlete.id);
    const balance = fresh.total_points || 0;
    if (balance < item.points_required) {
      return Response.json({ error: 'INSUFFICIENT_POINTS', message: 'Not enough points for this reward.' }, { status: 400 });
    }

    // Deduct points FIRST so a failure between the two writes can never leave a
    // reward record without a matching deduction (CWE-362). If the redemption
    // record then fails to create, we roll the points back.
    const newBalance = balance - item.points_required;
    await base44.asServiceRole.entities.Athlete.update(athlete.id, { total_points: newBalance });

    let redemption;
    try {
      redemption = await base44.asServiceRole.entities.Redemption.create({
        athlete_id: athlete.id,
        reward_item_id: item.id,
        reward_name: item.name,
        reward_type: item.type,
        points_spent: item.points_required,
        shipping_address: shippingAddress || '',
        status: 'pending',
      });
    } catch (createErr) {
      // Compensating action — restore the balance we just deducted.
      await base44.asServiceRole.entities.Athlete.update(athlete.id, { total_points: balance }).catch(() => {});
      throw createErr;
    }

    console.log(JSON.stringify({ fn: 'redeemReward', caller, outcome: 'ok', item: item.id, points: item.points_required, ms: Date.now() - started }));
    return Response.json({ success: true, redemption_id: redemption.id, new_balance: newBalance });
  } catch (error) {
    console.error(JSON.stringify({ fn: 'redeemReward', caller, outcome: 'error', ms: Date.now() - started, error: error.message }));
    return Response.json({ error: error.message }, { status: 500 });
  }
});