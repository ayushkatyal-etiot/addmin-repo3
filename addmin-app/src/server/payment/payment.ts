import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";
import { Prisma } from "@prisma/client";
import type { RecordPayment } from "wasp/server/operations";
import { assertRole, type Role } from "../shared/authz";
import { markUtilityObligationAfterPayment } from "../obligation/instanceLifecycle";

// Build Step 07: Payment Module (Tracking Mode, P0). Bill lifecycle end
// point -- recordPayment closes out an approved bill, partially or in full.
export const PAYMENT_AUTHORIZER_ROLES: Role[] = ["payment_authorizer"];

// Bills in any of these statuses can still receive a payment -- "overdue" is
// not terminal, it's just "approved and now late" (see overdueJob.ts).
const PAYABLE_BILL_STATUSES = ["approved", "partially_paid", "overdue"];

type RecordPaymentInput = {
  billId: string;
  amount: number;
  mode: string;
  tds_amount?: number;
};

export const recordPayment: RecordPayment<RecordPaymentInput, { success: true }> = async (input, context) => {
  const user = await assertRole(context.user, PAYMENT_AUTHORIZER_ROLES, context.entities, "recordPayment");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");

  if (!(input.amount > 0)) throw new HttpError(400, "Payment amount must be greater than 0.");

  if (user.authorization_limit !== null && user.authorization_limit !== undefined && input.amount > Number(user.authorization_limit)) {
    throw new HttpError(400, "This amount exceeds your authorization limit.");
  }

  // Serializable isolation: two concurrent recordPayment calls on the same
  // bill both read "remaining balance" -- without this, both could pass the
  // "amount <= remaining" check and together overpay the bill (F-11's
  // concurrency edge case). Under Serializable, the loser gets a P2034
  // conflict instead of silently double-recording.
  try {
    await prisma.$transaction(
      async (tx) => {
        const bill = await tx.utilityBill.findUnique({ where: { id: input.billId } });
        if (!bill || bill.org_id !== user.org_id) {
          throw new HttpError(404, "Bill not found.");
        }
        if (!PAYABLE_BILL_STATUSES.includes(bill.status)) {
          throw new HttpError(400, "This bill is not awaiting payment.");
        }

        const paidSoFar = await tx.payment.aggregate({
          where: { payable_type: "utility_bill", payable_id: bill.id, status: "paid" },
          _sum: { amount: true },
        });
        const remaining = Number(bill.amount) - Number(paidSoFar._sum.amount ?? 0);
        if (input.amount > remaining) {
          throw new HttpError(400, `Payment amount exceeds the remaining balance of ${remaining}.`);
        }

        const tdsAmount = input.tds_amount ?? 0;
        const payment = await tx.payment.create({
          data: {
            org_id: user.org_id!,
            payable_type: "utility_bill",
            payable_id: bill.id,
            utility_bill_id: bill.id,
            amount: input.amount,
            tds_amount: tdsAmount || null,
            net_amount: input.amount - tdsAmount,
            mode: input.mode,
            status: "paid",
            authorized_by: user.id,
          },
        });

        const newRemaining = remaining - input.amount;
        const fullyPaid = newRemaining <= 0;
        await tx.utilityBill.update({
          where: { id: bill.id },
          data: { status: fullyPaid ? "paid" : "partially_paid" },
        });

        await markUtilityObligationAfterPayment(tx, bill.id, fullyPaid);

        await tx.auditLog.create({
          data: {
            org_id: user.org_id!,
            actor_user_id: user.id,
            entity_type: "UtilityBill",
            entity_id: bill.id,
            action: "payment_recorded",
            after_value: { payment_id: payment.id, amount: input.amount, remaining: newRemaining },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      throw new HttpError(409, "Payment already recorded by another request. Please retry.");
    }
    throw err;
  }

  return { success: true };
};
