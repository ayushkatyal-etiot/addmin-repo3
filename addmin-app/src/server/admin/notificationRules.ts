import { HttpError } from "wasp/server";
import type {
  ListNotificationLogs,
  ListNotificationRules,
  UpsertNotificationRule,
} from "wasp/server/operations";
import { assertRole, type Role } from "../shared/authz";

// Build Step 11: production hardening. NotificationRule rows (schema.prisma)
// have driven reminder windows for lease/AMC/compliance/asset jobs since
// Step 08 (see leaseJobs.ts, amcJob.ts, complianceJob.ts, warrantyJob.ts),
// but were only ever settable by writing to the DB directly. This is the
// admin UI's backing operations -- same defaults each job already falls
// back to when no row exists, shown here so an admin can see and override them.
export const RULE_DEFAULTS: Record<string, number[]> = {
  lease_renewal: [180, 90, 60, 30],
  amc_renewal: [60, 30],
  compliance_expiry: [30],
  asset_warranty_expiry: [30],
};

const RULE_TYPES = Object.keys(RULE_DEFAULTS);

const ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];

export const listNotificationRules: ListNotificationRules<
  void,
  { ruleType: string; reminderDays: number[] }[]
> = async (_args, context) => {
  const user = await assertRole(context.user, ADMIN_ROLES, context.entities, "listNotificationRules");
  const rows = await context.entities.NotificationRule.findMany({ where: { org_id: user.org_id! } });
  const byType = new Map<string, number[]>(rows.map((r) => [r.rule_type, r.reminder_days as number[]]));
  return RULE_TYPES.map((ruleType) => ({
    ruleType,
    reminderDays: byType.get(ruleType) ?? RULE_DEFAULTS[ruleType],
  }));
};

export const upsertNotificationRule: UpsertNotificationRule<
  { ruleType: string; reminderDays: number[] },
  void
> = async (input, context) => {
  const user = await assertRole(context.user, ADMIN_ROLES, context.entities, "upsertNotificationRule");
  if (!RULE_TYPES.includes(input.ruleType)) {
    throw new HttpError(400, "Unknown rule type.");
  }
  const days = input.reminderDays.filter((d) => Number.isInteger(d) && d > 0);
  if (days.length === 0) {
    throw new HttpError(400, "At least one reminder day is required.");
  }
  await context.entities.NotificationRule.upsert({
    where: { org_id_rule_type: { org_id: user.org_id!, rule_type: input.ruleType as any } },
    update: { reminder_days: days },
    create: { org_id: user.org_id!, rule_type: input.ruleType as any, reminder_days: days },
  });
};

export type NotificationLogRow = {
  id: string;
  notification_type: string;
  recipient_email: string;
  sent_at: string;
  metadata_json: string | null;
};

export const listNotificationLogs: ListNotificationLogs<void, NotificationLogRow[]> = async (_args, context) => {
  const user = await assertRole(context.user, ADMIN_ROLES, context.entities, "listNotificationLogs");
  const rows = await context.entities.NotificationLog.findMany({
    where: { org_id: user.org_id! },
    orderBy: { sent_at: "desc" },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    notification_type: r.notification_type,
    recipient_email: r.recipient_email,
    sent_at: r.sent_at.toISOString(),
    metadata_json: r.metadata != null ? JSON.stringify(r.metadata) : null,
  }));
};
