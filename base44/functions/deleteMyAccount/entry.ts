import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Deletes/anonymizes the CALLER's data only. Deletion is always allowed —
// minors need no guardian approval to delete. Financial records (Redemptions)
// are anonymized, never deleted. Active paid subscriptions must be cancelled first.
Deno.serve(async (req) => {
  const started = Date.now();
  let caller = 'anon';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    caller = user.id;

    const { confirm } = await req.json();
    if (confirm !== 'DELETE') return Response.json({ error: 'Confirmation text mismatch' }, { status: 400 });

    // The caller's own athlete record (user-scoped read)
    const mine = await base44.entities.Athlete.list('-created_date', 1);
    const athlete = mine[0];

    if (athlete) {
      // Block deletion while a paid subscription is live — cancel via the portal first.
      const activeSubs = await base44.asServiceRole.entities.CoachSubscription.filter({
        subscriber_athlete_id: athlete.id, is_paid: true, status: 'active',
      });
      if (activeSubs.length > 0) {
        return Response.json({ error: 'ACTIVE_SUBSCRIPTION', message: 'Cancel your active subscription first, then delete your account.' }, { status: 400 });
      }

      const svc = base44.asServiceRole.entities;
      await svc.DailyLog.deleteMany({ athlete_id: athlete.id });
      await svc.Meal.deleteMany({ athlete_id: athlete.id });
      await svc.ProgressEntry.deleteMany({ athlete_id: athlete.id });
      await svc.SocialPost.deleteMany({ athlete_id: athlete.id });
      await svc.GuardianLink.deleteMany({ athlete_id: athlete.id }).catch(() => {});
      // Financial records: anonymize, never delete
      await svc.Redemption.updateMany(
        { athlete_id: athlete.id },
        { $set: { shipping_address: '', notes: 'account deleted — anonymized' } }
      ).catch(() => {});
      await svc.Feedback.deleteMany({ created_by_id: user.id }).catch(() => {});
      await svc.Athlete.delete(athlete.id);
    }

    console.log(JSON.stringify({ fn: 'deleteMyAccount', caller, outcome: 'ok', ms: Date.now() - started }));
    return Response.json({ deleted: true });
  } catch (error) {
    console.error(JSON.stringify({ fn: 'deleteMyAccount', caller, outcome: 'error', ms: Date.now() - started, error: error.message, stack: error.stack }));
    return Response.json({ error: error.message }, { status: 500 });
  }
});