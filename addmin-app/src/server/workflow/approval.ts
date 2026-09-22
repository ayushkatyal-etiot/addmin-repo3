import { HttpError } from "wasp/server";
import type { PrismaClient } from "@prisma/client";
import type {
  ApproveUtilityBill,
  ListApprovalQueue,
  CreateWorkflowDefinition,
  ListWorkflowDefinitions,
  DeleteWorkflowDefinition,
} from "wasp/server/operations";
import { assertRole, type Role } from "../shared/authz";

// Build Step 07: Workflow & Approval Module. Reused as-is by Step 08's
// Lease/AMC/Compliance approvals (see schema.prisma's WorkflowDefinition
// header) -- scope_type is a real discriminator, never "utility" hardcoded.
export const WORKFLOW_ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];
export const CHECKER_ROLES: Role[] = ["platform_admin", "checker"];

type RouteEntities = {
  WorkflowDefinition: PrismaClient["workflowDefinition"];
};

/**
 * Picks the smallest-max_amount tier that still covers `amount`, preferring
 * an office-specific tier over the org-wide default (office_id: null).
 * Snapshot this result into ApprovalStep at submission time -- never
 * re-resolve at approval time, so a later threshold edit doesn't move an
 * in-flight bill's approver (F-10 edge case).
 */
export async function resolveApprovalRoute(
  entities: RouteEntities,
  input: { org_id: string; office_id: string; scope_type: "utility" | "rent" | "cam" | "amc" | "compliance"; amount: number },
): Promise<{ tier: number; approver_user_id: string } | null> {
  const officeTiers = await entities.WorkflowDefinition.findMany({
    where: { org_id: input.org_id, office_id: input.office_id, scope_type: input.scope_type },
    orderBy: { tier: "asc" },
  });
  const orgWideTiers = await entities.WorkflowDefinition.findMany({
    where: { org_id: input.org_id, office_id: null, scope_type: input.scope_type },
    orderBy: { tier: "asc" },
  });

  const tiers = officeTiers.length > 0 ? officeTiers : orgWideTiers;
  const match = tiers.find((t) => t.max_amount === null || input.amount <= Number(t.max_amount));
  if (!match) return null;

  return { tier: match.tier, approver_user_id: match.approver_user_id };
}

type ApproveUtilityBillInput = {
  billId: string;
  decision: "approve" | "reject" | "return";
  remark?: string;
};

// F-10: maker-checker segregation + reject/return remark, enforced server-side.
export const approveUtilityBill: ApproveUtilityBill<ApproveUtilityBillInput, { success: true }> = async (
  input,
  context,
) => {
  const user = await assertRole(context.user, CHECKER_ROLES, context.entities, "approveUtilityBill");

  if ((input.decision === "reject" || input.decision === "return") && !input.remark?.trim()) {
    throw new HttpError(400, "A remark is required to reject or return a bill.");
  }

  const bill = await context.entities.UtilityBill.findUnique({ where: { id: input.billId } });
  if (!bill || bill.org_id !== user.org_id) {
    throw new HttpError(404, "Bill not found.");
  }
  if (bill.status !== "pending_approval") {
    throw new HttpError(400, "Only bills pending approval can be acted on.");
  }
  // No same-user exception is configured anywhere in this system today --
  // always reject, per the common-pitfalls note against a UI-only check.
  if (bill.created_by === user.id) {
    throw new HttpError(403, "You cannot approve a bill you created yourself.");
  }

  const step = await context.entities.ApprovalStep.findFirst({
    where: { utility_bill_id: bill.id, status: "pending" },
    orderBy: { created_at: "desc" },
  });
  if (!step || step.approver_user_id !== user.id) {
    throw new HttpError(403, "This bill is not routed to you for approval.");
  }

  // Concurrency guard: conditional update only succeeds if the step is still
  // pending -- a second concurrent decision on the same step loses the race
  // and gets a clean error instead of double-acting on it.
  const claimed = await context.entities.ApprovalStep.updateMany({
    where: { id: step.id, status: "pending" },
    data: {
      status: input.decision === "approve" ? "approved" : input.decision === "reject" ? "rejected" : "returned",
      remark: input.remark?.trim() || null,
      acted_at: new Date(),
    },
  });
  if (claimed.count === 0) {
    throw new HttpError(409, "This approval has already been actioned.");
  }

  const newBillStatus = input.decision === "approve" ? "approved" : input.decision === "reject" ? "rejected" : "draft";
  await context.entities.UtilityBill.update({
    where: { id: bill.id },
    data: { status: newBillStatus },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "UtilityBill",
      entity_id: bill.id,
      action: input.decision,
      before_value: { status: "pending_approval" },
      after_value: { status: newBillStatus, remark: input.remark?.trim() || null },
    },
  });

  return { success: true };
};

