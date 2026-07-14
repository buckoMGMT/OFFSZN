// Trust & Safety intake — every report on every surface routes through here.
// Server-side zod validation, 20/day rate limit, coach routing, minor-safety
// auto-escalation with content auto-hide. Errs toward hiding.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { z } from 'npm:zod@3.24.2';

Deno.serve(async (req) => {
  const start = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const clean = (s) => typeof s === 'string'
      ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim() : s;

    const schema = z.object({
      targetType: z.enum(['post', 'comment', 'video', 'coach', 'athlete']),
      targetId: z.string().min(1),
      reason: z.enum(['inappropriate_sexual', 'harassment', 'violence', 'spam_scam', 'minor_safety', 'under_13', 'other']),
      note: z.string().max(500).optional(),
      commentIndex: z.number().int().min(0).optional(),
    });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || 'Invalid report' }, { status: 400 });
    }
    const { targetType, targetId, reason, commentIndex } = parsed.data;
    const note = clean(parsed.data.note || '');

    const me = (await base44.entities.Athlete.list('-created_date', 1))[0];
    if (!me) return Response.json({ error: 'No athlete profile' }, { status: 404 });
    const svc = base44.asServiceRole;

    // ── Rate limit: max 20 reports per user per day (fraud vector otherwise) ──
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const [priorFraud, priorCoach] = await Promise.all([
      svc.entities.FraudEvent.filter({ event_type: 'user_report', 'evidence.reporter_athlete_id': me.id }),
      svc.entities.CoachReport.filter({ reporter_athlete_id: me.id }),
    ]);
    const todayCount = [...priorFraud, ...priorCoach]
      .filter((r) => new Date(r.created_date) >= dayStart).length;
    if (todayCount >= 20) {
      console.log(JSON.stringify({ fn: 'submitReport', caller: me.id, outcome: 'rate_limited', ms: Date.now() - start }));
      return Response.json({ error: 'Daily report limit reached. Try again tomorrow.' }, { status: 429 });
    }

    // ── Coach reports route to CoachReport ──
    if (targetType === 'coach') {
      const coachReasonMap = {
        minor_safety: 'minor_safety', under_13: 'minor_safety',
        inappropriate_sexual: 'inappropriate_behavior', harassment: 'inappropriate_behavior',
        violence: 'inappropriate_behavior', spam_scam: 'scam_or_fraud', other: 'other',
      };
      let coachName = '';
      try { coachName = (await svc.entities.Athlete.get(targetId))?.display_name || ''; } catch { /* keep blank */ }
      await svc.entities.CoachReport.create({
        reporter_athlete_id: me.id,
        coach_athlete_id: targetId,
        coach_name: coachName,
        reason: coachReasonMap[reason] || 'other',
        details: [`original_reason: ${reason}`, note].filter(Boolean).join(' — '),
        status: 'pending',
      });
      console.log(JSON.stringify({ fn: 'submitReport', caller: me.id, outcome: 'coach_report', ms: Date.now() - start }));
      return Response.json({ ok: true });
    }

    // ── Everything else → FraudEvent ──
    // Resolve the content author (the reported athlete).
    let authorId = targetId;
    let post = null, video = null;
    if (targetType === 'post' || targetType === 'comment') {
      try { post = await svc.entities.SocialPost.get(targetId); authorId = post?.athlete_id || targetId; } catch { /* keep targetId */ }
    } else if (targetType === 'video') {
      try { video = await svc.entities.UserVideoSubmission.get(targetId); authorId = video?.athlete_id || targetId; } catch { /* keep targetId */ }
    }

    // Severity: minor-safety reasons are always critical. Sexual-content reports
    // on content by a known minor also escalate. Err toward critical.
    let severity = 'medium';
    if (reason === 'minor_safety' || reason === 'under_13') severity = 'critical';
    else if (reason === 'inappropriate_sexual') {
      try {
        const author = await svc.entities.Athlete.get(authorId);
        const users = await svc.entities.User.filter({ id: author?.created_by_id });
        const dob = users?.[0]?.date_of_birth;
        if (dob) {
          const age = Math.floor((Date.now() - new Date(dob).getTime()) / 3.15576e10);
          if (age < 18) severity = 'critical';
        }
      } catch { /* unknown age — stays medium */ }
    }

    // Critical → auto-hide the reported content pending review.
    let hidden = false;
    if (severity === 'critical') {
      try {
        if (post && targetType === 'post') { await svc.entities.SocialPost.update(post.id, { status: 'pending' }); hidden = true; }
        if (video) { await svc.entities.UserVideoSubmission.update(video.id, { status: 'pending' }); hidden = true; }
      } catch { /* hide is best-effort; the report itself always lands */ }
    }

    await svc.entities.FraudEvent.create({
      athlete_id: authorId,
      event_type: 'user_report',
      severity,
      evidence: {
        target_type: targetType,
        target_id: targetId,
        reason,
        note,
        reporter_athlete_id: me.id,
        ...(commentIndex != null ? { comment_index: commentIndex } : {}),
        ...(hidden ? { auto_hidden: true } : {}),
      },
      action_taken: hidden ? 'flagged' : 'logged',
      reviewed_by_human: false,
    });

    console.log(JSON.stringify({ fn: 'submitReport', caller: me.id, outcome: severity === 'critical' ? 'critical_report' : 'report', ms: Date.now() - start }));
    return Response.json({ ok: true });
  } catch (error) {
    console.error(JSON.stringify({ fn: 'submitReport', outcome: 'error', error: error.message, ms: Date.now() - start }));
    return Response.json({ error: error.message }, { status: 500 });
  }
});