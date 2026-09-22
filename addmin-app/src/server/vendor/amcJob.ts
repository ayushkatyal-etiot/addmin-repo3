import type { PrismaClient } from "@prisma/client";
import { sendNotificationEmail } from "../notification/sender";
import { ensureAmcRenewalObligation } from "./amcObligation";

// Build Step 08, F-14: "Expired AMC without renewal action automatically
// flags as Expired" + "renewal alerts trigger at 60- and 30-day intervals."
// Same config-driven-window pattern as leaseJobs.ts's
// leaseRenewalReminderJob -- NotificationRule rule_type "amc_renewal"
// (schema.prisma), defaulting here when an org hasn't configured one.
const DEFAULT_REMINDER_DAYS = [60, 30];

type JobContext = {
  entities: {
    AMCContract: PrismaClient["aMCContract"];
    RecurringObligationSchedule: PrismaClient["recurringObligationSchedule"];
    ObligationInstance: PrismaClient["obligationInstance"];
    NotificationRule: PrismaClient["notificationRule"];
    NotificationLog: PrismaClient["notificationLog"];
    User: PrismaClient["user"];
  };
};

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

// Nightly. Two independent passes: (1) the status walk (active ->
// due_for_renewal -> expired), driven purely by end_date vs today so it's
// correct even if the alert pass below is ever skipped; (2) renewal alerts
// at each configured window, deduped via NotificationLog exactly like
// leaseRenewalReminderJob.
export async function amcRenewalJob(_args: unknown, context: JobContext): Promise<void> {
  const today = new Date();

  const openContracts = await context.entities.AMCContract.findMany({
    where: { status: { in: ["active", "due_for_renewal"] } },
  });

  const ruleCache = new Map<string, number[]>();

  for (const contract of openContracts) {
    await ensureAmcRenewalObligation(context.entities, contract.id, today);

    const daysToExpiry = daysBetween(contract.end_date, today);

    if (daysToExpiry < 0) {
      await context.entities.AMCContract.update({ where: { id: contract.id }, data: { status: "expired" } });
      continue;
    }

    let reminderDays = ruleCache.get(contract.org_id);
    if (!reminderDays) {
      const rule = await context.entities.NotificationRule.findUnique({
        where: { org_id_rule_type: { org_id: contract.org_id, rule_type: "amc_renewal" } },
      });
      reminderDays = (rule?.reminder_days as number[] | undefined) ?? DEFAULT_REMINDER_DAYS;
      ruleCache.set(contract.org_id, reminderDays);
    }

    if (contract.status === "active" && daysToExpiry <= Math.max(...reminderDays)) {
      await context.entities.AMCContract.update({ where: { id: contract.id }, data: { status: "due_for_renewal" } });
    }

    if (!reminderDays.includes(daysToExpiry)) continue;

    const notificationType = `amc_renewal_reminder_${daysToExpiry}d`;
    const alreadySent = await context.entities.NotificationLog.findFirst({
      where: {
        org_id: contract.org_id,
        notification_type: notificationType,
        metadata: { path: ["amcContractId"], equals: contract.id },
      },
    });
    if (alreadySent) continue;

    const vendorManager = await context.entities.User.findFirst({
      where: { org_id: contract.org_id, role: "vendor_manager" },
    });
    if (vendorManager?.email) {
      try {
        await sendNotificationEmail({
          to: vendorManager.email,
          subject: `AddMin: AMC contract renewal due in ${daysToExpiry} days`,
          text: `AMC contract ${contract.id} is due for renewal in ${daysToExpiry} days.`,
          html: `<p>AMC contract <code>${contract.id}</code> is due for renewal in ${daysToExpiry} days.</p>`,
        });
      } catch {
        // A send failure must never block the status transition above.
      }
    }

    await context.entities.NotificationLog.create({
      data: {
        org_id: contract.org_id,
        notification_type: notificationType,
        recipient_user_id: vendorManager?.id ?? null,
        recipient_email: vendorManager?.email ?? "unknown",
        metadata: { amcContractId: contract.id },
      },
    });
  }
}
