import { HttpError } from "wasp/server";
import type { ListMyNotifications } from "wasp/server/operations";
import { userFromSession } from "../shared/authz";

export type InboxNotification = {
  id: string;
  notification_type: string;
  title: string;
  summary: string;
  sent_at: string;
  url: string | null;
};

function metadataRecord(metadata: unknown): Record<string, string> | null {
  if (metadata == null || typeof metadata !== "object") return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function titleForType(notificationType: string): string {
  if (notificationType.startsWith("trial_reminder")) return "Subscription trial ending soon";
  if (notificationType === "trial_expired") return "Subscription trial ended";
  if (notificationType.startsWith("lease_renewal_reminder")) return "Lease renewal reminder";
  if (notificationType.startsWith("amc_renewal_reminder")) return "AMC renewal reminder";
  if (notificationType.startsWith("compliance_expiry_reminder")) return "Compliance certificate expiring";
  if (notificationType.startsWith("asset_warranty_reminder")) return "Asset warranty expiring";
  if (notificationType === "missing_bill_alert") return "Overdue utility obligation";
  if (notificationType === "missing_item_escalation") return "Escalated overdue obligation";
  if (notificationType === "sla_breach_escalated") return "Maintenance SLA breached";
  return notificationType.replace(/_/g, " ");
}

function summaryForType(notificationType: string): string {
  const match = notificationType.match(/_(\d+)d$/);
  if (match) return `Due in ${match[1]} days — check the linked record.`;
  if (notificationType === "missing_bill_alert") return "A bill period is overdue with nothing recorded yet.";
  if (notificationType === "missing_item_escalation") return "An overdue item still needs attention.";
  if (notificationType === "sla_breach_escalated") return "A work order passed its SLA without completion.";
  if (notificationType.startsWith("trial_reminder")) return "Choose a plan to keep access after the trial.";
  return "Open the related page for details.";
}

function urlForNotification(notificationType: string, metadata: unknown): string | null {
  const m = metadataRecord(metadata);
  if (m?.leaseId) return `/app/property/leases/${m.leaseId}`;
  if (m?.complianceItemId) return `/app/compliance`;
  if (m?.workOrderId) return `/app/maintenance`;
  if (m?.amcContractId) return `/app/vendors`;
  if (m?.instanceId) return `/app/bills`;
  if (m?.assetId) return `/app/assets`;
  if (notificationType.startsWith("trial_")) return `/app/subscribe`;
  return null;
}

/** In-app inbox: NotificationLog rows addressed to the signed-in user. */
export const listMyNotifications: ListMyNotifications<void, InboxNotification[]> = async (_args, context) => {
  const user = await userFromSession(context.user, context.entities);
  if (!user.org_id) return [];
  if (!user.email) throw new HttpError(400, "Your account has no email address.");

  const rows = await context.entities.NotificationLog.findMany({
    where: {
      org_id: user.org_id,
      OR: [{ recipient_user_id: user.id }, { recipient_email: { equals: user.email, mode: "insensitive" } }],
    },
    orderBy: { sent_at: "desc" },
    take: 40,
  });

  return rows.map((r) => ({
    id: r.id,
    notification_type: r.notification_type,
    title: titleForType(r.notification_type),
    summary: summaryForType(r.notification_type),
    sent_at: r.sent_at.toISOString(),
    url: urlForNotification(r.notification_type, r.metadata),
  }));
};
