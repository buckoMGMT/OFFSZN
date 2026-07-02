import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { athlete_id, event_type, severity, evidence, action_taken } = await req.json();

    if (!athlete_id || !event_type || !severity) {
      return Response.json({ error: 'athlete_id, event_type, and severity are required' }, { status: 400 });
    }

    // 1. Write the FraudEvent audit log record
    const fraudEvent = await base44.asServiceRole.entities.FraudEvent.create({
      athlete_id,
      event_type,
      severity,
      evidence: evidence || {},
      action_taken: action_taken || 'logged',
      reviewed_by_human: false
    });

    // 2. Apply throttle/flag to Athlete based on severity
    const now = new Date();

    if (severity === 'critical') {
      const throttleUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      await base44.asServiceRole.entities.Athlete.update(athlete_id, {
        is_flagged: true,
        flagged_reason: evidence?.summary || event_type,
        flagged_at: now.toISOString(),
        throttle_until: throttleUntil
      });
    } else if (severity === 'high') {
      const throttleUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
      await base44.asServiceRole.entities.Athlete.update(athlete_id, {
        throttle_until: throttleUntil
      });
    }
    // low/medium: log only, no Athlete update

    return Response.json({ success: true, fraud_event_id: fraudEvent.id, severity });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});