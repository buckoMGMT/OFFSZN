import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { returnUrl } = await req.json();
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    const athletes = await base44.entities.Athlete.list('-created_date', 1);
    const athlete = athletes[0];
    if (!athlete) return Response.json({ error: 'No athlete profile found' }, { status: 404 });

    let accountId = athlete.stripe_account_id;

    if (accountId) {
      // Re-check status — if onboarding finished, mark complete and stop
      const account = await stripe.accounts.retrieve(accountId);
      if (account.charges_enabled && account.details_submitted) {
        if (athlete.stripe_onboarding_status !== 'complete') {
          await base44.entities.Athlete.update(athlete.id, { stripe_onboarding_status: 'complete' });
        }
        return Response.json({ status: 'complete' });
      }
    } else {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        metadata: {
          athlete_id: athlete.id,
          base44_app_id: Deno.env.get('BASE44_APP_ID'),
        },
      });
      accountId = account.id;
      await base44.entities.Athlete.update(athlete.id, {
        stripe_account_id: accountId,
        stripe_onboarding_status: 'pending',
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return Response.json({ status: 'pending', url: link.url });
  } catch (error) {
    console.error('stripeConnectOnboard error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});