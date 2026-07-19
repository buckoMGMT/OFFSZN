// ALL-SZN Pass checkout — platform premium subscription ($9.99/mo).
// Grants Athlete.subscription_tier='premium' via stripeWebhook on payment.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import Stripe from 'npm:stripe@17';
import { safeReturnUrl } from '../../shared/safeReturnUrl.ts';

const PASS_PRICE_ID = 'price_1TtXmiIPluSFOhP31KPn8tHk'; // ALL-SZN Pass $9.99/mo

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { returnUrl } = await req.json();
    if (!returnUrl) return Response.json({ error: 'Missing returnUrl' }, { status: 400 });

    const myAthletes = await base44.entities.Athlete.list('-created_date', 1);
    const me = myAthletes[0];
    if (!me) return Response.json({ error: 'No athlete profile found' }, { status: 404 });
    if (me.subscription_tier === 'premium') {
      return Response.json({ error: 'You already have the ALL-SZN Pass.' }, { status: 400 });
    }

    // Coerce returnUrl onto the app's own origin — blocks javascript: URIs and off-site redirects.
    const safeUrl = safeReturnUrl(req, returnUrl);
    if (!safeUrl) return Response.json({ error: 'Invalid returnUrl' }, { status: 400 });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const origin = new URL(safeUrl).origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PASS_PRICE_ID, quantity: 1 }],
      customer_email: user.email,
      subscription_data: {
        metadata: { pass: 'all_szn', athlete_id: me.id },
      },
      success_url: `${origin}/subscription/success?sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${safeUrl}${safeUrl.includes('?') ? '&' : '?'}pass=cancel`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        pass: 'all_szn',
        athlete_id: me.id,
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('subscribeToPass error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});