// Real, non-fabricated social-proof counts for the Field header.
// weeklyActive = distinct athletes with a DailyLog in the last 7 days.
// Returns 0 honestly when the platform is new — the UI hides the line below a
// trust threshold rather than showing a tiny/fake number.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const weekStart = new Date(Date.now() - 7 * 86400000).toISOString();
    // Paginate DailyLogs from the last 7 days; count distinct athlete_ids.
    const active = new Set();
    let page = 0;
    const pageSize = 200;
    while (page < 25) { // hard cap: 5000 logs/week is plenty for a real count
      const logs = await base44.asServiceRole.entities.DailyLog.filter(
        { created_date: { $gte: weekStart } }, '-created_date', pageSize, page * pageSize,
      );
      for (const l of logs) if (l.athlete_id) active.add(l.athlete_id);
      if (logs.length < pageSize) break;
      page++;
    }

    return Response.json({ weeklyActive: active.size });
  } catch (error) {
    console.error('growthStats error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});