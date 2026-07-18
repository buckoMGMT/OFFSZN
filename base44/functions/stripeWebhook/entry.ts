import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET'),
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { subscriber_athlete_id, coach_athlete_id, pass, athlete_id, plan } = session.metadata || {};
      // ── ALL-SZN Pass: grant premium tier instantly ──
      if (pass === 'all_szn' && athlete_id) {
        await base44.asServiceRole.entities.Athlete.update(athlete_id, {
          subscription_tier: 'premium',
          pass_subscription_id: session.subscription,
        });
      }
      if (subscriber_athlete_id && coach_athlete_id) {
        const isTrial = plan === 'trial';
        const subFields = isTrial
          ? { is_paid: true, status: 'active', plan: 'trial', trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }
          : { is_paid: true, status: 'active', plan: 'monthly', stripe_subscription_id: session.subscription };
        const existing = await base44.asServiceRole.entities.CoachSubscription.filter({
          subscriber_athlete_id, coach_athlete_id,
        });
        if (existing[0]) {
          await base44.asServiceRole.entities.CoachSubscription.update(existing[0].id, subFields);
        } else {
          await base44.asServiceRole.entities.CoachSubscription.create({
            subscriber_athlete_id, coach_athlete_id, ...subFields,
          });
        }
        const subscriber = await base44.asServiceRole.entities.Athlete.get(subscriber_athlete_id);
        await base44.asServiceRole.entities.Notification.create({
          recipient_athlete_id: coach_athlete_id,
          type: 'new_subscriber',
          title: isTrial ? 'New 7-Day Pass' : 'New Paid Subscriber',
          body: `${subscriber?.display_name || 'An athlete'} ${isTrial ? 'started a 7-day pass to your coaching service.' : 'joined your coaching subscription.'}`,
          actor_name: subscriber?.display_name,
          actor_avatar: subscriber?.avatar_url,
        });
      }
    } else if (event.type === 'identity.verification_session.verified') {
      const session = event.data.object;
      const athleteId = session.metadata?.athlete_id;
      if (athleteId) {
        await base44.asServiceRole.entities.Athlete.update(athleteId, {
          identity_status: 'verified', is_coach_verified: true,
        });
      }
    } else if (event.type === 'identity.verification_session.requires_input') {
      // Identity check failed or needs retry — mark failed so the UI shows a retry path.
      const session = event.data.object;
      const athleteId = session.metadata?.athlete_id;
      if (athleteId && session.last_error) {
        await base44.asServiceRole.entities.Athlete.update(athleteId, { identity_status: 'failed' });
      }
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      if (invoice.subscription) {
        const matches = await base44.asServiceRole.entities.CoachSubscription.filter({
          stripe_subscription_id: invoice.subscription,
        });
        if (matches[0]) {
          await base44.asServiceRole.entities.CoachSubscription.update(matches[0].id, { status: 'past_due' });
        }
      }
    } else if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      if (invoice.subscription) {
        const matches = await base44.asServiceRole.entities.CoachSubscription.filter({
          stripe_subscription_id: invoice.subscription,
        });
        if (matches[0] && matches[0].status === 'past_due') {
          await base44.asServiceRole.entities.CoachSubscription.update(matches[0].id, { status: 'active' });
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      // ── ALL-SZN Pass canceled: downgrade to free ──
      if (sub.metadata?.pass === 'all_szn' && sub.metadata?.athlete_id) {
        await base44.asServiceRole.entities.Athlete.update(sub.metadata.athlete_id, {
          subscription_tier: 'free', pass_subscription_id: null,
        });
      }
      const matches = await base44.asServiceRole.entities.CoachSubscription.filter({
        stripe_subscription_id: sub.id,
      });
      if (matches[0]) {
        await base44.asServiceRole.entities.CoachSubscription.update(matches[0].id, {
          status: 'canceled', is_paid: false,
        });
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
});