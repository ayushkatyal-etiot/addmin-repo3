import { HttpError } from "wasp/server";
import type {
  CreateMaintenanceRequest,
  ListMaintenanceRequests,
  GetMaintenanceRequest,
  CreateWorkOrder,
  UpdateWorkOrderStatus,
  UploadWorkOrderEvidence,
  VerifyWorkOrder,
} from "wasp/server/operations";
import { assertRole, assertOfficeScope, userFromSession, type Role } from "../shared/authz";

// Build Step 08 (planmysaas-blueprint/08-build-playbook.md): Facility &
// Maintenance Module, F-15. Anyone office-scoped can report a fault
// (Employee/Facility Staff per the user flow); only Office Admin creates
// the Work Order and gives the final verification, mirroring F-10's
// maker-checker split rather than letting the reporter also close their
// own request.
export const REQUEST_CREATE_ROLES: Role[] = ["platform_admin", "office_admin", "facility_staff", "employee"];
export const WORK_ORDER_ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];
export const WORK_ORDER_EXECUTOR_ROLES: Role[] = ["platform_admin", "office_admin", "facility_staff"];

type CreateMaintenanceRequestInput = {
  office_id: string;
  category: string;
  priority: string;
  description?: string;
};

export const createMaintenanceRequest: CreateMaintenanceRequest<CreateMaintenanceRequestInput, { id: string }> = async (
  input,
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, REQUEST_CREATE_ROLES, context.entities, "createMaintenanceRequest");
  await assertOfficeScope(user, input.office_id, context.entities, "createMaintenanceRequest");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");
  if (!input.category.trim()) throw new HttpError(400, "Category is required.");

  const request = await context.entities.MaintenanceRequest.create({
    data: {
      org_id: user.org_id,
      office_id: input.office_id,
      category: input.category.trim(),
      priority: input.priority as never,
      status: "open",
    },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "MaintenanceRequest",
      entity_id: request.id,
      action: "created",
      after_value: { category: request.category, priority: request.priority, description: input.description ?? null },
    },
  });

  return { id: request.id };
};

export const listMaintenanceRequests: ListMaintenanceRequests<
  { officeId: string },
  Array<{
    id: string;
    category: string;
    priority: string;
    status: string;
    work_order_status: string | null;
  }>
> = async ({ officeId }, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, REQUEST_CREATE_ROLES, context.entities, "listMaintenanceRequests");
  await assertOfficeScope(user, officeId, context.entities, "listMaintenanceRequests");

  // F-15's "full service history ... viewable chronologically" -- newest
  // first is the practical default (matches every other list page), the
  // detail page reads as a full chronological trail (request -> work order
  // -> evidence -> verification) top to bottom.
  const requests = await context.entities.MaintenanceRequest.findMany({
    where: { office_id: officeId },
    include: { workOrder: true },
    orderBy: { id: "desc" },
  });

  return requests.map((r) => ({
    id: r.id,
    category: r.category,
    priority: r.priority,
    status: r.status,
    work_order_status: r.workOrder?.status ?? null,
  }));
};

export const getMaintenanceRequest: GetMaintenanceRequest<
  { id: string },
  {
    id: string;
    office_id: string;
    category: string;
    priority: string;
    status: string;
    workOrder: {
      id: string;
      vendor_id: string | null;
      vendor_name: string | null;
      sla_due_at: string;
      status: string;
      verification_remark: string | null;
      evidence: Array<{
        id: string;
        kind: string;
        doc_ref: string;
        comment: string | null;
        uploaded_by: string;
        uploaded_at: string;
      }>;
    } | null;
  }
