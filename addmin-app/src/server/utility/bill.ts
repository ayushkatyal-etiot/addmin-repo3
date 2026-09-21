import { HttpError } from "wasp/server";
import type {
  CreateUtilityBill,
  UpdateUtilityBill,
  SubmitUtilityBill,
  ListUtilityBills,
  GetUtilityBill,
} from "wasp/server/operations";
import { assertRole, assertOfficeScope, type Role } from "../shared/authz";
import { resolveApprovalRoute } from "../workflow/approval";
import { linkUtilityBillToObligation, normalizeBillingPeriodKey } from "../obligation/instanceLifecycle";

// Build Step 07 (planmysaas-blueprint/08-build-playbook.md): Bill lifecycle
// -- entry (this file), approval (../workflow/approval.ts), payment
// (../payment/payment.ts). Reuses OFFICE_ADMIN_ROLES-style Maker grouping
// from Step 04/06 rather than inventing a separate "maker" role.
const MAKER_ROLES: Role[] = ["platform_admin", "office_admin"];

type CreateUtilityBillInput = {
  utility_account_id: string;
  billing_period: string;
  amount: number;
  due_date: string;
  invoice_doc_id?: string;
};

export const createUtilityBill: CreateUtilityBill<CreateUtilityBillInput, { id: string }> = async (
  input,
  context,
) => {
  const user = await assertRole(context.user, MAKER_ROLES, context.entities, "createUtilityBill");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");

  if (!(input.amount > 0)) throw new HttpError(400, "Bill amount must be greater than 0.");
  if (!input.due_date) throw new HttpError(400, "Due date is required.");

  const account = await context.entities.UtilityAccount.findUnique({ where: { id: input.utility_account_id } });
  if (!account || account.org_id !== user.org_id) {
    throw new HttpError(404, "Utility connection not found.");
  }
  await assertOfficeScope(user, account.office_id, context.entities, "createUtilityBill");

  // F-09: duplicate account + billing period flagged before submission --
  // checked here at entry time so a duplicate is never even created.
  const billingPeriod = normalizeBillingPeriodKey(input.billing_period);

  const duplicate = await context.entities.UtilityBill.findFirst({
    where: { utility_account_id: input.utility_account_id, billing_period: billingPeriod },
  });
  if (duplicate) {
    throw new HttpError(400, "A bill for this account and billing period already exists.");
  }

  const bill = await context.entities.UtilityBill.create({
    data: {
      org_id: user.org_id,
      utility_account_id: input.utility_account_id,
      billing_period: billingPeriod,
      amount: input.amount,
      due_date: new Date(input.due_date),
      invoice_doc_id: input.invoice_doc_id || null,
      created_by: user.id,
      status: "draft",
    },
  });

  await linkUtilityBillToObligation(context.entities, bill);

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "UtilityBill",
      entity_id: bill.id,
      action: "created",
      after_value: { amount: bill.amount.toString(), billing_period: bill.billing_period },
    },
  });

  return { id: bill.id };
};

type UpdateUtilityBillInput = {
  billId: string;
  amount: number;
  due_date: string;
  invoice_doc_id?: string;
};

// F-09/edge case: amendment only allowed before approval, every amendment audited.
export const updateUtilityBill: UpdateUtilityBill<UpdateUtilityBillInput, { success: true }> = async (
  input,
  context,
) => {
  const user = await assertRole(context.user, MAKER_ROLES, context.entities, "updateUtilityBill");

  const bill = await context.entities.UtilityBill.findUnique({ where: { id: input.billId } });
  if (!bill || bill.org_id !== user.org_id) {
    throw new HttpError(404, "Bill not found.");
  }
  if (bill.status !== "draft") {
    throw new HttpError(400, "Only bills in draft can be amended.");
  }
  if (!(input.amount > 0)) throw new HttpError(400, "Bill amount must be greater than 0.");
  if (!input.due_date) throw new HttpError(400, "Due date is required.");

  await context.entities.UtilityBill.update({
    where: { id: input.billId },
    data: {
      amount: input.amount,
      due_date: new Date(input.due_date),
      invoice_doc_id: input.invoice_doc_id || null,
    },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "UtilityBill",
      entity_id: bill.id,
      action: "amended",
      before_value: { amount: bill.amount.toString(), due_date: bill.due_date },
      after_value: { amount: input.amount, due_date: input.due_date },
    },
  });

  return { success: true };
};

