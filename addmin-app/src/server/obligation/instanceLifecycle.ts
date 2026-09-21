import type { PrismaClient } from "@prisma/client";

type ScheduleAndInstances = {
  RecurringObligationSchedule: PrismaClient["recurringObligationSchedule"];
  ObligationInstance: PrismaClient["obligationInstance"];
};

type UtilityLinkEntities = ScheduleAndInstances & {
  UtilityBill: PrismaClient["utilityBill"];
};

type UtilityReconcileEntities = UtilityLinkEntities;

type LeaseReconcileEntities = ScheduleAndInstances & {
  Payment: PrismaClient["payment"];
};

/** Aligns user-entered billing period keys with generationJob period keys (e.g. 2026-9 → 2026-09). */
export function normalizeBillingPeriodKey(raw: string): string {
  const trimmed = raw.trim();
  const monthly = /^(\d{4})-(\d{1,2})$/.exec(trimmed);
  if (monthly) {
    return `${monthly[1]}-${String(Number(monthly[2])).padStart(2, "0")}`;
  }
  return trimmed;
}

export async function linkUtilityBillToObligation(
  entities: UtilityLinkEntities,
  bill: { id: string; org_id: string; utility_account_id: string; billing_period: string },
): Promise<void> {
  const period = normalizeBillingPeriodKey(bill.billing_period);
  const schedule = await entities.RecurringObligationSchedule.findFirst({
    where: { scope_type: "utility", scope_ref_id: bill.utility_account_id },
  });
  if (!schedule) return;

  const instance = await entities.ObligationInstance.findUnique({
    where: { schedule_id_period: { schedule_id: schedule.id, period } },
  });
  if (!instance || (instance.status !== "expected" && instance.status !== "missing")) return;

  await entities.UtilityBill.update({
    where: { id: bill.id },
    data: { obligation_instance_id: instance.id, billing_period: period },
  });
  await entities.ObligationInstance.update({
    where: { id: instance.id },
    data: {
      status: "in_process",
      linked_ref_type: "utility_bill",
      linked_ref_id: bill.id,
    },
  });
}

export async function markUtilityObligationAfterPayment(
  tx: Pick<
    PrismaClient,
    "utilityBill" | "obligationInstance" | "recurringObligationSchedule"
  >,
  billId: string,
  fullyPaid: boolean,
): Promise<void> {
  if (!fullyPaid) return;
  const bill = await tx.utilityBill.findUnique({ where: { id: billId } });
  if (!bill) return;

  let instanceId = bill.obligation_instance_id;
  if (!instanceId) {
    const schedule = await tx.recurringObligationSchedule.findFirst({
      where: { scope_type: "utility", scope_ref_id: bill.utility_account_id },
    });
    if (schedule) {
      const period = normalizeBillingPeriodKey(bill.billing_period);
      const instance = await tx.obligationInstance.findUnique({
        where: { schedule_id_period: { schedule_id: schedule.id, period } },
      });
      if (instance) {
        instanceId = instance.id;
        await tx.utilityBill.update({
          where: { id: bill.id },
          data: { obligation_instance_id: instance.id, billing_period: period },
        });
      }
    }
  }
  if (!instanceId) return;

  await tx.obligationInstance.update({
    where: { id: instanceId },
    data: { status: "closed", linked_ref_type: "utility_bill", linked_ref_id: bill.id },
  });
}

export async function markRentCamObligationReceived(
  tx: Pick<PrismaClient, "recurringObligationSchedule" | "obligationInstance">,
  leaseId: string,
  payableType: "rent" | "cam",
  period: string,
  paymentId: string,
): Promise<void> {
  const schedule = await tx.recurringObligationSchedule.findFirst({
    where: { scope_type: payableType, scope_ref_id: leaseId },
  });
  if (!schedule) return;

  const instance = await tx.obligationInstance.findUnique({
    where: { schedule_id_period: { schedule_id: schedule.id, period } },
  });
  if (!instance || (instance.status !== "expected" && instance.status !== "missing")) return;

  await tx.obligationInstance.update({
    where: { id: instance.id },
    data: {
      status: "received",
      linked_ref_type: "payment",
      linked_ref_id: paymentId,
    },
  });
}

/** Repairs stale rows when bills/payments were recorded before status linking existed. */
export async function reconcileUtilityObligationInstances(
  entities: UtilityReconcileEntities,
  accountId: string,
  scheduleId: string,
): Promise<void> {
  const instances = await entities.ObligationInstance.findMany({
    where: { schedule_id: scheduleId, status: { in: ["expected", "missing", "in_process", "received"] } },
  });

  for (const instance of instances) {
    const bill = await entities.UtilityBill.findFirst({
      where: { utility_account_id: accountId, billing_period: instance.period },
    });
    if (!bill) continue;

    const targetStatus = bill.status === "paid" ? "closed" : "in_process";
    if (instance.status === targetStatus && bill.obligation_instance_id === instance.id) continue;

    await entities.UtilityBill.update({
      where: { id: bill.id },
      data: { obligation_instance_id: bill.obligation_instance_id ?? instance.id },
    });
    await entities.ObligationInstance.update({
      where: { id: instance.id },
      data: {
        status: targetStatus,
        linked_ref_type: "utility_bill",
        linked_ref_id: bill.id,
      },
    });
  }
}

export async function reconcileLeaseObligationInstances(
  entities: LeaseReconcileEntities,
  leaseId: string,
  scheduleIds: string[],
  scheduleTypeById: Map<string, string>,
): Promise<void> {
  if (scheduleIds.length === 0) return;

  const instances = await entities.ObligationInstance.findMany({
    where: {
      schedule_id: { in: scheduleIds },
      status: { in: ["expected", "missing"] },
    },
  });

  for (const instance of instances) {
    const scopeType = scheduleTypeById.get(instance.schedule_id);
    if (scopeType !== "rent" && scopeType !== "cam") continue;

    const payment = await entities.Payment.findFirst({
      where: {
        lease_id: leaseId,
        period: instance.period,
        payable_type: scopeType,
        status: "paid",
      },
    });
    if (!payment) continue;

    await entities.ObligationInstance.update({
      where: { id: instance.id },
      data: {
        status: "received",
        linked_ref_type: "payment",
        linked_ref_id: payment.id,
      },
    });
  }
}