> = async ({ id }, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, REQUEST_CREATE_ROLES, context.entities, "getMaintenanceRequest");

  const request = await context.entities.MaintenanceRequest.findUnique({
    where: { id },
    include: {
      workOrder: { include: { vendor: true, evidence: { orderBy: { uploaded_at: "asc" } } } },
    },
  });
  if (!request || request.org_id !== user.org_id) {
    throw new HttpError(404, "Maintenance request not found.");
  }
  await assertOfficeScope(user, request.office_id, context.entities, "getMaintenanceRequest");

  return {
    id: request.id,
    office_id: request.office_id,
    category: request.category,
    priority: request.priority,
    status: request.status,
    workOrder: request.workOrder
      ? {
          id: request.workOrder.id,
          vendor_id: request.workOrder.vendor_id,
          vendor_name: request.workOrder.vendor?.name ?? null,
          sla_due_at: request.workOrder.sla_due_at.toISOString(),
          status: request.workOrder.status,
          verification_remark: request.workOrder.verification_remark,
          evidence: request.workOrder.evidence.map((e) => ({
            id: e.id,
            kind: e.kind,
            doc_ref: e.doc_ref,
            comment: e.comment,
            uploaded_by: e.uploaded_by,
            uploaded_at: e.uploaded_at.toISOString(),
          })),
        }
      : null,
  };
};

type CreateWorkOrderInput = {
  maintenance_request_id: string;
  vendor_id?: string;
  sla_due_at: string;
};

// F-15 edge case: "no eligible vendor available -- request remains Open
// with a visible gap flagged to the Office Admin" -- vendor_id is
// therefore optional, not a hard requirement to route the request at all.
export const createWorkOrder: CreateWorkOrder<CreateWorkOrderInput, { id: string }> = async (input, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, WORK_ORDER_ADMIN_ROLES, context.entities, "createWorkOrder");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");

  const request = await context.entities.MaintenanceRequest.findUnique({
    where: { id: input.maintenance_request_id },
    include: { workOrder: true },
  });
  if (!request || request.org_id !== user.org_id) {
    throw new HttpError(404, "Maintenance request not found.");
  }
  await assertOfficeScope(user, request.office_id, context.entities, "createWorkOrder");
  if (request.workOrder) {
    throw new HttpError(400, "This request already has a work order.");
  }

  if (input.vendor_id) {
    const vendor = await context.entities.Vendor.findUnique({ where: { id: input.vendor_id } });
    if (!vendor || vendor.org_id !== user.org_id) {
      throw new HttpError(404, "Vendor not found.");
    }
    // F-14: a vendor pending activation cannot be assigned to any work order.
    if (vendor.status === "pending_activation") {
      throw new HttpError(400, "This vendor is pending activation and cannot be assigned to a work order.");
    }
  }

  const slaDueAt = new Date(input.sla_due_at);
  if (Number.isNaN(slaDueAt.getTime())) {
    throw new HttpError(400, "SLA due date is required.");
  }

  const workOrder = await context.entities.WorkOrder.create({
    data: {
      org_id: user.org_id,
      maintenance_request_id: request.id,
      vendor_id: input.vendor_id || null,
      sla_due_at: slaDueAt,
      status: "assigned",
    },
  });

  await context.entities.MaintenanceRequest.update({ where: { id: request.id }, data: { status: "assigned" } });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "WorkOrder",
      entity_id: workOrder.id,
      action: "created",
      after_value: { vendor_id: input.vendor_id ?? null, sla_due_at: input.sla_due_at },
    },
  });

  return { id: workOrder.id };
};

type UpdateWorkOrderStatusInput = {
  workOrderId: string;
  status: "in_progress" | "completed";
};

export const updateWorkOrderStatus: UpdateWorkOrderStatus<UpdateWorkOrderStatusInput, { success: true }> = async (
  input,
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, WORK_ORDER_EXECUTOR_ROLES, context.entities, "updateWorkOrderStatus");

  const workOrder = await context.entities.WorkOrder.findUnique({
    where: { id: input.workOrderId },
    include: { maintenanceRequest: true },
  });
  if (!workOrder || workOrder.org_id !== user.org_id) {
    throw new HttpError(404, "Work order not found.");
  }
  await assertOfficeScope(user, workOrder.maintenanceRequest.office_id, context.entities, "updateWorkOrderStatus");

  const validTransitions: Record<string, string[]> = {
    assigned: ["in_progress"],
    in_progress: ["completed"],
  };
  if (!validTransitions[workOrder.status]?.includes(input.status)) {
    throw new HttpError(400, `Cannot move a work order from ${workOrder.status} to ${input.status} directly.`);
  }

  await context.entities.WorkOrder.update({ where: { id: workOrder.id }, data: { status: input.status } });
  // Mirror the work order's progress onto the parent request so the list
  // page's status column stays meaningful without a second lookup.
  await context.entities.MaintenanceRequest.update({
    where: { id: workOrder.maintenance_request_id },
    data: { status: input.status === "completed" ? "resolved" : "in_progress" },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "WorkOrder",
      entity_id: workOrder.id,
      action: `status_${input.status}`,
    },
  });

  return { success: true };
};

