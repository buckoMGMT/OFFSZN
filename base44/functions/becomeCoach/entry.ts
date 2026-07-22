// becomeCoach — server-side role switch. Age is computed LIVE from
// date_of_birth (never a stored flag); under-18 or unknown age is denied here
// regardless of what the client shows.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const dob = user.date_of_birth ? new Date(user.date_of_birth) : null;
    let age = null;
    if (dob && !Number.isNaN(dob.getTime())) {
      const now = new Date();
      age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    }
    if (age === null || age < 18) {
      return Response.json({ error: 'under_18', message: 'Coaching opens at 18. Keep stacking points, maxes, and film — it unlocks automatically.' }, { status: 403 });
    }

    const athletes = await base44.asServiceRole.entities.Athlete.filter({ created_by: user.email }, '-created_date', 1);
    const athlete = athletes[0];
    if (!athlete) return Response.json({ error: 'no_athlete_profile' }, { status: 404 });
    if (athlete.role === 'coach') return Response.json({ ok: true, athlete });

    const updated = await base44.asServiceRole.entities.Athlete.update(athlete.id, { role: 'coach' });
    return Response.json({ ok: true, athlete: updated });
  } catch (error) {
    console.error('becomeCoach error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});