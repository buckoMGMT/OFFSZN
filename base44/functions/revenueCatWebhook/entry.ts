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
// AUTH — why HMAC and not the Authorization header:
// RevenueCat offers two ways to authenticate a webhook: a static value in the
// `Authorization` header, or HMAC request signing. We MUST use HMAC. Base44's
// function gateway owns the `Authorization` header and rejects anything that
// isn't `Bearer <token>` before our code ever runs (observed: HTTP 400
// {"error":"Invalid authorization header format. Expected \"Bearer <token>\""}).
// HMAC uses the custom header `X-RevenueCat-Webhook-Signature`, which the
// gateway passes straight through.
//
// Signature format (RevenueCat):
//   X-RevenueCat-Webhook-Signature: t=<unix_seconds>,v1=<hex_hmac_sha256>
// where the HMAC is computed over the exact string `<t>.<raw_request_body>`
// using the signing secret RevenueCat generates when you enable HMAC signing.
//
// Setup:
//   1. RevenueCat -> Integrations -> Webhooks -> this webhook:
//      leave the "Authorization header value" field EMPTY, enable
//      "HMAC signature", and copy the generated signing secret.
//   2. Base44 -> Secrets: REVENUECAT_WEBHOOK_SECRET = that signing secret.
//   3. Optional: REVENUECAT_ENTITLEMENT_ID if the dashboard entitlement
//      identifier isn't literally "premium" (must match the client's
//      ENTITLEMENT_ID in src/lib/purchases.js).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const ENTITLEMENT_ID = Deno.env.get('REVENUECAT_ENTITLEMENT_ID') || 'premium';

// How far out of date a signed timestamp may be before we treat the request
// as a replay. Generous enough to survive RevenueCat's retry backoff.
const MAX_SIGNATURE_AGE_SECONDS = Number(
  Deno.env.get('REVENUECAT_MAX_SIGNATURE_AGE_SECONDS') || '900',
);

// UNCANCELLATION: the user turned auto-renew back on before the period
// lapsed — still premium the whole time, just re-confirming the write.
const GRANT_EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION']);
// CANCELLATION fires the moment auto-renew is turned off (access technically
// continues until period end) and EXPIRATION fires when access actually
// lapses. Both downgrade here per product spec — a canceled Pass reads as
// free immediately rather than waiting out the remaining period.
const REVOKE_EVENTS = new Set(['EXPIRATION', 'CANCELLATION']);

// Constant-time hex compare so a wrong signature can't be brute-forced via
// response-time timing.
function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Parses `t=<ts>,v1=<hex>` (order-independent, tolerant of spaces).
function parseSignatureHeader(header: string) {
  const parts: Record<string, string> = {};
  for (const chunk of header.split(',')) {
    const idx = chunk.indexOf('=');
    if (idx === -1) continue;
    parts[chunk.slice(0, idx).trim()] = chunk.slice(idx + 1).trim();
  }
  return { timestamp: parts.t, signature: parts.v1 };
}

async function verifySignature(rawBody: string, header: string, secret: string) {
  const { timestamp, signature } = parseSignatureHeader(header);
  if (!timestamp || !signature) return { ok: false, reason: 'malformed signature header' };

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_SECONDS) {
    return { ok: false, reason: 'signature timestamp out of tolerance' };
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const expected = toHex(mac);
  if (!timingSafeEqualHex(expected, signature.toLowerCase())) {
    return { ok: false, reason: 'signature mismatch' };
  }
  return { ok: true, reason: '' };
}

Deno.serve(async (req) => {
  try {
    const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    if (!expectedSecret) {
      console.error('revenueCatWebhook error: REVENUECAT_WEBHOOK_SECRET not configured');
      return Response.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    // Read the body as TEXT, not JSON — the HMAC is over the exact bytes
    // RevenueCat sent, and re-serializing parsed JSON would not reproduce them.
    const rawBody = await req.text();

    const sigHeader = req.headers.get('x-revenuecat-webhook-signature') || '';
    if (!sigHeader) {
      console.error('revenueCatWebhook: missing X-RevenueCat-Webhook-Signature header');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const verdict = await verifySignature(rawBody, sigHeader, expectedSecret);
    if (!verdict.ok) {
      console.error(`revenueCatWebhook: rejected — ${verdict.reason}`);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any = null;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: 'Malformed payload' }, { status: 400 });
    }

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
    // Other event types (TEST, BILLING_ISSUE, PRODUCT_CHANGE, TRANSFER,
    // SUBSCRIPTION_PAUSED, NON_RENEWING_PURCHASE, ...) are acknowledged but
    // intentionally don't change subscription_tier.

    return Response.json({ received: true });
  } catch (error) {
    console.error('revenueCatWebhook error:', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
});