import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ADMIN-ONLY. A public endpoint that can flag/throttle any athlete by ID
// is a griefing vector — only the fraud agent (running as an admin) or an
// authenticated admin may call this.
Deno.serve(async (req) => {
  const started = Date.now();
  let caller = 'anon';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    caller = user.id;
    if (user.role !== 'admin') {
      console.warn(JSON.stringify({ fn: 'logFraudEvent', caller, outcome: 'forbidden', ms: Date.now() - started }));
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    console.log(JSON.stringify({ fn: 'logFraudEvent', caller, outcome: 'ok', ms: Date.now() - started }));
    return Response.json({ success: true, fraud_event_id: fraudEvent.id, severity });
  } catch (error) {
    console.error(JSON.stringify({ fn: 'logFraudEvent', caller, outcome: 'error', ms: Date.now() - started, error: error.message, stack: error.stack }));
    return Response.json({ error: error.message }, { status: 500 });
  }
});