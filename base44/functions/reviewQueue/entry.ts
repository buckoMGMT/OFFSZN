// /review admin queue backend — ALL reads and writes for the moderation page.
// Server-side access control: ADMIN_EMAILS env (comma-separated) when set,
// otherwise platform admin role. A hidden nav link is not access control.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  const start = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── SERVER-SIDE ADMIN GATE — every action passes through this ──
    const adminEmails = (Deno.env.get('ADMIN_EMAILS') || '')
      .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = adminEmails.length
      ? adminEmails.includes((user.email || '').toLowerCase())
      : user.role === 'admin';
    if (!isAdmin) {
      console.log(JSON.stringify({ fn: 'reviewQueue', caller: user.id, outcome: 'forbidden', ms: Date.now() - start }));
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action;
    const svc = base44.asServiceRole;
    const now = new Date().toISOString();

    // ─────────────────────────────────────────── LOAD (all four tabs at once)
    if (action === 'load') {
      const [posts, videos, fraudAll, coachOpen, flagged, feedback] = await Promise.all([
        svc.entities.SocialPost.filter({ status: 'pending' }, 'created_date', 100),
        svc.entities.UserVideoSubmission.filter({ status: 'pending' }, 'created_date', 100),
        svc.entities.FraudEvent.filter({ event_type: 'user_report' }, 'created_date', 500),
        svc.entities.CoachReport.filter({ status: { $in: ['pending', 'under_review'] } }, 'created_date', 100),
        svc.entities.Athlete.filter({ is_flagged: true }, 'flagged_at', 100),
        svc.entities.Feedback.list('created_date', 100),
      ]);

      // Minor map: athlete.created_by_id → User.date_of_birth
      let dobByUserId = {};
      try {
        const users = await svc.entities.User.list('-created_date', 300);
        users.forEach((u) => { if (u.date_of_birth) dobByUserId[u.id] = u.date_of_birth; });
      } catch { /* minor badges degrade gracefully */ }
      const isMinor = (athlete) => {
        const dob = athlete && dobByUserId[athlete.created_by_id];
        if (!dob) return false;
        return Math.floor((Date.now() - new Date(dob).getTime()) / 3.15576e10) < 18;
      };

      // Athlete lookup for authors + reporters
      const athleteIds = new Set();
      posts.forEach((p) => athleteIds.add(p.athlete_id));
      videos.forEach((v) => athleteIds.add(v.athlete_id));
      fraudAll.forEach((f) => { athleteIds.add(f.athlete_id); if (f.evidence?.reporter_athlete_id) athleteIds.add(f.evidence.reporter_athlete_id); });
      coachOpen.forEach((c) => { athleteIds.add(c.coach_athlete_id); athleteIds.add(c.reporter_athlete_id); });
      let athleteById = {};
      try {
        const list = await svc.entities.Athlete.filter({ id: { $in: [...athleteIds] } }, '-created_date', 500);
        list.forEach((a) => { athleteById[a.id] = a; });
      } catch { /* labels degrade to ids */ }
      const nameOf = (id) => athleteById[id]?.display_name || 'Unknown';

      const media = [
        ...posts.map((p) => ({
          kind: 'post', id: p.id, author_id: p.athlete_id, author_name: p.athlete_name || nameOf(p.athlete_id),
          author_avatar: p.athlete_avatar, is_minor: isMinor(athleteById[p.athlete_id]),
          text: p.content, media_url: p.image_url, created_date: p.created_date,
        })),
        ...videos.map((v) => ({
          kind: 'video', id: v.id, author_id: v.athlete_id, author_name: nameOf(v.athlete_id),
          author_avatar: athleteById[v.athlete_id]?.avatar_url, is_minor: isMinor(athleteById[v.athlete_id]),
          text: v.title, media_url: v.thumbnail_url, created_date: v.created_date,
        })),
      ].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

      // Prior report count per reported athlete (all-time, both report kinds)
      const priorCount = {};
      fraudAll.forEach((f) => { priorCount[f.athlete_id] = (priorCount[f.athlete_id] || 0) + 1; });
      coachOpen.forEach((c) => { priorCount[c.coach_athlete_id] = (priorCount[c.coach_athlete_id] || 0) + 1; });

      const openFraud = fraudAll.filter((f) => !f.reviewed_by_human);
      const reports = [
        ...openFraud.map((f) => ({
          kind: 'fraud', id: f.id, severity: f.severity, reason: f.evidence?.reason || f.event_type,
          note: f.evidence?.note || '', reporter_name: nameOf(f.evidence?.reporter_athlete_id),
          target_type: f.evidence?.target_type || 'account', target_id: f.evidence?.target_id || f.athlete_id,
          target_athlete_id: f.athlete_id, target_name: nameOf(f.athlete_id),
          prior_count: priorCount[f.athlete_id] || 1, created_date: f.created_date,
        })),
        ...coachOpen.map((c) => ({
          kind: 'coach', id: c.id, severity: c.reason === 'minor_safety' ? 'critical' : 'medium',
          reason: c.reason, note: c.details || '', reporter_name: nameOf(c.reporter_athlete_id),
          target_type: 'coach', target_id: c.coach_athlete_id,
          target_athlete_id: c.coach_athlete_id, target_name: c.coach_name || nameOf(c.coach_athlete_id),
          prior_count: priorCount[c.coach_athlete_id] || 1, created_date: c.created_date,
        })),
      ].sort((a, b) => {
        // Critical pins to top, then oldest-first
        const crit = (x) => (x.severity === 'critical' ? 0 : 1);
        return crit(a) - crit(b) || new Date(a.created_date) - new Date(b.created_date);
      });

      console.log(JSON.stringify({ fn: 'reviewQueue', caller: user.id, outcome: 'load', ms: Date.now() - start }));
      return Response.json({
        media, reports,
        flagged: flagged.map((a) => ({
          id: a.id, display_name: a.display_name, avatar_url: a.avatar_url,
          flagged_reason: a.flagged_reason, flagged_at: a.flagged_at, throttle_until: a.throttle_until,
        })),
        feedback: feedback.map((f) => ({ id: f.id, category: f.category, message: f.message, page: f.page, status: f.status, created_date: f.created_date })),
      });
    }

    // ─────────────────────────────────────────── MEDIA ACTIONS
    if (action === 'approveMedia' || action === 'rejectMedia') {
      const { kind, id, reason } = body;
      const entity = kind === 'video' ? svc.entities.UserVideoSubmission : svc.entities.SocialPost;
      const rec = await entity.get(id);
      const approve = action === 'approveMedia';
      const cleanReason = String(reason || 'community guidelines').slice(0, 200);
      await entity.update(id, {
        status: approve ? 'approved' : 'rejected',
        moderation_notes: approve ? `approved by ${user.email} at ${now}` : `rejected (${cleanReason}) by ${user.email} at ${now}`,
      });
      if (!approve && rec?.athlete_id) {
        // Author gets the reason CATEGORY only — never reviewer identity or detail.
        await svc.entities.Notification.create({
          recipient_athlete_id: rec.athlete_id, type: 'moderation',
          title: 'Post not approved',
          body: `Your ${kind === 'video' ? 'video' : 'post'} wasn't approved. Reason: ${cleanReason}.`,
        });
      }
      console.log(JSON.stringify({ fn: 'reviewQueue', caller: user.id, outcome: action, ms: Date.now() - start }));
      return Response.json({ ok: true });
    }

    // ─────────────────────────────────────────── REPORT ACTIONS
    if (action === 'reportAction') {
      const { kind, id, decision } = body; // dismiss | remove_content | flag_account | escalate
      if (!['dismiss', 'remove_content', 'flag_account', 'escalate'].includes(decision)) {
        return Response.json({ error: 'Bad decision' }, { status: 400 });
      }
      if (kind === 'fraud') {
        const ev = await svc.entities.FraudEvent.get(id);
        if (decision === 'remove_content' && ev?.evidence?.target_id) {
          const tt = ev.evidence.target_type;
          if (tt === 'post' || tt === 'comment') await svc.entities.SocialPost.update(ev.evidence.target_id, { status: 'rejected' });
          if (tt === 'video') await svc.entities.UserVideoSubmission.update(ev.evidence.target_id, { status: 'rejected' });
        }
        if (decision === 'flag_account' && ev?.athlete_id) {
          await svc.entities.Athlete.update(ev.athlete_id, {
            is_flagged: true, flagged_reason: `report: ${ev.evidence?.reason || 'user_report'}`, flagged_at: now,
          });
        }
        const actionMap = { dismiss: 'dismissed', remove_content: 'content_removed', flag_account: 'flagged', escalate: 'escalated' };
        await svc.entities.FraudEvent.update(id, {
          reviewed_by_human: true, reviewed_by: user.email, reviewed_at: now, action_taken: actionMap[decision],
        });
      } else {
        const rep = await svc.entities.CoachReport.get(id);
        if (decision === 'flag_account' && rep?.coach_athlete_id) {
          await svc.entities.Athlete.update(rep.coach_athlete_id, {
            is_flagged: true, flagged_reason: `coach report: ${rep.reason}`, flagged_at: now,
          });
        }
        await svc.entities.CoachReport.update(id, {
          status: decision === 'escalate' ? 'under_review' : 'resolved',
          reviewed_by: user.email, reviewed_at: now,
        });
      }
      console.log(JSON.stringify({ fn: 'reviewQueue', caller: user.id, outcome: `report_${decision}`, ms: Date.now() - start }));
      return Response.json({ ok: true });
    }

    // ─────────────────────────────────────────── FLAGGED ACCOUNTS
    if (action === 'unflag') {
      await svc.entities.Athlete.update(body.athleteId, {
        is_flagged: false, flagged_reason: '', throttle_until: null,
      });
      console.log(JSON.stringify({ fn: 'reviewQueue', caller: user.id, outcome: 'unflag', ms: Date.now() - start }));
      return Response.json({ ok: true });
    }

    // ─────────────────────────────────────────── FEEDBACK
    if (action === 'feedbackStatus') {
      if (!['new', 'reviewed', 'done'].includes(body.status)) return Response.json({ error: 'Bad status' }, { status: 400 });
      await svc.entities.Feedback.update(body.id, { status: body.status });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error(JSON.stringify({ fn: 'reviewQueue', outcome: 'error', error: error.message, ms: Date.now() - start }));
    return Response.json({ error: error.message }, { status: 500 });
  }
});