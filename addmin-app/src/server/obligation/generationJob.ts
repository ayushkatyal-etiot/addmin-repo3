import type { PrismaClient } from "@prisma/client";
import { obligationPeriodToGenerate, type ObligationFrequency } from "./schedule";

type JobContext = {
  entities: {
    RecurringObligationSchedule: PrismaClient["recurringObligationSchedule"];
    ObligationInstance: PrismaClient["obligationInstance"];
  };
};

// Nightly (04-architecture.md's background jobs list). Establishes the
// pattern (idempotent per schedule+period via the DB's @@unique([schedule_id,
// period]) constraint, entities declared in main.wasp) Build Step 08 reuses
// for Lease/AMC/Compliance schedules against this same engine.
export async function obligationGenerationJob(_args: unknown, context: JobContext): Promise<void> {
  const today = new Date();
  const activeSchedules = await context.entities.RecurringObligationSchedule.findMany({
    where: { OR: [{ active_to: null }, { active_to: { gte: today } }] },
  });

  for (const schedule of activeSchedules) {
    const period = obligationPeriodToGenerate(
      schedule.active_from,
      schedule.frequency as ObligationFrequency,
      today,
      schedule.expected_window_days,
    );
    if (!period) continue;

    const alreadyExists = await context.entities.ObligationInstance.findUnique({
      where: { schedule_id_period: { schedule_id: schedule.id, period: period.key } },
    });
    if (alreadyExists) continue; // idempotent: re-running the same night (or a catch-up run) is a no-op

    // expected_window_days opens generation before period.end; the bill itself
    // is expected by period.end + that same window (e.g. active_from 20 Aug,
    // monthly → period ends 19 Sep, expected by 26 Sep when window = 7).
    const expectedBy = new Date(
      period.end.getTime() + schedule.expected_window_days * 24 * 60 * 60 * 1000,
    );

    try {
      await context.entities.ObligationInstance.create({
        data: {
          org_id: schedule.org_id,
          schedule_id: schedule.id,
          period: period.key,
          expected_date: expectedBy,
          due_date: expectedBy,
          status: "expected",
        },
      });
    } catch {
      // Race with a concurrent run hit the DB's own @@unique constraint --
      // the other run already created it, which is exactly the idempotent
      // outcome we want. Nothing to do.
    }
  }
}
