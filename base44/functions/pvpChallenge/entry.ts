// pvpChallenge — server-side create + resolve for 1v1 challenges.
// PlayerChallenge writes are RLS-blocked for clients, so baselines and final
// scores can't be tampered with. You can only challenge someone on your own
// friends list; scores come from authoritative total_points (economy-guarded).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const DURATIONS = [3, 7, 14];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const { action, opponentAthleteId, durationDays, challengeId } = await req.json();

    const mine = await base44.asServiceRole.entities.Athlete.filter({ created_by: user.email }, '-created_date', 1);
    const me = mine[0];
    if (!me) return Response.json({ error: 'no_athlete_profile' }, { status: 404 });

    if (action === 'create') {
      if (!opponentAthleteId || !DURATIONS.includes(durationDays)) {
        return Response.json({ error: 'invalid_request' }, { status: 400 });
      }
      if (!(me.friends || []).includes(opponentAthleteId)) {
        return Response.json({ error: 'not_a_friend', message: 'You can only challenge athletes on your friends list.' }, { status: 403 });
      }
      const opponent = await base44.asServiceRole.entities.Athlete.get(opponentAthleteId);
      if (!opponent) return Response.json({ error: 'opponent_not_found' }, { status: 404 });

      const [a, b] = await Promise.all([
        base44.asServiceRole.entities.PlayerChallenge.filter({ challenger_athlete_id: me.id, opponent_athlete_id: opponent.id, status: 'active' }),
        base44.asServiceRole.entities.PlayerChallenge.filter({ challenger_athlete_id: opponent.id, opponent_athlete_id: me.id, status: 'active' }),
      ]);
      if (a.length || b.length) return Response.json({ error: 'active_exists' }, { status: 409 });

      const start = new Date();
      const end = new Date(start.getTime() + durationDays * 86400000);
      const challenge = await base44.asServiceRole.entities.PlayerChallenge.create({
        challenger_athlete_id: me.id,
        challenger_name: me.display_name,
        opponent_athlete_id: opponent.id,
        opponent_name: opponent.display_name,
        metric: 'points',
        duration_days: durationDays,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        challenger_baseline: me.total_points || 0,
        opponent_baseline: opponent.total_points || 0,
        status: 'active',
      });
      return Response.json({ challenge });
    }

    if (action === 'resolve') {
      if (!challengeId) return Response.json({ error: 'invalid_request' }, { status: 400 });
      const ch = await base44.asServiceRole.entities.PlayerChallenge.get(challengeId);
      if (!ch) return Response.json({ error: 'challenge_not_found' }, { status: 404 });
      if (ch.challenger_athlete_id !== me.id && ch.opponent_athlete_id !== me.id) {
        return Response.json({ error: 'not_a_participant' }, { status: 403 });
      }
      if (ch.status !== 'active') return Response.json({ challenge: ch });
      if (new Date(ch.end_date) > new Date()) return Response.json({ challenge: ch });

      const [challenger, opponent] = await Promise.all([
        base44.asServiceRole.entities.Athlete.get(ch.challenger_athlete_id),
        base44.asServiceRole.entities.Athlete.get(ch.opponent_athlete_id),
      ]);
      const cScore = Math.max(0, (challenger?.total_points || 0) - (ch.challenger_baseline || 0));
      const oScore = Math.max(0, (opponent?.total_points || 0) - (ch.opponent_baseline || 0));
      const winnerId = cScore === oScore ? null : cScore > oScore ? ch.challenger_athlete_id : ch.opponent_athlete_id;

      const updated = await base44.asServiceRole.entities.PlayerChallenge.update(ch.id, {
        status: 'completed',
        challenger_score: cScore,
        opponent_score: oScore,
        winner_athlete_id: winnerId || undefined,
      });
      return Response.json({ challenge: updated });
    }

    return Response.json({ error: 'unknown_action' }, { status: 400 });
  } catch (error) {
    console.error('pvpChallenge error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});