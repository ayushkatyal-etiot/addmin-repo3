import type { PrismaClient } from "@prisma/client";

type AmcObligationEntities = {
  RecurringObligationSchedule: PrismaClient["recurringObligationSchedule"];
  ObligationInstance: PrismaClient["obligationInstance"];
  AMCContract: PrismaClient["aMCContract"];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Natural key: one renewal obligation per AMC contract end date. */
export function amcRenewalPeriodKey(contractId: string, endDate: Date): string {
  const end = endDate.toISOString().slice(0, 10);
  return `amc-${contractId.slice(0, 8)}-${end}`;
}

/**
 * AMC renewals are due by contract end_date (F-14), not a blind annual calendar
 * period from start_date. Creates the renewal ObligationInstance once the
 * notice window opens (end_date − expected_window_days).
 */
export async function ensureAmcRenewalObligation(
  entities: AmcObligationEntities,
  contractId: string,
  asOf: Date = new Date(),
): Promise<void> {
  const contract = await entities.AMCContract.findUnique({ where: { id: contractId } });
  if (!contract || contract.status === "closed") return;

  const schedule = await entities.RecurringObligationSchedule.findFirst({
    where: { scope_type: "amc", scope_ref_id: contractId },
  });
  if (!schedule) return;

  const end = contract.end_date;
  const windowOpen = new Date(end.getTime() - schedule.expected_window_days * MS_PER_DAY);
  if (asOf.getTime() < windowOpen.getTime()) return;

  const period = amcRenewalPeriodKey(contract.id, end);
  const existing = await entities.ObligationInstance.findUnique({
    where: { schedule_id_period: { schedule_id: schedule.id, period } },
  });
  if (existing) return;

  try {
    await entities.ObligationInstance.create({
      data: {
        org_id: schedule.org_id,
        schedule_id: schedule.id,
        period,
        expected_date: end,
        due_date: end,
        status: "expected",
      },
    });
  } catch {
    // concurrent create — idempotent
  }
}
