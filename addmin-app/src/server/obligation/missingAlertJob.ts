import type { PrismaClient } from "@prisma/client";
import { sendNotificationEmail } from "../notification/sender";

type JobContext = {
  entities: {
    ObligationInstance: PrismaClient["obligationInstance"];
    RecurringObligationSchedule: PrismaClient["recurringObligationSchedule"];
    UtilityAccount: PrismaClient["utilityAccount"];
    NotificationLog: PrismaClient["notificationLog"];
    User: PrismaClient["user"];
  };
};

// Missing items unresolved past this many days escalate to the Office Head (F-08).
const ESCALATION_THRESHOLD_DAYS = 5;

// Nightly. Deliberately server-side and independent of any dashboard page
// load (F-08's acceptance criteria + Build Step 06's mandatory pattern) --
// the flag must exist whether or not anyone opens the app that day.
export async function missingAlertJob(_args: unknown, context: JobContext): Promise<void> {
  const today = new Date();

  // Step 1: expected -> missing, for anything past its expected_date with nothing linked.
  const overdueExpected = await context.entities.ObligationInstance.findMany({
    where: { status: "expected", expected_date: { lt: today }, linked_ref_id: null },
  });

  for (const instance of overdueExpected) {
    await context.entities.ObligationInstance.update({
      where: { id: instance.id },
      data: { status: "missing" },
    });
    await notifyOnce(context, instance.id, instance.schedule_id, instance.org_id, "missing_bill_alert", "owner");
  }

  // Step 2: escalate anything still missing past the threshold, once.
  const escalationCutoff = new Date(today.getTime() - ESCALATION_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const stillMissing = await context.entities.ObligationInstance.findMany({
    where: { status: "missing", expected_date: { lt: escalationCutoff } },
  });

  for (const instance of stillMissing) {
    await notifyOnce(context, instance.id, instance.schedule_id, instance.org_id, "missing_item_escalation", "office_head");
  }
}

async function notifyOnce(
  context: JobContext,
  instanceId: string,
  scheduleId: string,
  orgId: string,
  notificationType: "missing_bill_alert" | "missing_item_escalation",
  recipientKind: "owner" | "office_head",
): Promise<void> {
  // Dedup key is (org_id-scoped) instance id embedded in metadata, checked
  // via a query rather than a unique constraint -- NotificationLog (Build
  // Step 05) has no per-instance uniqueness built in, so this mirrors the
  // trial-reminder job's "already sent?" pattern instead.
  const alreadySent = await context.entities.NotificationLog.findFirst({
    where: { org_id: orgId, notification_type: notificationType, metadata: { path: ["instanceId"], equals: instanceId } },
  });
  if (alreadySent) return;

  const recipient = await resolveRecipient(context, scheduleId, recipientKind);
  if (!recipient?.email) return;

  try {
    await sendNotificationEmail({
      to: recipient.email,
      subject:
        notificationType === "missing_bill_alert"
          ? "AddMin: a bill you're tracking is overdue"
          : "AddMin: an overdue item needs your attention",
      text: `Obligation instance ${instanceId} is ${notificationType === "missing_bill_alert" ? "overdue with nothing recorded against it" : "still unresolved past the escalation threshold"}.`,
      html: `<p>Obligation instance <code>${instanceId}</code> is ${notificationType === "missing_bill_alert" ? "overdue with nothing recorded against it" : "still unresolved past the escalation threshold"}.</p>`,
    });
  } catch {
    // Per 04-architecture.md's failure-mode note: a send failure must never
    // block the state transition, which has already committed above.
  }

  await context.entities.NotificationLog.create({
    data: {
      org_id: orgId,
      notification_type: notificationType,
      recipient_user_id: recipient.id,
      recipient_email: recipient.email,
      metadata: { instanceId },
    },
  });
}

async function resolveRecipient(
  context: JobContext,
  scheduleId: string,
  kind: "owner" | "office_head",
): Promise<{ id: string; email: string | null } | null> {
  const schedule = await context.entities.RecurringObligationSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) return null;

  if (kind === "owner") {
    return context.entities.User.findUnique({ where: { id: schedule.owner_user_id } });
  }

  // office_head: resolve the office through the schedule's scope. Only
  // "utility" is wired up today (Build Step 06's scope) -- Lease/AMC/
  // Compliance (Build Step 08) reuse this engine and extend this switch.
  if (schedule.scope_type === "utility") {
    const account = await context.entities.UtilityAccount.findUnique({ where: { id: schedule.scope_ref_id } });
    if (!account) return null;
    const officeHead = await context.entities.User.findFirst({
      where: { org_id: account.org_id, role: "office_head" },
    });
    // Fall back to the schedule owner if no office_head role exists yet in
    // this org -- an escalation with no recipient is worse than a slightly
    // wrong one.
    return officeHead ?? context.entities.User.findUnique({ where: { id: schedule.owner_user_id } });
  }
  return context.entities.User.findUnique({ where: { id: schedule.owner_user_id } });
}
