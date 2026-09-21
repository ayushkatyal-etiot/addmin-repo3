import type { PrismaClient } from "@prisma/client";
import { sendNotificationEmail } from "../notification/sender";

// Build Step 08, F-12: renewal reminders + escalation auto-apply. Config-
// driven reminder windows per 08-build-playbook.md's mandatory pattern
// ("not hardcoded per-job constants") -- see schema.prisma's
// NotificationRule. AMC/compliance (rest of Step 08) reuse the same
// NotificationRule row shape with their own rule_type.
const DEFAULT_REMINDER_DAYS = [180, 90, 60, 30];

type ReminderJobContext = {
  entities: {
    Lease: PrismaClient["lease"];
    NotificationRule: PrismaClient["notificationRule"];
    NotificationLog: PrismaClient["notificationLog"];
    User: PrismaClient["user"];
  };
};

export function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

// Nightly. Fires once per lease per configured window (180/90/60/30 by
// default) -- dedup is a NotificationLog lookup keyed on leaseId+window,
// same "already sent?" pattern as missingAlertJob.ts.
export async function leaseRenewalReminderJob(_args: unknown, context: ReminderJobContext): Promise<void> {
  const today = new Date();
  const activeLeases = await context.entities.Lease.findMany({
    where: { status: { in: ["active", "expiring"] } },
  });

  const ruleCache = new Map<string, number[]>();

  for (const lease of activeLeases) {
    let reminderDays = ruleCache.get(lease.org_id);
    if (!reminderDays) {
      const rule = await context.entities.NotificationRule.findUnique({
        where: { org_id_rule_type: { org_id: lease.org_id, rule_type: "lease_renewal" } },
      });
      reminderDays = (rule?.reminder_days as number[] | undefined) ?? DEFAULT_REMINDER_DAYS;
      ruleCache.set(lease.org_id, reminderDays);
    }

    const daysToExpiry = daysBetween(lease.end_date, today);
    if (!reminderDays.includes(daysToExpiry)) continue;

    const notificationType = `lease_renewal_reminder_${daysToExpiry}d`;
    const alreadySent = await context.entities.NotificationLog.findFirst({
      where: { org_id: lease.org_id, notification_type: notificationType, metadata: { path: ["leaseId"], equals: lease.id } },
    });
    if (alreadySent) continue;

    if (daysToExpiry <= Math.max(...reminderDays) && lease.status === "active") {
      await context.entities.Lease.update({ where: { id: lease.id }, data: { status: "expiring" } });
    }

    const officeAdmin = await context.entities.User.findFirst({
      where: { org_id: lease.org_id, role: "office_admin" },
    });
    if (officeAdmin?.email) {
      try {
        await sendNotificationEmail({
          to: officeAdmin.email,
          subject: `AddMin: lease renewal due in ${daysToExpiry} days`,
          text: `A lease (id ${lease.id}) is due for renewal in ${daysToExpiry} days.`,
          html: `<p>A lease (id <code>${lease.id}</code>) is due for renewal in ${daysToExpiry} days.</p>`,
        });
      } catch {
        // A send failure must never block the state transition above.
      }
    }

    await context.entities.NotificationLog.create({
      data: {
        org_id: lease.org_id,
        notification_type: notificationType,
        recipient_user_id: officeAdmin?.id ?? null,
        recipient_email: officeAdmin?.email ?? "unknown",
        metadata: { leaseId: lease.id },
      },
    });
  }
}

type EscalationJobContext = {
  entities: {
    Lease: PrismaClient["lease"];
  };
};

// Nightly. Applies a lease's configured rent escalation exactly once, on or
// after escalation_effective_date -- escalation_applied_at is the
// idempotency guard so a re-run doesn't compound the increase. Historical
// Payment rows already recorded are untouched; only rent_amount (read by
// rentPayment.ts at payment time) changes, so future payments alone see the
// new figure per F-12's edge case.
export async function leaseEscalationJob(_args: unknown, context: EscalationJobContext): Promise<void> {
  const today = new Date();
  const pending = await context.entities.Lease.findMany({
    where: {
      status: { in: ["active", "expiring"] },
      escalation_pct: { not: null },
      escalation_effective_date: { lte: today },
      escalation_applied_at: null,
    },
  });

  for (const lease of pending) {
    const newRent = Number(lease.rent_amount) * (1 + Number(lease.escalation_pct) / 100);
    await context.entities.Lease.update({
      where: { id: lease.id },
      data: { rent_amount: newRent, escalation_applied_at: today },
    });
  }
}
