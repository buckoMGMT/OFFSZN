import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { coachAthleteId, returnUrl } = await req.json();
    if (!coachAthleteId || !returnUrl) return Response.json({ error: 'Missing coachAthleteId or returnUrl' }, { status: 400 });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    const myAthletes = await base44.entities.Athlete.list('-created_date', 1);
    const me = myAthletes[0];
    if (!me) return Response.json({ error: 'No athlete profile found' }, { status: 404 });

    const coach = await base44.asServiceRole.entities.Athlete.get(coachAthleteId);
    if (!coach) return Response.json({ error: 'Coach not found' }, { status: 404 });
    if (coach.stripe_onboarding_status !== 'complete' || !coach.stripe_account_id) {
      return Response.json({ error: 'This coach has not finished setting up payouts yet.' }, { status: 400 });
    }
    if (coach.identity_status !== 'verified') {
      return Response.json({ error: 'This coach has not completed identity verification yet.' }, { status: 400 });
    }
    const price = coach.coach_sub_price_usd;
    if (!price || price <= 0) return Response.json({ error: 'This coach has not set a subscription price yet.' }, { status: 400 });

    // §0 — minors need a verified guardian BEFORE any coach purchase.
    // Live age from DOB, fail-safe: missing/bad DOB = treated as minor.
    const dob = user.date_of_birth ? new Date(user.date_of_birth) : null;
    let age = null;
    if (dob && !Number.isNaN(dob.getTime())) {
      const now = new Date();
      age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    }
    if (age === null || age < 18) {
      const links = await base44.asServiceRole.entities.GuardianLink.filter({ minor_user_id: user.id, status: 'verified' });
      if (!links[0]) {
        return Response.json({ error: 'A verified parent or guardian must be linked to your account before subscribing to a coach.', reason: 'needs_guardian' }, { status: 403 });
      }
    }

    // Empty-library block (server-side): a coach with < 3 published drills
    // cannot be subscribed to — matches the discoverability gate.
    const publishedDrills = await base44.asServiceRole.entities.UserVideoSubmission.filter(
      { athlete_id: coach.id, status: 'approved' }, '-created_date', 3,
    );
    if (publishedDrills.length < 3) {
      return Response.json({ error: 'This coach is still building their drill library. Check back soon.' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${coach.display_name} — 1-on-1 Coaching Service`,
            description: 'Personal coaching service: direct messaging and personalized feedback from your coach',
          },
          unit_amount: Math.round(price * 100),
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      subscription_data: {
        application_fee_percent: 20,
        transfer_data: { destination: coach.stripe_account_id },
        metadata: {
          subscriber_athlete_id: me.id,
          coach_athlete_id: coach.id,
        },
      },
      customer_email: user.email,
      success_url: `${new URL(returnUrl).origin}/coach/${coach.id}/subscribed?price=${price}&coach_name=${encodeURIComponent(coach.display_name)}&sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}coach_sub=cancel`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        subscriber_athlete_id: me.id,
        coach_athlete_id: coach.id,
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('subscribeToCoach error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});