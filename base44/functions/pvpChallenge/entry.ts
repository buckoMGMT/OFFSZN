// pvpChallenge — server-side offer → accept flow for 1v1 challenges.
// PlayerChallenge writes are RLS-blocked for clients. Lifecycle:
//   create  → status 'pending', NO baselines yet, offer expires 24h after creation
//   accept  → opponent only; baselines + window snapshotted HERE; status 'active'
//   decline → opponent only; status 'declined'; challenger notified kindly
//   resolve → participant; lazily expires stale pendings, freezes final scores
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const DURATIONS = [3, 7, 14];
const OFFER_TTL_MS = 24 * 3600000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const { action, opponentAthleteId, durationDays, challengeId } = await req.json();
    const svc = base44.asServiceRole.entities;

    const mine = await svc.Athlete.filter({ created_by: user.email }, '-created_date', 1);
    const me = mine[0];
    if (!me) return Response.json({ error: 'no_athlete_profile' }, { status: 404 });

    const notify = (recipientAthleteId, title, body) =>
      svc.Notification.create({
        recipient_athlete_id: recipientAthleteId,
        type: 'pvp_challenge',
        title,
        body,
        actor_name: me.display_name,
        actor_avatar: me.avatar_url || undefined,
      }).catch((e) => console.error('pvp notify failed:', e.message));

    const expireIfStale = async (ch) => {
      if (ch.status !== 'pending') return ch;
      if (Date.now() - new Date(ch.created_date).getTime() < OFFER_TTL_MS) return ch;
      const updated = await svc.PlayerChallenge.update(ch.id, { status: 'expired' });
      await notify(ch.challenger_athlete_id, 'Challenge expired',
        `${ch.opponent_name || 'They'} didn't respond in time. No harm — throw it again when they're around.`);
      return updated;
    };

    if (action === 'create') {
      if (!opponentAthleteId || !DURATIONS.includes(durationDays)) {
        return Response.json({ error: 'invalid_request' }, { status: 400 });
      }
      if (!(me.friends || []).includes(opponentAthleteId)) {
        return Response.json({ error: 'not_a_friend', message: 'You can only challenge athletes on your friends list.' }, { status: 403 });
      }
      const opponent = await svc.Athlete.get(opponentAthleteId);
      if (!opponent) return Response.json({ error: 'opponent_not_found' }, { status: 404 });

      const [a, b] = await Promise.all([
        svc.PlayerChallenge.filter({ challenger_athlete_id: me.id, opponent_athlete_id: opponent.id }),
        svc.PlayerChallenge.filter({ challenger_athlete_id: opponent.id, opponent_athlete_id: me.id }),
      ]);
      const open = [...a, ...b].filter(c => c.status === 'active' || c.status === 'pending');
      // Lazily expire before blocking on a stale offer
      let blocked = false;
      for (const c of open) {
        const after = await expireIfStale(c);
        if (after.status === 'active' || after.status === 'pending') blocked = true;
      }
      if (blocked) return Response.json({ error: 'active_exists' }, { status: 409 });

      const challenge = await svc.PlayerChallenge.create({
        challenger_athlete_id: me.id,
        challenger_name: me.display_name,
        opponent_athlete_id: opponent.id,
        opponent_name: opponent.display_name,
        metric: 'points',
        duration_days: durationDays,
        status: 'pending',
      });
      await notify(opponent.id, `${me.display_name} challenged you`,
        `Most points in ${durationDays} days. Accept it from your Friends sheet — offer's good for 24 hours.`);
      return Response.json({ challenge });
    }

    // Everything below operates on an existing challenge
    if (!challengeId) return Response.json({ error: 'invalid_request' }, { status: 400 });
    let ch = await svc.PlayerChallenge.get(challengeId);
    if (!ch) return Response.json({ error: 'challenge_not_found' }, { status: 404 });
    if (ch.challenger_athlete_id !== me.id && ch.opponent_athlete_id !== me.id) {
      return Response.json({ error: 'not_a_participant' }, { status: 403 });
    }

    if (action === 'accept' || action === 'decline') {
      if (ch.opponent_athlete_id !== me.id) {
        return Response.json({ error: 'only_opponent_can_respond' }, { status: 403 });
      }
      ch = await expireIfStale(ch);
      if (ch.status !== 'pending') return Response.json({ error: 'not_pending', challenge: ch }, { status: 409 });

      if (action === 'decline') {
        const updated = await svc.PlayerChallenge.update(ch.id, { status: 'declined' });
        await notify(ch.challenger_athlete_id, 'Challenge declined',
          `${me.display_name} passed on this one. Bad timing happens — run it back later.`);
        return Response.json({ challenge: updated });
      }

      // ACCEPT — snapshot authoritative baselines and open the window NOW
      const challenger = await svc.Athlete.get(ch.challenger_athlete_id);
      const start = new Date();
      const end = new Date(start.getTime() + ch.duration_days * 86400000);
      const updated = await svc.PlayerChallenge.update(ch.id, {
        status: 'active',
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        challenger_baseline: challenger?.total_points || 0,
        opponent_baseline: me.total_points || 0,
      });
      await notify(ch.challenger_athlete_id, 'Challenge accepted',
        `${me.display_name} is in. ${ch.duration_days} days — most points wins. Clock starts now.`);
      return Response.json({ challenge: updated });
    }

    if (action === 'resolve') {
      ch = await expireIfStale(ch);
      if (ch.status !== 'active') return Response.json({ challenge: ch });
      if (new Date(ch.end_date) > new Date()) return Response.json({ challenge: ch });

      const [challenger, opponent] = await Promise.all([
        svc.Athlete.get(ch.challenger_athlete_id),
        svc.Athlete.get(ch.opponent_athlete_id),
      ]);
      const cScore = Math.max(0, (challenger?.total_points || 0) - (ch.challenger_baseline || 0));
      const oScore = Math.max(0, (opponent?.total_points || 0) - (ch.opponent_baseline || 0));
      const winnerId = cScore === oScore ? null : cScore > oScore ? ch.challenger_athlete_id : ch.opponent_athlete_id;

      const updated = await svc.PlayerChallenge.update(ch.id, {
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