// ageGate — hard enforcement of the 13+ minimum age.
// Under 13 → 403 hard block. Otherwise writes date_of_birth, age_verified,
// is_minor (age < 18) to the User record.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const { date_of_birth } = await req.json();
    if (!date_of_birth || Number.isNaN(new Date(date_of_birth).getTime())) {
      return Response.json({ error: 'invalid_date_of_birth' }, { status: 400 });
    }

    const dob = new Date(date_of_birth);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;

    if (age < 13) {
      // Age gate, not a trust-and-safety action — no flags, no fraud logs.
      return Response.json({
        allowed: false,
        reason: 'under_minimum_age',
        message: 'OFFSZN is available to athletes 13 and older.',
      }, { status: 403 });
    }

    const isMinor = age < 18;
    await base44.asServiceRole.entities.User.update(user.id, {
      date_of_birth,
      age_verified: true,
      is_minor: isMinor,
    });

    return Response.json({ allowed: true, is_minor: isMinor });
  } catch (error) {
    console.error('ageGate error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});