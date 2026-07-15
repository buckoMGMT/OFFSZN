// drillEngagement — server-side counters for drills (§2).
// Views throttled to ONE per user per drill per day (anti-gaming).
// Saves / completions dedupe to one per user per drill, ever.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { z } from 'npm:zod@3.24.2';

const bodySchema = z.object({
  drillId: z.string().min(1),
  kind: z.enum(['view', 'save', 'complete']).default('view'),
});

Deno.serve(async (req) => {
  const t0 = Date.now();
  let outcome = 'error';
  let callerId = 'anon';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    callerId = user.id;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });
    const { drillId, kind } = parsed.data;

    const mine = await base44.entities.Athlete.list('-created_date', 1);
    const me = mine[0];
    if (!me) return Response.json({ error: 'No athlete profile found' }, { status: 404 });

    const drill = await base44.asServiceRole.entities.UserVideoSubmission.get(drillId).catch(() => null);
    if (!drill) return Response.json({ error: 'Drill not found' }, { status: 404 });

    // Coaches watching their own drill never count.
    if (drill.athlete_id === me.id) {
      outcome = 'own_drill_skipped';
      return Response.json({ counted: false });
    }

    const today = new Date().toISOString().slice(0, 10);
    const dedupeQuery = kind === 'view'
      ? { athlete_id: me.id, drill_id: drillId, kind, date: today }
      : { athlete_id: me.id, drill_id: drillId, kind };
    const existing = await base44.asServiceRole.entities.DrillEngagement.filter(dedupeQuery);
    if (existing[0]) {
      outcome = 'throttled';
      return Response.json({ counted: false });
    }

    await base44.asServiceRole.entities.DrillEngagement.create({
      athlete_id: me.id, drill_id: drillId, kind, date: today,
    });

    const field = kind === 'view' ? 'view_count' : kind === 'save' ? 'save_count' : 'completion_count';
    const newCount = (drill[field] || 0) + 1;
    const patch = { [field]: newCount };
    if (kind === 'view') patch.views = (drill.views || 0) + 1; // keep legacy display counter in sync
    await base44.asServiceRole.entities.UserVideoSubmission.update(drillId, patch);

    // Drill milestone notification at exactly 100 views.
    if (kind === 'view' && newCount === 100) {
      await base44.asServiceRole.entities.Notification.create({
        recipient_athlete_id: drill.athlete_id,
        type: 'milestone_views',
        title: 'Drill Milestone',
        body: `"${drill.title}" just hit 100 views.`,
      });
    }

    outcome = `counted_${kind}`;
    return Response.json({ counted: true });
  } catch (error) {
    console.error(JSON.stringify({ fn: 'drillEngagement', caller: callerId, outcome: 'error', error: error.message, ms: Date.now() - t0 }));
    return Response.json({ error: error.message }, { status: 500 });
  } finally {
    console.log(JSON.stringify({ fn: 'drillEngagement', caller: callerId, outcome, ms: Date.now() - t0 }));
  }
});