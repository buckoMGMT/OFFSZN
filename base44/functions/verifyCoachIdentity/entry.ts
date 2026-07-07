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

    // Re-check an existing verification session first
    if (athlete.identity_verification_session_id) {
      const existing = await stripe.identity.verificationSessions.retrieve(athlete.identity_verification_session_id);
      if (existing.status === 'verified') {
        await base44.entities.Athlete.update(athlete.id, { identity_status: 'verified', is_coach_verified: true });
        return Response.json({ status: 'verified' });
      }
      if (existing.status === 'requires_input' && existing.url) {
        return Response.json({ status: 'pending', url: existing.url });
      }
      if (existing.status === 'processing') {
        return Response.json({ status: 'pending' });
      }
    }

    // Create a new verification session: government ID document + matching selfie
    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      options: { document: { require_matching_selfie: true } },
      return_url: returnUrl,
      metadata: {
        athlete_id: athlete.id,
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
      },
    });

    await base44.entities.Athlete.update(athlete.id, {
      identity_verification_session_id: session.id,
      identity_status: 'pending',
    });

    return Response.json({ status: 'pending', url: session.url });
  } catch (error) {
    console.error('verifyCoachIdentity error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});