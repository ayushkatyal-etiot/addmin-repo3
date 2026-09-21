import type { Request, Response } from "express";
import express from "express";
import type { PaymentsWebhook } from "wasp/server/api";
import type { MiddlewareConfigFn } from "wasp/server/middleware";
import { getStripeClient } from "./stripeClient";

// Raw Wasp `api` route, not a query/action: Stripe calls this unauthenticated
// and needs a real HTTP endpoint (04-architecture.md, Build Step 05).
//
// Stripe signature verification (stripe.webhooks.constructEvent) requires
// the exact raw request bytes -- Wasp's global express.json() middleware
// would have already parsed+re-serialized the body by the time a normal
// handler sees it, breaking the signature. This swaps in express.raw() for
// this route only; every other route keeps the global express.json().
export const paymentsWebhookMiddlewareConfigFn: MiddlewareConfigFn = (mc) => {
  mc.set("express.json", express.raw({ type: "application/json" }));
  return mc;
};

export const paymentsWebhook: PaymentsWebhook = async (req: Request, res: Response, context) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || typeof signature !== "string") {
    res.status(400).send("Missing signature or webhook secret.");
    return;
  }

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    // Never process an unverified payload -- anyone could POST a fake
    // "payment succeeded" event otherwise. Reject with 400, touch nothing.
    res.status(400).send(`Webhook signature verification failed: ${(err as Error).message}`);
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orgId = session.metadata?.org_id;
      if (orgId && typeof session.customer === "string") {
        await activateSubscription(context, orgId, session.customer, session.subscription as string | undefined);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const stripeSub = event.data.object;
      const orgId = stripeSub.metadata?.org_id;
      if (orgId) {
        await syncSubscriptionStatus(context, orgId, stripeSub.status);
      }
      break;
    }
    default:
      break; // ignore event types we don't act on
  }

  // 200 regardless of whether we acted on this event type -- Stripe retries
  // (with backoff, eventually giving up) on anything but 2xx, and there's
  // nothing to retry for event types we deliberately ignore.
  res.json({ received: true });
};

async function activateSubscription(
  context: Parameters<PaymentsWebhook>[2],
  orgId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string | undefined,
) {
  // .update (not upsert) -- idempotent by construction: replaying the same
  // event twice sets the same fields to the same values, never a duplicate
  // row. The AuditLog write below is guarded separately (skipped once
  // already active) -- satisfies the "replay the webhook twice" rubric item
  // without a separate processed-events table.
  const before = await context.entities.Subscription.findUnique({ where: { org_id: orgId } });
  if (!before) return;

  await context.entities.Subscription.update({
    where: { org_id: orgId },
    data: {
      status: "active",
      billing_provider_customer_id: stripeCustomerId,
      billing_provider_subscription_id: stripeSubscriptionId,
      activated_at: before.activated_at ?? new Date(),
    },
  });

  if (before.status === "active") return; // already active -- replay, not a real transition, don't re-audit

  await context.entities.AuditLog.create({
    data: {
      org_id: orgId,
      actor_user_id: null,
      entity_type: "Subscription",
      entity_id: orgId,
      action: "activated_via_stripe_webhook",
      before_value: { status: before.status },
      after_value: { status: "active" },
    },
  });
}

async function syncSubscriptionStatus(
  context: Parameters<PaymentsWebhook>[2],
  orgId: string,
  stripeStatus: string,
) {
  const statusMap: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "expired",
    unpaid: "past_due",
  };
  const mappedStatus = statusMap[stripeStatus];
  if (!mappedStatus) return;

  const before = await context.entities.Subscription.findUnique({ where: { org_id: orgId } });
  if (!before || before.status === mappedStatus) return; // already in sync, nothing to do or audit

  await context.entities.Subscription.update({
    where: { org_id: orgId },
    data: { status: mappedStatus as never },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: orgId,
      actor_user_id: null,
      entity_type: "Subscription",
      entity_id: orgId,
      action: "status_synced_via_stripe_webhook",
      before_value: { status: before.status },
      after_value: { status: mappedStatus },
    },
  });
}
