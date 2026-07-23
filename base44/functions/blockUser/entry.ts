// blockUser — block / unblock / list, server-enforced.
// Blocking severs the friendship both ways and is checked by dmGuard on every
// thread open and send. Client-side filtering (feed, search) reads `list`.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { z } from 'npm:zod@3.24.2';

const bodySchema = z.object({
  action: z.enum(['block', 'unblock', 'list']),
  targetAthleteId: z.string().min(1).optional(),
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });
    const { action, targetAthleteId } = parsed.data;

    const mine = await base44.asServiceRole.entities.Athlete.filter({ created_by_id: user.id });
    const me = mine[0];
    if (!me) return Response.json({ error: 'No athlete profile' }, { status: 403 });

    if (action === 'list') {
      const blocks = await base44.asServiceRole.entities.Block.filter({ blocker_athlete_id: me.id });
      return Response.json({ blocked_ids: blocks.map((b) => b.blocked_athlete_id) });
    }

    if (!targetAthleteId || targetAthleteId === me.id) {
      return Response.json({ error: 'Invalid target' }, { status: 400 });
    }

    if (action === 'block') {
      const existing = await base44.asServiceRole.entities.Block.filter({
        blocker_athlete_id: me.id, blocked_athlete_id: targetAthleteId,
      });
      if (!existing[0]) {
        await base44.asServiceRole.entities.Block.create({
          blocker_athlete_id: me.id, blocked_athlete_id: targetAthleteId, created_by_id: user.id,
        });
      }
      // Sever the friendship both ways — a blocked user must not remain a follower.
      const other = await base44.asServiceRole.entities.Athlete.get(targetAthleteId).catch(() => null);
      if ((me.friends || []).includes(targetAthleteId)) {
        await base44.asServiceRole.entities.Athlete.update(me.id, {
          friends: (me.friends || []).filter((id) => id !== targetAthleteId),
        });
      }
      if (other && (other.friends || []).includes(me.id)) {
        await base44.asServiceRole.entities.Athlete.update(other.id, {
          friends: (other.friends || []).filter((id) => id !== me.id),
        });
      }
      return Response.json({ ok: true });
    }

    // unblock
    const rows = await base44.asServiceRole.entities.Block.filter({
      blocker_athlete_id: me.id, blocked_athlete_id: targetAthleteId,
    });
    for (const row of rows) {
      await base44.asServiceRole.entities.Block.delete(row.id);
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[blockUser]', err);
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
});
