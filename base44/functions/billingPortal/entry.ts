import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import Stripe from 'npm:stripe@17';
import { safeReturnUrl } from '../../shared/safeReturnUrl.ts';

// Returns the caller's subscription summary + a Stripe customer-portal URL
// (update card, cancel — access continues through the paid period, receipts).
Deno.serve(async (req) => {
  const started = Date.now();
  let caller = 'anon';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    caller = user.id;

    const { returnUrl } = await req.json();
    // Coerce returnUrl onto the app's own origin — blocks javascript: URIs and off-site redirects.
    const safeUrl = safeReturnUrl(req, returnUrl);
    if (!safeUrl) return Response.json({ error: 'Invalid returnUrl' }, { status: 400 });
    const mine = await base44.entities.Athlete.list('-created_date', 1);
    const me = mine[0];
    if (!me) return Response.json({ error: 'No athlete profile' }, { status: 404 });

    const subs = await base44.asServiceRole.entities.CoachSubscription.filter({ subscriber_athlete_id: me.id, is_paid: true });
    const withStripe = subs.find(s => s.stripe_subscription_id && s.status !== 'canceled');
    if (!withStripe) return Response.json({ subscription: null });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const sub = await stripe.subscriptions.retrieve(withStripe.stripe_subscription_id);
    const coach = await base44.asServiceRole.entities.Athlete.get(withStripe.coach_athlete_id).catch(() => null);

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.customer,
      return_url: safeUrl,
    });

    console.log(JSON.stringify({ fn: 'billingPortal', caller, outcome: 'ok', ms: Date.now() - started }));
    return Response.json({
      url: session.url,
      subscription: {
        coach_name: coach?.display_name || 'Coach',
        price_usd: (sub.items?.data?.[0]?.price?.unit_amount || 0) / 100,
        renews_at: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        status: withStripe.status,
        cancel_at_period_end: !!sub.cancel_at_period_end,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ fn: 'billingPortal', caller, outcome: 'error', ms: Date.now() - started, error: error.message, stack: error.stack }));
    return Response.json({ error: error.message }, { status: 500 });
  }
});