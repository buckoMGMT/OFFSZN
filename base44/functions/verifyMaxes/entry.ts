// verifyMaxes — a VERIFIED coach vouches for a subscriber's maxes.
// Server-side is the boundary: coach identity + active paid subscription are
// both checked here. Writes MaxVerification records (RLS write = admin-only,
// so this function is the ONLY write path).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const ALLOWED_FIELDS = [
  'bench_press_lbs', 'squat_lbs', 'deadlift_lbs',
  'mile_time_seconds', 'forty_yd_seconds', 'vertical_jump_inches',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const { athleteId, fields } = await req.json();
    if (!athleteId || !Array.isArray(fields) || fields.length === 0) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }
    const requested = fields.filter(f => ALLOWED_FIELDS.includes(f));
    if (requested.length === 0) {
      return Response.json({ error: 'no_valid_fields' }, { status: 400 });
    }

    // The caller must be a coach with verified identity.
    const coachList = await base44.asServiceRole.entities.Athlete.filter({ created_by: user.email }, '-created_date', 1);
    const coach = coachList[0];
    if (!coach || coach.role !== 'coach') {
      return Response.json({ error: 'not_a_coach' }, { status: 403 });
    }
    if (coach.identity_status !== 'verified' && !coach.is_coach_verified) {
      return Response.json({ error: 'coach_not_verified', message: 'Verify your identity before vouching for athlete maxes.' }, { status: 403 });
    }

    // The athlete must be an ACTIVE PAID subscriber of this coach — you can
    // only verify maxes for athletes you actually coach.
    const subs = await base44.asServiceRole.entities.CoachSubscription.filter({
      subscriber_athlete_id: athleteId,
      coach_athlete_id: coach.id,
      is_paid: true,
      status: 'active',
    });
    if (subs.length === 0) {
      return Response.json({ error: 'not_your_athlete', message: 'You can only verify maxes for your active coaching subscribers.' }, { status: 403 });
    }

    const targetList = await base44.asServiceRole.entities.Athlete.filter({ id: athleteId }, '-created_date', 1);
    const target = targetList[0];
    if (!target) return Response.json({ error: 'athlete_not_found' }, { status: 404 });

    const now = new Date().toISOString();
    const verified = [];
    const skipped = [];
    for (const field of requested) {
      const value = target[field];
      if (typeof value !== 'number' || value <= 0) { skipped.push(field); continue; }
      // Upsert — one verification record per athlete+field.
      const existing = await base44.asServiceRole.entities.MaxVerification.filter({ athlete_id: athleteId, field });
      const data = {
        athlete_id: athleteId,
        coach_athlete_id: coach.id,
        coach_name: coach.display_name,
        field,
        value,
        verified_at: now,
      };
      if (existing[0]) {
        await base44.asServiceRole.entities.MaxVerification.update(existing[0].id, data);
      } else {
        await base44.asServiceRole.entities.MaxVerification.create(data);
      }
      verified.push(field);
    }

    return Response.json({ verified, skipped });
  } catch (error) {
    console.error('verifyMaxes error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});