type UploadWorkOrderEvidenceInput = {
  workOrderId: string;
  kind: "before" | "after";
  doc_ref: string;
  comment?: string;
};

// F-15 edge case: "upload fails during field submission -- request data is
// still saved, media can be added when connectivity resumes" -- this is
// exactly why evidence is its own append-only row rather than a field on
// WorkOrder: a failed/retried upload never risks the work order's own state.
export const uploadWorkOrderEvidence: UploadWorkOrderEvidence<UploadWorkOrderEvidenceInput, { id: string }> = async (
  input,
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, WORK_ORDER_EXECUTOR_ROLES, context.entities, "uploadWorkOrderEvidence");

  const workOrder = await context.entities.WorkOrder.findUnique({
    where: { id: input.workOrderId },
    include: { maintenanceRequest: true },
  });
  if (!workOrder || workOrder.org_id !== user.org_id) {
    throw new HttpError(404, "Work order not found.");
  }
  await assertOfficeScope(user, workOrder.maintenanceRequest.office_id, context.entities, "uploadWorkOrderEvidence");
  if (!input.doc_ref.trim()) {
    throw new HttpError(400, "A file reference is required.");
  }

  const evidence = await context.entities.WorkOrderEvidence.create({
    data: {
      org_id: user.org_id!,
      work_order_id: workOrder.id,
      kind: input.kind,
      doc_ref: input.doc_ref.trim(),
      comment: input.comment?.trim() || null,
      uploaded_by: user.id,
    },
  });

  return { id: evidence.id };
};

type VerifyWorkOrderInput = {
  workOrderId: string;
  decision: "verified" | "reopen";
  remark?: string;
};

// F-15: "Work order cannot be closed without Admin verification following
// vendor completion" + the reopen edge case in the same action, mirroring
// approveUtilityBill's approve/reject-with-remark shape from Step 07.
export const verifyWorkOrder: VerifyWorkOrder<VerifyWorkOrderInput, { success: true }> = async (input, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, WORK_ORDER_ADMIN_ROLES, context.entities, "verifyWorkOrder");

  if (input.decision === "reopen" && !input.remark?.trim()) {
    throw new HttpError(400, "A remark is required to reopen a work order.");
  }

  const workOrder = await context.entities.WorkOrder.findUnique({
    where: { id: input.workOrderId },
    include: { maintenanceRequest: true },
  });
  if (!workOrder || workOrder.org_id !== user.org_id) {
    throw new HttpError(404, "Work order not found.");
  }
  await assertOfficeScope(user, workOrder.maintenanceRequest.office_id, context.entities, "verifyWorkOrder");
  if (workOrder.status !== "completed") {
    throw new HttpError(400, "Only a completed work order can be verified.");
  }

  const newWorkOrderStatus = input.decision === "verified" ? "verified" : "in_progress";
  const newRequestStatus = input.decision === "verified" ? "closed" : "in_progress";

  await context.entities.WorkOrder.update({
    where: { id: workOrder.id },
    data: {
      status: newWorkOrderStatus,
      verification_remark: input.decision === "reopen" ? input.remark!.trim() : null,
    },
  });
  await context.entities.MaintenanceRequest.update({
    where: { id: workOrder.maintenance_request_id },
    data: { status: newRequestStatus },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "WorkOrder",
      entity_id: workOrder.id,
      action: input.decision === "verified" ? "verified_closed" : "reopened",
      after_value: { remark: input.remark?.trim() ?? null },
    },
  });

  return { success: true };
};
