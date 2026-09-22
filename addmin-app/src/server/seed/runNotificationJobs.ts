import type { DbSeedFn } from "wasp/server";
import { trialExpiryJob } from "../billing/trialExpiryJob";
import { missingAlertJob } from "../obligation/missingAlertJob";
import { leaseRenewalReminderJob } from "../property/leaseJobs";
import { amcRenewalJob } from "../vendor/amcJob";
import { slaBreachEscalationJob } from "../facility/slaJob";
import { assetWarrantyReminderJob } from "../asset/warrantyJob";
import { complianceExpiryJob } from "../compliance/complianceJob";

/** Dev-only: run every notification job once against seeded demo data. */
export const runNotificationJobs: DbSeedFn = async (prisma) => {
  await trialExpiryJob(undefined, {
    entities: {
      Subscription: prisma.subscription,
      NotificationLog: prisma.notificationLog,
      AuditLog: prisma.auditLog,
      User: prisma.user,
    },
  });

  await missingAlertJob(undefined, {
    entities: {
      ObligationInstance: prisma.obligationInstance,
      RecurringObligationSchedule: prisma.recurringObligationSchedule,
      UtilityAccount: prisma.utilityAccount,
      NotificationLog: prisma.notificationLog,
      User: prisma.user,
    },
  });

  await leaseRenewalReminderJob(undefined, {
    entities: {
      Lease: prisma.lease,
      NotificationRule: prisma.notificationRule,
      NotificationLog: prisma.notificationLog,
      User: prisma.user,
    },
  });

  await amcRenewalJob(undefined, {
    entities: {
      AMCContract: prisma.aMCContract,
      RecurringObligationSchedule: prisma.recurringObligationSchedule,
      ObligationInstance: prisma.obligationInstance,
      NotificationRule: prisma.notificationRule,
      NotificationLog: prisma.notificationLog,
      User: prisma.user,
    },
  });

  await slaBreachEscalationJob(undefined, {
    entities: {
      WorkOrder: prisma.workOrder,
      MaintenanceRequest: prisma.maintenanceRequest,
      NotificationLog: prisma.notificationLog,
      User: prisma.user,
    },
  });

  await assetWarrantyReminderJob(undefined, {
    entities: {
      Asset: prisma.asset,
      NotificationRule: prisma.notificationRule,
      NotificationLog: prisma.notificationLog,
      User: prisma.user,
    },
  });

  await complianceExpiryJob(undefined, {
    entities: {
      ComplianceItem: prisma.complianceItem,
      NotificationRule: prisma.notificationRule,
      NotificationLog: prisma.notificationLog,
      User: prisma.user,
    },
  });

  const count = await prisma.notificationLog.count();
  console.log(`Notification jobs finished — ${count} row(s) in NotificationLog (see /admin/notifications).`);
};