export const submitUtilityBill: SubmitUtilityBill<{ billId: string }, { success: true }> = async (
  { billId },
  context,
) => {
  const user = await assertRole(context.user, MAKER_ROLES, context.entities, "submitUtilityBill");

  const bill = await context.entities.UtilityBill.findUnique({ where: { id: billId } });
  if (!bill || bill.org_id !== user.org_id) {
    throw new HttpError(404, "Bill not found.");
  }
  if (bill.status !== "draft") {
    throw new HttpError(400, "Only bills in draft can be submitted.");
  }

  const account = await context.entities.UtilityAccount.findUnique({ where: { id: bill.utility_account_id } });
  if (!account) throw new HttpError(404, "Utility connection not found.");

  const route = await resolveApprovalRoute(context.entities, {
    org_id: user.org_id!,
    office_id: account.office_id,
    scope_type: "utility",
    amount: Number(bill.amount),
  });
  if (!route) {
    throw new HttpError(
      400,
      "No approver configured for this office/utility combination. Configure it under /admin/workflow first.",
    );
  }

  await context.entities.ApprovalStep.create({
    data: {
      org_id: user.org_id!,
      payable_type: "utility_bill",
      payable_id: bill.id,
      utility_bill_id: bill.id,
      tier: route.tier,
      approver_user_id: route.approver_user_id,
      status: "pending",
    },
  });

  await context.entities.UtilityBill.update({
    where: { id: bill.id },
    data: { status: "pending_approval" },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "UtilityBill",
      entity_id: bill.id,
      action: "submitted",
      after_value: { status: "pending_approval", approver_user_id: route.approver_user_id },
    },
  });

  return { success: true };
};

export const listUtilityBills: ListUtilityBills<
  { officeId: string },
  Array<{
    id: string;
    billing_period: string;
    amount: string;
    due_date: string;
    status: string;
    provider_name: string;
  }>
> = async ({ officeId }, context) => {
  const user = await assertRole(
    context.user,
    ["platform_admin", "office_admin", "office_head", "checker", "payment_authorizer"],
    context.entities,
    "listUtilityBills",
  );
  await assertOfficeScope(user, officeId, context.entities, "listUtilityBills");

  const bills = await context.entities.UtilityBill.findMany({
    where: { utilityAccount: { office_id: officeId } },
    include: { utilityAccount: true },
    orderBy: { due_date: "desc" },
  });

  return bills.map((b) => ({
    id: b.id,
    billing_period: b.billing_period,
    amount: b.amount.toString(),
    due_date: b.due_date.toISOString(),
    status: b.status,
    provider_name: b.utilityAccount.provider_name,
  }));
};

export const getUtilityBill: GetUtilityBill<
  { billId: string },
  {
    id: string;
    office_id: string;
    billing_period: string;
    amount: string;
    due_date: string;
    status: string;
    provider_name: string;
    created_by: string | null;
    paid_amount: string;
    approvalSteps: Array<{
      id: string;
      tier: number;
      approver_user_id: string;
      status: string;
      remark: string | null;
      acted_at: string | null;
    }>;
    payments: Array<{
      id: string;
      amount: string;
      net_amount: string;
      status: string;
      authorized_by: string | null;
    }>;
  }
> = async ({ billId }, context) => {
  const user = await assertRole(
    context.user,
    ["platform_admin", "office_admin", "office_head", "checker", "payment_authorizer"],
    context.entities,
    "getUtilityBill",
  );

  const bill = await context.entities.UtilityBill.findUnique({
    where: { id: billId },
    include: { utilityAccount: true, approvalSteps: { orderBy: { created_at: "asc" } }, payments: true },
  });
  if (!bill || bill.org_id !== user.org_id) {
    throw new HttpError(404, "Bill not found.");
  }
  await assertOfficeScope(user, bill.utilityAccount.office_id, context.entities, "getUtilityBill");

  const paidAmount = bill.payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    id: bill.id,
    office_id: bill.utilityAccount.office_id,
    billing_period: bill.billing_period,
    amount: bill.amount.toString(),
    due_date: bill.due_date.toISOString(),
    status: bill.status,
    provider_name: bill.utilityAccount.provider_name,
    created_by: bill.created_by,
    paid_amount: paidAmount.toString(),
    approvalSteps: bill.approvalSteps.map((s) => ({
      id: s.id,
      tier: s.tier,
      approver_user_id: s.approver_user_id,
      status: s.status,
      remark: s.remark,
      acted_at: s.acted_at ? s.acted_at.toISOString() : null,
    })),
    payments: bill.payments.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      net_amount: p.net_amount.toString(),
      status: p.status,
      authorized_by: p.authorized_by,
    })),
  };
};
