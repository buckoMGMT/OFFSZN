// leaderboard — the public filtered leaderboard, with the minor-exposure rail
// enforced SERVER-SIDE: a minor (age computed LIVE from date_of_birth, never a
// stored flag alone) appears only when a VERIFIED GuardianLink has
// public_exposure_approved = true. Unknown age = treated as not-approved.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function liveAge(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const { sport, grade, position } = await req.json().catch(() => ({}));
    const query = { role: 'athlete' };
    if (sport) query.sport = sport;
    if (grade) query.grade = grade;
    if (position) query.position = position;

    const athletes = await base44.asServiceRole.entities.Athlete.filter(query, '-total_points', 200);
    const candidates = athletes.filter(a => !a.is_flagged && (a.total_points || 0) > 0);
    if (candidates.length === 0) return Response.json({ rows: [] });

    // Live age per candidate via their User record.
    const emails = [...new Set(candidates.map(a => a.created_by).filter(Boolean))];
    const users = await base44.asServiceRole.entities.User.filter({ email: { $in: emails } });
    const userByEmail = {};
    for (const u of users) userByEmail[u.email] = u;

    // Guardian public-exposure approvals for every non-adult candidate.
    const minorUserIds = candidates
      .map(a => userByEmail[a.created_by])
      .filter(u => u && liveAge(u.date_of_birth) !== null && liveAge(u.date_of_birth) < 18)
      .map(u => u.id);
    let approvedMinorUserIds = new Set();
    if (minorUserIds.length > 0) {
      const links = await base44.asServiceRole.entities.GuardianLink.filter({
        minor_user_id: { $in: minorUserIds },
        status: 'verified',
        public_exposure_approved: true,
      });
      approvedMinorUserIds = new Set(links.map(l => l.minor_user_id));
    }

    const rows = [];
    for (const a of candidates) {
      const u = userByEmail[a.created_by];
      const age = u ? liveAge(u.date_of_birth) : null;
      // Adults pass. Minors AND unknown-age accounts need guardian approval.
      const isAdult = age !== null && age >= 18;
      const approved = u ? approvedMinorUserIds.has(u.id) : false;
      if (!isAdult && !approved) continue;
      // Sanitized public row — nothing sensitive leaves the server.
      rows.push({
        id: a.id,
        display_name: a.display_name,
        avatar_url: a.avatar_url || null,
        sport: a.sport || null,
        position: a.position || null,
        grade: a.grade || null,
        school: a.school || null,
        total_points: a.total_points || 0,
        current_streak_days: a.current_streak_days || 0,
      });
      if (rows.length >= 50) break;
    }

    return Response.json({ rows });
  } catch (error) {
    console.error('leaderboard error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});