export const listApprovalQueue: ListApprovalQueue<
  void,
  Array<{
    stepId: string;
    billId: string;
    billing_period: string;
    amount: string;
    due_date: string;
    provider_name: string;
  }>
> = async (_args, context) => {
  const user = await assertRole(context.user, CHECKER_ROLES, context.entities, "listApprovalQueue");

  const steps = await context.entities.ApprovalStep.findMany({
    where: { org_id: user.org_id!, approver_user_id: user.id, status: "pending", payable_type: "utility_bill" },
    include: { utilityBill: { include: { utilityAccount: true } } },
    orderBy: { created_at: "asc" },
  });

  return steps
    .filter((s) => s.utilityBill)
    .map((s) => ({
      stepId: s.id,
      billId: s.utilityBill!.id,
      billing_period: s.utilityBill!.billing_period,
      amount: s.utilityBill!.amount.toString(),
      due_date: s.utilityBill!.due_date.toISOString(),
      provider_name: s.utilityBill!.utilityAccount.provider_name,
    }));
};

type CreateWorkflowDefinitionInput = {
  office_id?: string;
  scope_type: "utility" | "rent" | "cam" | "amc" | "compliance";
  tier: number;
  max_amount?: number;
  approver_user_id: string;
};

export const createWorkflowDefinition: CreateWorkflowDefinition<
  CreateWorkflowDefinitionInput,
  { id: string }
> = async (input, context) => {
  const user = await assertRole(context.user, WORKFLOW_ADMIN_ROLES, context.entities, "createWorkflowDefinition");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");

  const approver = await context.entities.User.findUnique({ where: { id: input.approver_user_id } });
  if (!approver || approver.org_id !== user.org_id) {
    throw new HttpError(404, "Approver not found in this organization.");
  }

  let definition;
  try {
    definition = await context.entities.WorkflowDefinition.create({
      data: {
        org_id: user.org_id,
        office_id: input.office_id || null,
        scope_type: input.scope_type,
        tier: input.tier,
        max_amount: input.max_amount ?? null,
        approver_user_id: input.approver_user_id,
      },
    });
  } catch {
    throw new HttpError(400, "A tier with this number already exists for this office/scope combination.");
  }

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "WorkflowDefinition",
      entity_id: definition.id,
      action: "created",
      after_value: { scope_type: input.scope_type, tier: input.tier, max_amount: input.max_amount ?? null },
    },
  });

  return { id: definition.id };
};

export const listWorkflowDefinitions: ListWorkflowDefinitions<
  void,
  Array<{
    id: string;
    office_id: string | null;
    scope_type: string;
    tier: number;
    max_amount: string | null;
    approver_user_id: string;
  }>
> = async (_args, context) => {
  const user = await assertRole(context.user, WORKFLOW_ADMIN_ROLES, context.entities, "listWorkflowDefinitions");

  const definitions = await context.entities.WorkflowDefinition.findMany({
    where: { org_id: user.org_id! },
    orderBy: [{ scope_type: "asc" }, { tier: "asc" }],
  });

  return definitions.map((d) => ({
    id: d.id,
    office_id: d.office_id,
    scope_type: d.scope_type,
    tier: d.tier,
    max_amount: d.max_amount === null ? null : d.max_amount.toString(),
    approver_user_id: d.approver_user_id,
  }));
};

export const deleteWorkflowDefinition: DeleteWorkflowDefinition<{ id: string }, { success: true }> = async (
  { id },
  context,
) => {
  const user = await assertRole(context.user, WORKFLOW_ADMIN_ROLES, context.entities, "deleteWorkflowDefinition");

  const definition = await context.entities.WorkflowDefinition.findUnique({ where: { id } });
  if (!definition || definition.org_id !== user.org_id) {
    throw new HttpError(404, "Workflow definition not found.");
  }

  await context.entities.WorkflowDefinition.delete({ where: { id } });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "WorkflowDefinition",
      entity_id: id,
      action: "deleted",
    },
  });

  return { success: true };
};
