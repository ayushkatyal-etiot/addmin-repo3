import type { PrismaClient } from "@prisma/client";

type JobContext = {
  entities: {
    UtilityBill: PrismaClient["utilityBill"];
  };
};

// Nightly (F-11): unpaid bills past due_date -> overdue. A single conditional
// UPDATE ... WHERE, same idempotent-and-race-safe idiom as
// obligation/generationJob.ts -- a bill that recordPayment moved to "paid" in
// the same window no longer matches the WHERE clause, so no race with
// payment recording (F-11's "don't race the overdue job against payment
// recording" pitfall).
export async function overdueBillsJob(_args: unknown, context: JobContext): Promise<void> {
  await context.entities.UtilityBill.updateMany({
    where: {
      status: { in: ["approved", "partially_paid"] },
      due_date: { lt: new Date() },
    },
    data: { status: "overdue" },
  });
}
