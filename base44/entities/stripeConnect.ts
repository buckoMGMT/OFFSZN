// base44/functions/stripeConnect.ts
//
// One file = one Base44 function per their convention, but Stripe needs
// several endpoints. Base44 backend functions each get their own HTTP
// endpoint, so in practice split this into separate files once you're
// past prototyping:
//   stripeOnboardCoach.ts, stripePurchaseContent.ts, stripeWebhook.ts,
//   stripeSchoolCheckout.ts
// Kept as one annotated file here so you can see the whole flow before
// splitting it. STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are Secrets
// set in Dashboard -> Secrets, read via Deno.env.get().

import Stripe from "npm:stripe@16";
import { createClientFromRequest } from "@base44/sdk/server";
import { assertCoachInteractionAllowed, assertCoachEligibleForMinorAudience } from "./minorSafetyGuard.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

const DEFAULT_PLATFORM_FEE_BPS = 1000; // 10%
const NEGOTIATED_MIN_FEE_BPS = 500; // 5% floor

function computeApplicationFeeCents(priceCents: number, feeBps = DEFAULT_PLATFORM_FEE_BPS) {
  if (feeBps < NEGOTIATED_MIN_FEE_BPS || feeBps > DEFAULT_PLATFORM_FEE_BPS) {
    throw new Error(`feeBps ${feeBps} outside allowed range`);
  }
  return Math.round((priceCents * feeBps) / 10000);
}

// --- Coach onboarding -------------------------------------------------
export async function onboardCoach(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return new Response("unauthorized", { status: 401 });

  const [athlete] = await base44.entities.Athlete.filter({ user_id: user.id });
  if (!athlete || athlete.role !== "coach") {
    return new Response(JSON.stringify({ error: "must_be_coach_role" }), { status: 403 });
  }

  const account = await stripe.accounts.create({
    type: "express",
    email: user.email,
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    business_type: "individual",
    metadata: { athlete_id: athlete.id },
  });

  await base44.asServiceRole.entities.Athlete.update(athlete.id, {
    coach_stripe_account_id: account.id,
    coach_payout_status: "pending",
  });

  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${Deno.env.get("APP_URL")}/coach/onboarding/refresh`,
    return_url: `${Deno.env.get("APP_URL")}/coach/onboarding/complete`,
    type: "account_onboarding",
  });

  return new Response(JSON.stringify({ onboardingUrl: link.url }), { status: 200 });
}

// --- Purchase content ---------------------------------------------------
export async function purchaseContent(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { contentId, contentType } = await req.json();
  const entity =
    contentType === "stretch_program" ? base44.entities.StretchProgram : base44.entities.UserVideoSubmission;
  const content = await entity.get(contentId);
  if (!content) return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  if (content.price_cents === 0) return new Response(JSON.stringify({ error: "content_is_free" }), { status: 400 });

  const coach = await base44.asServiceRole.entities.Athlete.get(content.coach_id);
  if (!coach || coach.is_flagged || coach.coach_payout_status !== "active") {
    return new Response(JSON.stringify({ error: "coach_not_eligible" }), { status: 409 });
  }

  // Minor-safety gate: required as of the 13+ age floor. Checks (a) the
  // coach is identity-verified before reaching a minor audience, and
  // (b) if the buyer is a minor, a verified guardian is linked. Both
  // throw MinorSafetyError with a machine-readable code on failure.
  try {
    await assertCoachEligibleForMinorAudience(base44, coach.id);
    await assertCoachInteractionAllowed(base44, user.id);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.code ?? "minor_safety_check_failed", message: err.message }), {
      status: 403,
    });
  }

  const applicationFee = computeApplicationFeeCents(content.price_cents);

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: content.price_cents,
      currency: content.currency || "usd",
      application_fee_amount: applicationFee,
      transfer_data: { destination: coach.coach_stripe_account_id },
      metadata: { buyer_user_id: user.id, content_id: contentId, content_type: contentType, coach_id: content.coach_id },
    },
    { idempotencyKey: `purchase_${user.id}_${contentId}` }
  );

  return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }), { status: 200 });
}

// --- Webhook (register this function's URL in the Stripe dashboard) -----
export async function webhook(req: Request): Promise<Response> {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("invalid signature", { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    const athleteId = account.metadata?.athlete_id;
    if (athleteId) {
      const status = account.charges_enabled && account.payouts_enabled ? "active" : "pending";
      await base44.asServiceRole.entities.Athlete.update(athleteId, { coach_payout_status: status });
    }
  }

  return new Response("ok", { status: 200 });
}

// --- School license checkout --------------------------------------------
export async function schoolLicenseCheckout(req: Request): Promise<Response> {
  const { schoolOrgId, priceCents = 50000 } = await req.json();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "The Playbook — School License (Annual)" },
          unit_amount: priceCents,
          recurring: { interval: "year" },
        },
        quantity: 1,
      },
    ],
    metadata: { school_org_id: schoolOrgId },
    success_url: `${Deno.env.get("APP_URL")}/school/billing/success`,
    cancel_url: `${Deno.env.get("APP_URL")}/school/billing/canceled`,
  });

  return new Response(JSON.stringify({ checkoutUrl: session.url }), { status: 200 });
}
