// rateCoach — subscriber ratings of coaches, all rules enforced HERE.
// Eligibility: a CoachSubscription (past or present, any status) to this coach
// that is at least 7 DAYS OLD (blocks day-one review bombing in both directions).
// One rating per rater per coach — re-rating updates in place (editable).
// Review text (≤300 chars) starts 'pending' and stays hidden until moderated;
// stars count immediately. Coaches can never write to their own ratings.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const SEVEN_DAYS_MS = 7 * 86400000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const { action, coachAthleteId, stars, reviewText } = await req.json();
    if (!coachAthleteId) return Response.json({ error: 'invalid_request' }, { status: 400 });
    const svc = base44.asServiceRole.entities;

    if (action === 'get') {
      const ratings = await svc.CoachRating.filter({ coach_athlete_id: coachAthleteId }, '-created_date', 500);
      const count = ratings.length;
      const average = count ? Math.round((ratings.reduce((s, r) => s + (r.stars || 0), 0) / count) * 10) / 10 : null;

      // My own rating (if logged-in user has an athlete profile)
      let myRating = null;
      let eligible = false;
      const mine = await svc.Athlete.filter({ created_by: user.email }, '-created_date', 1);
      const me = mine[0];
      if (me) {
        myRating = ratings.find(r => r.rater_athlete_id === me.id) || null;
        const subs = await svc.CoachSubscription.filter({ subscriber_athlete_id: me.id, coach_athlete_id: coachAthleteId });
        eligible = subs.some(s => Date.now() - new Date(s.created_date).getTime() >= SEVEN_DAYS_MS);
      }

      const reviews = ratings
        .filter(r => r.review_text && r.review_status === 'approved')
        .slice(0, 20)
        .map(r => ({ rater_name: r.rater_name || 'Athlete', stars: r.stars, review_text: r.review_text }));

      return Response.json({
        average,
        count,
        eligible,
        my_rating: myRating ? { stars: myRating.stars, review_text: myRating.review_text || '' } : null,
        reviews,
      });
    }

    if (action === 'rate') {
      const s = Number(stars);
      if (!Number.isInteger(s) || s < 1 || s > 5) return Response.json({ error: 'invalid_stars' }, { status: 400 });
      const text = String(reviewText || '').trim().slice(0, 300);

      const mine = await svc.Athlete.filter({ created_by: user.email }, '-created_date', 1);
      const me = mine[0];
      if (!me) return Response.json({ error: 'no_athlete_profile' }, { status: 404 });
      if (me.id === coachAthleteId) return Response.json({ error: 'self_rating' }, { status: 403 });

      const subs = await svc.CoachSubscription.filter({ subscriber_athlete_id: me.id, coach_athlete_id: coachAthleteId });
      if (subs.length === 0) {
        return Response.json({ error: 'not_subscriber', message: 'Only athletes who have subscribed to this coach can rate them.' }, { status: 403 });
      }
      const oldEnough = subs.some(sub => Date.now() - new Date(sub.created_date).getTime() >= SEVEN_DAYS_MS);
      if (!oldEnough) {
        return Response.json({ error: 'too_soon', message: 'Ratings open 7 days after you subscribe — give the coaching a real shot first.' }, { status: 403 });
      }

      const existing = await svc.CoachRating.filter({ coach_athlete_id: coachAthleteId, rater_athlete_id: me.id });
      let rating;
      if (existing[0]) {
        const textChanged = text !== (existing[0].review_text || '');
        rating = await svc.CoachRating.update(existing[0].id, {
          stars: s,
          rater_name: me.display_name,
          review_text: text || undefined,
          // Edited text re-enters moderation; unchanged text keeps its status
          review_status: text ? (textChanged ? 'pending' : existing[0].review_status) : 'pending',
        });
      } else {
        rating = await svc.CoachRating.create({
          coach_athlete_id: coachAthleteId,
          rater_athlete_id: me.id,
          rater_name: me.display_name,
          stars: s,
          review_text: text || undefined,
          review_status: 'pending',
        });
      }
      return Response.json({ ok: true, stars: rating.stars });
    }

    return Response.json({ error: 'unknown_action' }, { status: 400 });
  } catch (error) {
    console.error('rateCoach error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});