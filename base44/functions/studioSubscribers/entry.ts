// studioSubscribers — coach-only enriched subscriber list for the Studio tab.
// Returns per-subscriber: profile, since date, LIVE minor status (computed from
// User.date_of_birth, never grade), and SLA state (overdue inbound messages).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function ageFromDob(dob) {
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
  const t0 = Date.now();
  let outcome = 'error';
  let callerId = 'anon';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    callerId = user.id;

    const mine = await base44.entities.Athlete.list('-created_date', 1);
    const me = mine[0];
    if (!me || me.role !== 'coach') return Response.json({ error: 'Coach only' }, { status: 403 });

    const subs = await base44.asServiceRole.entities.CoachSubscription.filter({
      coach_athlete_id: me.id, is_paid: true, status: 'active',
    }, '-created_date', 100);

    const slaHours = me.coach_response_sla_hours || 48;
    const results = await Promise.all(subs.map(async (sub) => {
      const athlete = await base44.asServiceRole.entities.Athlete.get(sub.subscriber_athlete_id).catch(() => null);
      if (!athlete) return null;
      const subUser = await base44.asServiceRole.entities.User.get(athlete.created_by_id).catch(() => null);
      const age = ageFromDob(subUser?.date_of_birth);
      const isMinor = age === null || age < 18; // fail-safe: unknown DOB = minor

      const [inbound, outbound] = await Promise.all([
        base44.asServiceRole.entities.Message.filter({ sender_athlete_id: athlete.id, recipient_athlete_id: me.id }, '-created_date', 1),
        base44.asServiceRole.entities.Message.filter({ sender_athlete_id: me.id, recipient_athlete_id: athlete.id }, '-created_date', 1),
      ]);
      const lastIn = inbound[0]?.created_date || null;
      const lastOut = outbound[0]?.created_date || null;
      const awaitingReply = !!lastIn && (!lastOut || new Date(lastOut) < new Date(lastIn));
      const overdue = awaitingReply && (Date.now() - new Date(lastIn).getTime()) > slaHours * 3600 * 1000;

      let guardianVerified = false;
      if (isMinor && subUser) {
        const links = await base44.asServiceRole.entities.GuardianLink.filter({ minor_user_id: subUser.id, status: 'verified' });
        guardianVerified = !!links[0];
      }

      return {
        athlete_id: athlete.id,
        display_name: athlete.display_name,
        avatar_url: athlete.avatar_url || null,
        since: sub.created_date,
        is_minor: isMinor,
        guardian_verified: guardianVerified,
        awaiting_reply: awaitingReply,
        overdue,
        last_inbound_at: lastIn,
      };
    }));

    outcome = 'ok';
    return Response.json({ subscribers: results.filter(Boolean), sla_hours: slaHours });
  } catch (error) {
    console.error(JSON.stringify({ fn: 'studioSubscribers', caller: callerId, outcome: 'error', error: error.message, ms: Date.now() - t0 }));
    return Response.json({ error: error.message }, { status: 500 });
  } finally {
    console.log(JSON.stringify({ fn: 'studioSubscribers', caller: callerId, outcome, ms: Date.now() - t0 }));
  }
});