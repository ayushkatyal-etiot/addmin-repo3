import { HttpError } from "wasp/server";
import type { GetSubscription, SubscribeToPlan } from "wasp/server/operations";
import { assertRole } from "../shared/authz";
import { getStripeClient, getStripePriceId } from "./stripeClient";

type SubscriptionView = {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  activated_at: string | null;
};

export const getSubscription: GetSubscription<void, SubscriptionView | null> = async (
  _args,
  context,
) => {
  if (!context.user) throw new HttpError(401);
  if (!context.user.org_id) return null;

  const subscription = await context.entities.Subscription.findUnique({
    where: { org_id: context.user.org_id },
  });
  if (!subscription) return null;

  return {
    plan: subscription.plan,
    status: subscription.status,
    trial_ends_at: subscription.trial_ends_at?.toISOString() ?? null,
    activated_at: subscription.activated_at?.toISOString() ?? null,
  };
};

type SubscribeToPlanInput = { plan: "starter" };

// Creates a Stripe Checkout session and hands the client a redirect URL.
// This does NOT itself change Subscription.status -- per F-19's explicit
// acceptance criteria and the webhook's file header, only the signature-
// verified webhook (src/server/billing/webhook.ts) is authoritative for
// that, since a client-side redirect is not proof of payment.
export const subscribeToPlan: SubscribeToPlan<SubscribeToPlanInput, { checkoutUrl: string }> = async (
  { plan },
  context,
) => {
  const user = await assertRole(
    context.user,
    ["platform_admin", "office_admin"],
    context.entities,
    "subscribeToPlan",
  );
  if (!user.org_id || !user.email) {
    throw new HttpError(400, "You must belong to an organization first.");
  }
  if (plan !== "starter") {
    throw new HttpError(400, "This plan isn't available for self-serve checkout. Contact sales.");
  }

  const subscription = await context.entities.Subscription.findUnique({
    where: { org_id: user.org_id },
  });
  if (!subscription) {
    throw new HttpError(400, "No subscription found for your organization.");
  }

  const stripe = getStripeClient();
  const clientUrl = process.env.WASP_WEB_CLIENT_URL ?? "http://localhost:3002";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: getStripePriceId(plan), quantity: 1 }],
    customer_email: subscription.billing_provider_customer_id ? undefined : user.email,
    customer: subscription.billing_provider_customer_id ?? undefined,
    // org_id (not a Stripe-native field) is how the webhook maps a Stripe
    // event back to a Subscription row without trusting anything client-supplied.
    metadata: { org_id: user.org_id },
    subscription_data: { metadata: { org_id: user.org_id } },
    success_url: `${clientUrl}/app/subscribe?success=true`,
    cancel_url: `${clientUrl}/app/subscribe?canceled=true`,
  });

  if (!session.url) {
    throw new HttpError(500, "Stripe did not return a checkout URL.");
  }

  return { checkoutUrl: session.url };
};
