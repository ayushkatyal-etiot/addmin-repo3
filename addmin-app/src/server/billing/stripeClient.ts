import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazy singleton so a missing STRIPE_API_KEY only breaks billing, not the whole server boot. */
export function getStripeClient(): Stripe {
  if (!client) {
    const apiKey = process.env.STRIPE_API_KEY;
    if (!apiKey) throw new Error("STRIPE_API_KEY is not set.");
    client = new Stripe(apiKey);
  }
  return client;
}

// "starter" is the only self-serve plan for now (a single INR 100/month
// Price, created via the Stripe API -- see chat history, not
// 04-architecture.md's original Starter/Growth/Enterprise pricing).
// "growth" exists in the Subscription.plan enum but isn't offered here.
// "enterprise" has no Stripe Price at all: sales-assisted only, set by a
// Platform Operator via /platform/organizations/[orgId] (F-20).
export function getStripePriceId(plan: "starter"): string {
  const priceId = process.env.STRIPE_PRICE_ID_STARTER;
  if (!priceId) throw new Error("STRIPE_PRICE_ID_STARTER is not set.");
  return priceId;
}
