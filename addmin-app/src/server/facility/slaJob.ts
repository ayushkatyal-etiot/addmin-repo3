import type { PrismaClient } from "@prisma/client";
import { sendNotificationEmail } from "../notification/sender";

// Build Step 08, F-15: "If SLA due date passes without completion, system
// escalates per configured rule" -- same NotificationLog dedup pattern as
// missingAlertJob.ts (fire once, not once per nightly run).
type JobContext = {
  entities: {
    WorkOrder: PrismaClient["workOrder"];
    MaintenanceRequest: PrismaClient["maintenanceRequest"];
    NotificationLog: PrismaClient["notificationLog"];
    User: PrismaClient["user"];
  };
};

// Nightly. Only "assigned"/"in_progress" work orders can breach -- once
// completed/verified, sla_due_at no longer matters.
export async function slaBreachEscalationJob(_args: unknown, context: JobContext): Promise<void> {
  const today = new Date();

  const breached = await context.entities.WorkOrder.findMany({
    where: { status: { in: ["assigned", "in_progress"] }, sla_due_at: { lt: today } },
    include: { maintenanceRequest: true },
  });

  for (const workOrder of breached) {
    const alreadySent = await context.entities.NotificationLog.findFirst({
      where: {
        org_id: workOrder.org_id,
        notification_type: "sla_breach_escalated",
        metadata: { path: ["workOrderId"], equals: workOrder.id },
      },
    });
    if (alreadySent) continue;

    // Escalates to Office Admin, per F-15's user flow step 7 -- the same
    // "office_head fallback to schedule owner" pattern missingAlertJob.ts
    // uses doesn't apply here since there's no schedule/owner concept for a
    // one-off work order; office_admin is the configured owner outright.
    const officeAdmin = await context.entities.User.findFirst({
      where: { org_id: workOrder.org_id, role: "office_admin" },
    });
    if (officeAdmin?.email) {
      try {
        await sendNotificationEmail({
          to: officeAdmin.email,
          subject: "AddMin: a work order has breached its SLA",
          text: `Work order ${workOrder.id} (category: ${workOrder.maintenanceRequest.category}) passed its SLA due date without completion.`,
          html: `<p>Work order <code>${workOrder.id}</code> (category: ${workOrder.maintenanceRequest.category}) passed its SLA due date without completion.</p>`,
        });
      } catch {
        // A send failure must never block the escalation record below.
      }
    }

    await context.entities.NotificationLog.create({
      data: {
        org_id: workOrder.org_id,
        notification_type: "sla_breach_escalated",
        recipient_user_id: officeAdmin?.id ?? null,
        recipient_email: officeAdmin?.email ?? "unknown",
        metadata: { workOrderId: workOrder.id },
      },
    });
  }
}
