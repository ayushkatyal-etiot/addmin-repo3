import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";
import { Prisma } from "@prisma/client";
import type { RecordRentPayment, ListRentPayments } from "wasp/server/operations";
import { assertRole, assertOfficeScope, type Role } from "../shared/authz";
import { obligationPeriodToGenerate } from "../obligation/schedule";
import { markRentCamObligationReceived } from "../obligation/instanceLifecycle";

// F-13: TDS Calculation on Rent Payment. Mirrors
// src/server/payment/payment.ts's recordPayment (same role, same
// Serializable-transaction dedup pattern) but computes TDS server-side --
// never accepted from the client, unlike the utility flow's optional
// client-supplied tds_amount, since a rent payment's TDS is a statutory
// calculation, not a maker's estimate.
export const PAYMENT_AUTHORIZER_ROLES: Role[] = ["payment_authorizer"];

// Pure so tests/lease.test.ts can exercise the rounding/blocking rules
// without a live DB, matching tests/authz.test.ts's unit-level style. Rate
// is a percentage (e.g. 10 for 10%); rounds to paise (2dp) like real INR TDS.
export function calculateTds(gross: number, ratePct: number | null): { tdsAmount: number; netAmount: number } {
  if (ratePct === null) {
    throw new HttpError(
      400,
      "This landlord is flagged TDS-applicable but no TDS rate is configured (landlord override or organization default). Configure a rate before recording this payment.",
    );
  }
  const tdsAmount = Math.round(gross * ratePct) / 100;
  return { tdsAmount, netAmount: gross - tdsAmount };
}

type RecordRentPaymentInput = {
  leaseId: string;
  type: "rent" | "cam";
  due_date: string;
  mode: string;
};

export const recordRentPayment: RecordRentPayment<RecordRentPaymentInput, { success: true; net_amount: string }> = async (
  input,
  context,
) => {
  const user = await assertRole(context.user, PAYMENT_AUTHORIZER_ROLES, context.entities, "recordRentPayment");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");

  const lease = await context.entities.Lease.findUnique({
    where: { id: input.leaseId },
    include: { landlord: true },
  });
  if (!lease || lease.org_id !== user.org_id) {
    throw new HttpError(404, "Lease not found.");
  }
  await assertOfficeScope(user, lease.office_id, context.entities, "recordRentPayment");

  const installmentDue = new Date(input.due_date);
  if (Number.isNaN(installmentDue.getTime())) {
    throw new HttpError(400, "Due date is required.");
  }
  if (
    installmentDue.getTime() < lease.start_date.getTime() ||
    installmentDue.getTime() > lease.end_date.getTime()
  ) {
    throw new HttpError(400, "Due date must fall within the lease term.");
  }

  // Must key off the exact same period math obligationGenerationJob used to
  // create the instance (the most recently *closed* period whose window is
  // open), not "the period containing due_date" -- those are different
  // periods whenever due_date falls on/after a boundary (i.e. almost
  // always), which silently desynced every rent/CAM payment from its
  // ObligationInstance and left obligation history stuck on "expected".
  const schedule = await context.entities.RecurringObligationSchedule.findFirst({
    where: { scope_type: input.type, scope_ref_id: lease.id },
  });
  const scheduleAnchor = schedule?.active_from ?? lease.rent_due_anchor_date ?? lease.start_date;
  const expectedWindowDays = schedule?.expected_window_days ?? 7;
  const resolvedPeriod = obligationPeriodToGenerate(scheduleAnchor, "monthly", installmentDue, expectedWindowDays);
  if (!resolvedPeriod) {
    throw new HttpError(400, "No billing period is currently due for this date.");
  }
  const period = resolvedPeriod.key;

  const grossAmount = input.type === "rent" ? lease.rent_amount : lease.cam_amount;
  if (grossAmount === null || grossAmount === undefined) {
    throw new HttpError(400, `This lease has no ${input.type} amount configured.`);
  }
  const gross = Number(grossAmount);

  if (
    user.authorization_limit !== null &&
    user.authorization_limit !== undefined &&
    gross > Number(user.authorization_limit)
  ) {
    throw new HttpError(400, "This amount exceeds your authorization limit.");
  }

  // TDS only applies to rent, per F-13's title and purpose -- CAM is a
  // service-charge reimbursement, not rent income.
  let tdsAmount = 0;
  let netAmount = gross;
  if (input.type === "rent" && lease.landlord.tds_applicable) {
    const org = await context.entities.Organization.findUnique({ where: { id: user.org_id } });
    const ratePct = lease.landlord.tds_rate_pct ?? org?.default_tds_rate_pct ?? null;
    const result = calculateTds(gross, ratePct === null ? null : Number(ratePct));
    tdsAmount = result.tdsAmount;
    netAmount = result.netAmount;
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const payableType = input.type; // "rent" | "cam" matches PayableType enum values

        const duplicate = await tx.payment.findFirst({
          where: { payable_type: payableType, lease_id: lease.id, period },
        });
        if (duplicate) {
          throw new HttpError(400, `A ${input.type} payment for period ${period} has already been recorded.`);
        }

        const payment = await tx.payment.create({
          data: {
            org_id: user.org_id!,
            payable_type: payableType,
            payable_id: lease.id,
            lease_id: lease.id,
            period,
            due_date: installmentDue,
            amount: gross,
            tds_amount: tdsAmount || null,
            net_amount: netAmount,
            mode: input.mode,
            status: "paid",
            authorized_by: user.id,
          },
        });

        await markRentCamObligationReceived(tx, lease.id, payableType, period, payment.id);

        await tx.auditLog.create({
          data: {
            org_id: user.org_id!,
            actor_user_id: user.id,
            entity_type: "Lease",
            entity_id: lease.id,
            action: `${input.type}_payment_recorded`,
            after_value: {
              payment_id: payment.id,
              period,
              due_date: input.due_date,
              amount: gross,
              tds_amount: tdsAmount,
              net_amount: netAmount,
            },
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

  return { success: true, net_amount: netAmount.toString() };
};

export const listRentPayments: ListRentPayments<
  { leaseId: string },
  Array<{
    id: string;
    payable_type: string;
    period: string | null;
    due_date: string | null;
    amount: string;
    tds_amount: string | null;
    net_amount: string;
    mode: string;
  }>
> = async ({ leaseId }, context) => {
  const user = await assertRole(
    context.user,
    ["platform_admin", "office_admin", "payment_authorizer"],
    context.entities,
    "listRentPayments",
  );

  const lease = await context.entities.Lease.findUnique({ where: { id: leaseId } });
  if (!lease || lease.org_id !== user.org_id) {
    throw new HttpError(404, "Lease not found.");
  }
  await assertOfficeScope(user, lease.office_id, context.entities, "listRentPayments");

  const payments = await context.entities.Payment.findMany({
    where: { lease_id: leaseId },
    orderBy: { period: "desc" },
  });

  return payments.map((p) => ({
    id: p.id,
    payable_type: p.payable_type,
    period: p.period,
    due_date: p.due_date ? p.due_date.toISOString() : null,
    amount: p.amount.toString(),
    tds_amount: p.tds_amount === null ? null : p.tds_amount.toString(),
    net_amount: p.net_amount.toString(),
    mode: p.mode,
  }));
};
