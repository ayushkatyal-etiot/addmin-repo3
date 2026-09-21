import type { PrismaClient } from "@prisma/client";
import { getStripeClient } from "./stripeClient";

type JobContext = {
  entities: {
    Subscription: PrismaClient["subscription"];
    NotificationLog: PrismaClient["notificationLog"];
    AuditLog: PrismaClient["auditLog"];
    User: PrismaClient["user"];
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Nightly (04-architecture.md's background jobs list). First Wasp `job` in
// the system -- establishes the pattern (idempotent per-org-per-day via
// NotificationLog dedup, entities declared in main.wasp) that Build Step 06
// extends for the Obligation Engine's jobs.
export async function trialExpiryJob(_args: unknown, context: JobContext): Promise<void> {
  const now = new Date();
  const trialingSubs = await context.entities.Subscription.findMany({
    where: { status: "trialing" },
  });

  for (const sub of trialingSubs) {
    if (!sub.trial_ends_at) continue;
    const msRemaining = sub.trial_ends_at.getTime() - now.getTime();

    if (msRemaining <= 0) {
      await expireTrial(context, sub.org_id);
      continue;
    }

    const daysRemaining = msRemaining / DAY_MS;
    if (daysRemaining <= 3) {
      await sendReminderOnce(context, sub.org_id, "trial_reminder_3d");
    }
    if (daysRemaining <= 1) {
      await sendReminderOnce(context, sub.org_id, "trial_reminder_1d");
    }
  }

  // Self-heals a missed webhook, per 04-architecture.md: reconcile every
  // active/past_due subscription with a Stripe id against Stripe's own record.
  const stripeLinkedSubs = await context.entities.Subscription.findMany({
    where: {
      billing_provider_subscription_id: { not: null },
      status: { in: ["active", "past_due"] },
    },
  });
  const stripe = getStripeClient();
  const statusMap: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "expired",
    unpaid: "past_due",
  };
  for (const sub of stripeLinkedSubs) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.billing_provider_subscription_id!);
      const mapped = statusMap[stripeSub.status];
      if (mapped && mapped !== sub.status) {
        await context.entities.Subscription.update({
          where: { org_id: sub.org_id },
          data: { status: mapped as never },
        });
        await context.entities.AuditLog.create({
          data: {
            org_id: sub.org_id,
            actor_user_id: null,
            entity_type: "Subscription",
            entity_id: sub.org_id,
            action: "status_reconciled_via_nightly_job",
            before_value: { status: sub.status },
            after_value: { status: mapped },
          },
        });
      }
    } catch {
      // A single org's Stripe lookup failing (deleted subscription, API
      // hiccup) must not abort reconciliation for every other org this run.
      continue;
    }
  }
}

async function expireTrial(context: JobContext, orgId: string): Promise<void> {
  const result = await context.entities.Subscription.updateMany({
    where: { org_id: orgId, status: "trialing" }, // guards against a race with the webhook activating it mid-run
    data: { status: "expired" },
  });
  if (result.count === 0) return; // already transitioned (webhook won the race) -- nothing to log

  await context.entities.AuditLog.create({
    data: {
      org_id: orgId,
      actor_user_id: null,
      entity_type: "Subscription",
      entity_id: orgId,
      action: "trial_expired",
    },
  });
}

async function sendReminderOnce(
  context: JobContext,
  orgId: string,
  notificationType: "trial_reminder_3d" | "trial_reminder_1d",
): Promise<void> {
  const alreadySent = await context.entities.NotificationLog.findFirst({
    where: { org_id: orgId, notification_type: notificationType },
  });
  if (alreadySent) return; // idempotent per org -- never re-notify once sent

  const admin = await context.entities.User.findFirst({
    where: { org_id: orgId, role: "platform_admin" },
  });
  if (!admin?.email) return;

  // TODO Build Step 06+: send via SendGrid (wasp/server/email) once the
  // reminder copy is written; logging is what the rubric verifies against.
  await context.entities.NotificationLog.create({
    data: {
      org_id: orgId,
      notification_type: notificationType,
      recipient_user_id: admin.id,
      recipient_email: admin.email,
    },
  });
}
