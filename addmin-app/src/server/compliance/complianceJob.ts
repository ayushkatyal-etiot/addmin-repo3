import type { PrismaClient } from "@prisma/client";
import { sendNotificationEmail } from "../notification/sender";
import { daysBetween, computeExpiryStatus } from "./compliance";

// Build Step 08, F-17: "reminders fire at a configurable advance period" +
// "status updates from Valid to Expiring as it nears expiry" +
// "unresolved expired items escalate to Office Head within the configured
// SLA threshold." Three passes over the same set of dated items: status
// walk (always correct off expiry_date alone), reminder alerts
// (NotificationRule-driven, same pattern as leaseJobs/amcJob/warrantyJob),
// and escalation (the 15-day BRD rule -- a fixed constant per the spec, not
// an org-configurable window like the other three reminder types).
const DEFAULT_REMINDER_DAYS = [30];
const ESCALATION_THRESHOLD_DAYS = 15;

type JobContext = {
  entities: {
    ComplianceItem: PrismaClient["complianceItem"];
    NotificationRule: PrismaClient["notificationRule"];
    NotificationLog: PrismaClient["notificationLog"];
    User: PrismaClient["user"];
  };
};

export async function complianceExpiryJob(_args: unknown, context: JobContext): Promise<void> {
  const today = new Date();

  const datedItems = await context.entities.ComplianceItem.findMany({
    where: { status: { in: ["valid", "expiring", "expired"] }, expiry_date: { not: null } },
  });

  const ruleCache = new Map<string, number[]>();

  for (const item of datedItems) {
    let reminderDays = ruleCache.get(item.org_id);
    if (!reminderDays) {
      const rule = await context.entities.NotificationRule.findUnique({
        where: { org_id_rule_type: { org_id: item.org_id, rule_type: "compliance_expiry" } },
      });
      reminderDays = (rule?.reminder_days as number[] | undefined) ?? DEFAULT_REMINDER_DAYS;
      ruleCache.set(item.org_id, reminderDays);
    }

    // Status walk.
    const newStatus = computeExpiryStatus(item.expiry_date!, today, reminderDays);
    if (newStatus !== item.status) {
      await context.entities.ComplianceItem.update({ where: { id: item.id }, data: { status: newStatus } });
    }

    // Reminder alert, deduped like every sibling job.
    const daysToExpiry = daysBetween(item.expiry_date!, today);
    if (daysToExpiry >= 0 && reminderDays.includes(daysToExpiry)) {
      const notificationType = `compliance_expiry_reminder_${daysToExpiry}d`;
      const alreadySent = await context.entities.NotificationLog.findFirst({
        where: { org_id: item.org_id, notification_type: notificationType, metadata: { path: ["complianceItemId"], equals: item.id } },
      });
      if (!alreadySent) {
        const coordinator = await context.entities.User.findFirst({
          where: { org_id: item.org_id, role: "compliance_coordinator" },
        });
        if (coordinator?.email) {
          try {
            await sendNotificationEmail({
              to: coordinator.email,
              subject: `AddMin: ${item.compliance_type} expires in ${daysToExpiry} days`,
              text: `Compliance item ${item.id} (${item.compliance_type}) expires in ${daysToExpiry} days.`,
              html: `<p>Compliance item <code>${item.id}</code> (${item.compliance_type}) expires in ${daysToExpiry} days.</p>`,
            });
          } catch {
            // A send failure must never block the log record below.
          }
        }
        await context.entities.NotificationLog.create({
          data: {
            org_id: item.org_id,
            notification_type: notificationType,
            recipient_user_id: coordinator?.id ?? null,
            recipient_email: coordinator?.email ?? "unknown",
            metadata: { complianceItemId: item.id },
          },
        });
      }
    }

    // Escalation: expired past the fixed 15-day SLA and not yet escalated.
    if (newStatus === "expired" && !item.escalated_at && -daysToExpiry >= ESCALATION_THRESHOLD_DAYS) {
      const officeHead = await context.entities.User.findFirst({
        where: { org_id: item.org_id, role: "office_head" },
      });
      if (officeHead?.email) {
        try {
          await sendNotificationEmail({
            to: officeHead.email,
            subject: `AddMin: ${item.compliance_type} is overdue for renewal`,
            text: `Compliance item ${item.id} (${item.compliance_type}) has been expired for over ${ESCALATION_THRESHOLD_DAYS} days with no renewal.`,
            html: `<p>Compliance item <code>${item.id}</code> (${item.compliance_type}) has been expired for over ${ESCALATION_THRESHOLD_DAYS} days with no renewal.</p>`,
          });
        } catch {
          // A send failure must never block the escalation record below.
        }
      }
      await context.entities.ComplianceItem.update({ where: { id: item.id }, data: { escalated_at: today } });
    }
  }
}
