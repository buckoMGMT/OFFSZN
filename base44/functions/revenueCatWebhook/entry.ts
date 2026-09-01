// RevenueCat webhook — the native-IAP counterpart to stripeWebhook. Writes
// the SAME field (Athlete.subscription_tier) so both purchase rails funnel
// into one source of truth:
//   INITIAL_PURCHASE / RENEWAL / UNCANCELLATION -> 'premium'
//   EXPIRATION / CANCELLATION                   -> 'free'
//
// Identity: RevenueCat's app_user_id is set client-side to the Base44
// Athlete id (see src/lib/purchases.js loginPurchases()), so event.app_user_id
// here IS the Athlete record's id — no lookup table needed.
//
// Setup (see human steps): in the RevenueCat dashboard, Project Settings ->
// Integrations -> Webhooks, point the URL at this function's deployed URL
// and set an "Authorization header value" — store that exact string in this
// app's REVENUECAT_WEBHOOK_SECRET environment variable. Also set
// REVENUECAT_ENTITLEMENT_ID if the dashboard entitlement identifier isn't
// literally "premium" (must match src/lib/purchases.js's ENTITLEMENT_ID).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const ENTITLEMENT_ID = Deno.env.get('REVENUECAT_ENTITLEMENT_ID') || 'premium';

// UNCANCELLATION: the user turned auto-renew back on before the period
// lapsed — still premium the whole time, just re-confirming the write.
const GRANT_EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION']);
// CANCELLATION fires the moment auto-renew is turned off (access technically
// continues until period end) and EXPIRATION fires when access actually
// lapses. Both downgrade here per product spec — a canceled Pass reads as
// free immediately rather than waiting out the remaining period.
const REVOKE_EVENTS = new Set(['EXPIRATION', 'CANCELLATION']);

// Constant-time string compare so a wrong Authorization header can't be
// brute-forced via response-time timing.
function timingSafeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a || '');
  const bBytes = enc.encode(b || '');
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  try {
    const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    if (!expectedSecret) {
      console.error('revenueCatWebhook error: REVENUECAT_WEBHOOK_SECRET not configured');
      return Response.json({ error: 'Webhook not configured' }, { status: 500 });
    }
    const authHeader = req.headers.get('authorization') || '';
    if (!timingSafeEqual(authHeader, expectedSecret)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const event = body?.event;
    if (!event?.type) {
      return Response.json({ error: 'Malformed payload' }, { status: 400 });
    }

    const athleteId: string | undefined = event.app_user_id;
    if (!athleteId) {
      return Response.json({ received: true, skipped: 'no app_user_id' });
    }

    // entitlement_ids (current payload shape) or the older singular
    // entitlement_id — either way, ignore events for a different
    // entitlement than the All-SZN Pass (harmless today with a single
    // product, but keeps this safe if more entitlements are added later).
    const entitlements: string[] = event.entitlement_ids
      || (event.entitlement_id ? [event.entitlement_id] : []);
    if (entitlements.length && !entitlements.includes(ENTITLEMENT_ID)) {
      return Response.json({ received: true, skipped: 'different entitlement' });
    }

    const base44 = createClientFromRequest(req);

    if (GRANT_EVENTS.has(event.type)) {
      const athlete = await base44.asServiceRole.entities.Athlete.get(athleteId).catch(() => null);
      if (!athlete) {
        // Most likely the client's Purchases.logIn(athleteId) hasn't landed
        // yet relative to this webhook — RevenueCat retries on non-2xx.
        console.error(`revenueCatWebhook: no Athlete found for app_user_id ${athleteId}`);
        return Response.json({ error: 'Athlete not found' }, { status: 404 });
      }
      await base44.asServiceRole.entities.Athlete.update(athleteId, {
        subscription_tier: 'premium',
        pass_subscription_id: event.original_transaction_id || event.transaction_id || athleteId,
      });
    } else if (REVOKE_EVENTS.has(event.type)) {
      const athlete = await base44.asServiceRole.entities.Athlete.get(athleteId).catch(() => null);
      if (athlete) {
        await base44.asServiceRole.entities.Athlete.update(athleteId, {
          subscription_tier: 'free',
          pass_subscription_id: null,
        });
      }
      // No athlete found is fine here — nothing to revoke.
    }
    // Other event types (BILLING_ISSUE, PRODUCT_CHANGE, TRANSFER,
    // SUBSCRIPTION_PAUSED, NON_RENEWING_PURCHASE, TEST, ...) are
    // acknowledged but intentionally don't change subscription_tier.

    return Response.json({ received: true });
  } catch (error) {
    console.error('revenueCatWebhook error:', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
});