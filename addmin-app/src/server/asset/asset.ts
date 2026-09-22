import { HttpError } from "wasp/server";
import type {
  CreateAsset,
  BulkImportAssets,
  ListAssets,
  GetAsset,
  SetAssetStatus,
  CreateAssetRequest,
  ListMyAssetRequests,
  ListPendingManagerApprovals,
  ListAssetRequestsForOffice,
  GetAssetRequest,
  DecideAssetRequestAsManager,
  AllocateAssetRequest,
  MarkAssetRequestProcurementPending,
} from "wasp/server/operations";
import { assertRole, assertOfficeScope, userFromSession, ALL_ROLES, type Role } from "../shared/authz";
import { parseCsv } from "../shared/csv";

// Build Step 08 (planmysaas-blueprint/08-build-playbook.md): Asset Module,
// F-16. Office Admin owns the register; Employee -> Manager -> Admin is the
// request lifecycle, deliberately not reusing WorkflowDefinition/
// ApprovalStep (Step 07) -- those are amount-tiered payment routing, this is
// a single fixed approver (the requester's manager), a different shape.
export const ASSET_ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];

type CreateAssetInput = {
  office_id: string;
  category: string;
  serial_no?: string;
  warranty_end?: string;
  initial_custodian_user_id?: string;
};

export const createAsset: CreateAsset<CreateAssetInput, { id: string }> = async (input, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ASSET_ADMIN_ROLES, context.entities, "createAsset");
  await assertOfficeScope(user, input.office_id, context.entities, "createAsset");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");
  if (!input.category.trim()) throw new HttpError(400, "Category is required.");

  let custodian: Awaited<ReturnType<typeof context.entities.User.findFirst>> = null;
  if (input.initial_custodian_user_id) {
    custodian = await context.entities.User.findFirst({
      where: { id: input.initial_custodian_user_id, org_id: user.org_id },
    });
    if (!custodian) throw new HttpError(404, "Initial custodian not found in this organization.");
  }

  const asset = await context.entities.Asset.create({
    data: {
      org_id: user.org_id,
      office_id: input.office_id,
      category: input.category.trim(),
      serial_no: input.serial_no?.trim() || null,
      warranty_end: input.warranty_end ? new Date(input.warranty_end) : null,
      status: custodian ? "assigned" : "available",
    },
  });

  if (custodian) {
    await context.entities.AssetAssignment.create({
      data: { org_id: user.org_id, asset_id: asset.id, custodian_user_id: custodian.id },
    });
  }

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "Asset",
      entity_id: asset.id,
      action: "created",
      after_value: { category: asset.category, serial_no: asset.serial_no },
    },
  });

  return { id: asset.id };
};

type BulkImportRowResult = { row: number; success: boolean; assetId?: string; error?: string };

// F-16: "Bulk asset import validates rows and reports per-row errors
// without failing the whole batch" -- one row, one try/catch, same shape as
// bulkImportOffices (organization/office.ts). Columns:
// office_code,category,serial_no,warranty_end
export const bulkImportAssets: BulkImportAssets<{ csv: string }, { results: BulkImportRowResult[] }> = async (
  { csv },
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ASSET_ADMIN_ROLES, context.entities, "bulkImportAssets");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");

  const rows = parseCsv(csv);
  if (rows.length === 0) {
    throw new HttpError(400, "CSV has no data rows.");
  }

  const results: BulkImportRowResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // header is row 1
    try {
      if (!row.office_code?.trim()) throw new HttpError(400, "office_code is required.");
      if (!row.category?.trim()) throw new HttpError(400, "category is required.");

      const office = await context.entities.Office.findUnique({
        where: { org_id_code: { org_id: user.org_id, code: row.office_code.trim().toUpperCase() } },
      });
      if (!office) throw new HttpError(400, `No office with code "${row.office_code}".`);
      await assertOfficeScope(user, office.id, context.entities, "bulkImportAssets");

      const asset = await context.entities.Asset.create({
        data: {
          org_id: user.org_id,
          office_id: office.id,
          category: row.category.trim(),
          serial_no: row.serial_no?.trim() || null,
          warranty_end: row.warranty_end?.trim() ? new Date(row.warranty_end.trim()) : null,
          status: "available",
        },
      });
      await context.entities.AuditLog.create({
        data: {
          org_id: user.org_id,
          actor_user_id: user.id,
          entity_type: "Asset",
          entity_id: asset.id,
          action: "created_via_bulk_import",
          after_value: { category: asset.category },
        },
      });
      results.push({ row: rowNumber, success: true, assetId: asset.id });
    } catch (err) {
      results.push({
        row: rowNumber,
        success: false,
        error: err instanceof HttpError ? err.message : "Unexpected error.",
      });
    }
  }

  return { results };
};

export const listAssets: ListAssets<
  { officeId: string },
  Array<{ id: string; category: string; serial_no: string | null; status: string; warranty_end: string | null }>
> = async ({ officeId }, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ASSET_ADMIN_ROLES, context.entities, "listAssets");
  await assertOfficeScope(user, officeId, context.entities, "listAssets");

  const assets = await context.entities.Asset.findMany({
    where: { office_id: officeId },
    orderBy: { category: "asc" },
  });

  return assets.map((a) => ({
    id: a.id,
    category: a.category,
    serial_no: a.serial_no,
    status: a.status,
    warranty_end: a.warranty_end ? a.warranty_end.toISOString() : null,
  }));
};

export const getAsset: GetAsset<
  { id: string },
  {
    id: string;
    office_id: string;
    category: string;
    serial_no: string | null;
    status: string;
    warranty_end: string | null;
    assignments: Array<{
      id: string;
      custodian_email: string | null;
      assigned_at: string;
      unassigned_at: string | null;
    }>;
  }
> = async ({ id }, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ASSET_ADMIN_ROLES, context.entities, "getAsset");

  const asset = await context.entities.Asset.findUnique({
    where: { id },
    include: { assignments: { include: { custodian: true }, orderBy: { assigned_at: "desc" } } },
  });
  if (!asset || asset.org_id !== user.org_id) {
    throw new HttpError(404, "Asset not found.");
  }
  await assertOfficeScope(user, asset.office_id, context.entities, "getAsset");

  return {
    id: asset.id,
    office_id: asset.office_id,
    category: asset.category,
    serial_no: asset.serial_no,
    status: asset.status,
    warranty_end: asset.warranty_end ? asset.warranty_end.toISOString() : null,
    assignments: asset.assignments.map((a) => ({
      id: a.id,
      custodian_email: a.custodian.email,
      assigned_at: a.assigned_at.toISOString(),
      unassigned_at: a.unassigned_at ? a.unassigned_at.toISOString() : null,
    })),
  };
};

// F-16 edge case: "Asset marked Retired still shows historical
// assignment/service records for audit, but can't be reassigned" --
// allocateAssetRequest below only ever selects status "available", so
// retiring here is the actual enforcement point, not a UI-only hide.
export const setAssetStatus: SetAssetStatus<{ id: string; status: "under_service" | "available" | "retired" }, { success: true }> = async (
  { id, status },
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ASSET_ADMIN_ROLES, context.entities, "setAssetStatus");

  const asset = await context.entities.Asset.findUnique({ where: { id } });
  if (!asset || asset.org_id !== user.org_id) {
    throw new HttpError(404, "Asset not found.");
  }
  await assertOfficeScope(user, asset.office_id, context.entities, "setAssetStatus");
  if (asset.status === "assigned") {
    throw new HttpError(400, "This asset is currently assigned to a custodian. Unassign it via an asset request/return first.");
  }

  await context.entities.Asset.update({ where: { id }, data: { status } });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "Asset",
      entity_id: asset.id,
      action: `status_${status}`,
    },
  });

  return { success: true };
};

type CreateAssetRequestInput = {
  office_id: string;
  category: string;
  reason: string;
};

// F-16: platform_admin sits at the top of the hierarchy and skips the
// manager step (routes straight to pending_allocation); every other role
// needs a manager_user_id on file (updateUserManager, organization/office.ts)
// -- there's no one else who could approve their request.
export const createAssetRequest: CreateAssetRequest<CreateAssetRequestInput, { id: string }> = async (
  input,
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ALL_ROLES, context.entities, "createAssetRequest");
  await assertOfficeScope(user, input.office_id, context.entities, "createAssetRequest");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");
  if (!input.category.trim()) throw new HttpError(400, "Category is required.");
  if (!input.reason.trim()) throw new HttpError(400, "A reason is required.");

  let status: "pending_manager_approval" | "pending_allocation" = "pending_manager_approval";
  if (user.role === "platform_admin") {
    status = "pending_allocation";
  } else {
    const dbUser = await context.entities.User.findUnique({ where: { id: user.id } });
    if (!dbUser?.manager_user_id) {
      throw new HttpError(400, "You have no manager assigned. Ask an admin to set one before submitting a request.");
    }
  }

  const request = await context.entities.AssetRequest.create({
    data: {
      org_id: user.org_id,
      office_id: input.office_id,
      requested_by: user.id,
      category: input.category.trim(),
      reason: input.reason.trim(),
      status,
    },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "AssetRequest",
      entity_id: request.id,
      action: "created",
      after_value: { category: request.category },
    },
  });

  return { id: request.id };
};

type RequestSummary = {
  id: string;
  category: string;
  reason: string;
  status: string;
  requested_by_email: string | null;
  created_at: string;
};

function toSummary(r: {
  id: string;
  category: string;
  reason: string;
  status: string;
  created_at: Date;
  requestedBy: { email: string | null };
}): RequestSummary {
  return {
    id: r.id,
    category: r.category,
    reason: r.reason,
    status: r.status,
    requested_by_email: r.requestedBy.email,
    created_at: r.created_at.toISOString(),
  };
}

// F-16: "Employees can view the status of their own requests but not other
// employees' requests" -- enforced by scoping the query to requested_by,
// not by filtering client-side.
export const listMyAssetRequests: ListMyAssetRequests<void, RequestSummary[]> = async (_args, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ALL_ROLES, context.entities, "listMyAssetRequests");

  const requests = await context.entities.AssetRequest.findMany({
    where: { requested_by: user.id },
    include: { requestedBy: true },
    orderBy: { created_at: "desc" },
  });
  return requests.map(toSummary);
};

// Any role can be someone's manager (it's an org-chart fact, not a
// permission), so this deliberately allows every role -- ALL_ROLES here is
// "who might have direct reports," not a privilege escalation.
export const listPendingManagerApprovals: ListPendingManagerApprovals<void, RequestSummary[]> = async (
  _args,
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ALL_ROLES, context.entities, "listPendingManagerApprovals");

  const requests = await context.entities.AssetRequest.findMany({
    where: { status: "pending_manager_approval", requestedBy: { manager_user_id: user.id } },
    include: { requestedBy: true },
    orderBy: { created_at: "asc" },
  });
  return requests.map(toSummary);
};

export const listAssetRequestsForOffice: ListAssetRequestsForOffice<{ officeId: string }, RequestSummary[]> = async (
  { officeId },
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ASSET_ADMIN_ROLES, context.entities, "listAssetRequestsForOffice");
  await assertOfficeScope(user, officeId, context.entities, "listAssetRequestsForOffice");

  const requests = await context.entities.AssetRequest.findMany({
    where: { office_id: officeId },
    include: { requestedBy: true },
    orderBy: { created_at: "desc" },
  });
  return requests.map(toSummary);
};

export const getAssetRequest: GetAssetRequest<
  { id: string },
  RequestSummary & { office_id: string; manager_remark: string | null; admin_remark: string | null; allocated_asset_id: string | null }
> = async ({ id }, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ALL_ROLES, context.entities, "getAssetRequest");

  const request = await context.entities.AssetRequest.findUnique({
    where: { id },
    include: { requestedBy: true },
  });
  if (!request || request.org_id !== user.org_id) {
    throw new HttpError(404, "Asset request not found.");
  }

  const isOwner = request.requested_by === user.id;
  const isManager = request.requestedBy.manager_user_id === user.id;
  const isAdmin = user.role === "platform_admin" || user.role === "office_admin";
  if (!isOwner && !isManager && !isAdmin) {
    throw new HttpError(403, "You do not have access to this asset request.");
  }

  return {
    ...toSummary(request),
    office_id: request.office_id,
    manager_remark: request.manager_remark,
    admin_remark: request.admin_remark,
    allocated_asset_id: request.allocated_asset_id,
  };
};

type DecideAssetRequestInput = {
  requestId: string;
  decision: "approve" | "reject" | "return";
  remark?: string;
};

export const decideAssetRequestAsManager: DecideAssetRequestAsManager<DecideAssetRequestInput, { success: true }> = async (
  input,
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ALL_ROLES, context.entities, "decideAssetRequestAsManager");

  if ((input.decision === "reject" || input.decision === "return") && !input.remark?.trim()) {
    throw new HttpError(400, "A remark is required to reject or return a request.");
  }

  const request = await context.entities.AssetRequest.findUnique({
    where: { id: input.requestId },
    include: { requestedBy: true },
  });
  if (!request || request.org_id !== user.org_id) {
    throw new HttpError(404, "Asset request not found.");
  }
  if (request.requestedBy.manager_user_id !== user.id && user.role !== "platform_admin") {
    throw new HttpError(403, "This request is not routed to you for approval.");
  }
  if (request.status !== "pending_manager_approval") {
    throw new HttpError(400, "Only a request pending manager approval can be decided.");
  }

  const newStatus = input.decision === "approve" ? "pending_allocation" : input.decision === "reject" ? "rejected" : "returned";

  await context.entities.AssetRequest.update({
    where: { id: request.id },
    data: { status: newStatus, manager_remark: input.remark?.trim() || null },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "AssetRequest",
      entity_id: request.id,
      action: `manager_${input.decision}`,
      after_value: { remark: input.remark?.trim() ?? null },
    },
  });

  return { success: true };
};

// F-16: "If an existing asset is available, Office Admin allocates it
// directly and closes the request" -- works whether the request just came
// out of manager approval or has been sitting in procurement_pending, since
// both are valid predecessor states for "stock just became available."
export const allocateAssetRequest: AllocateAssetRequest<{ requestId: string; assetId: string }, { success: true }> = async (
  { requestId, assetId },
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ASSET_ADMIN_ROLES, context.entities, "allocateAssetRequest");

  const request = await context.entities.AssetRequest.findUnique({ where: { id: requestId } });
  if (!request || request.org_id !== user.org_id) {
    throw new HttpError(404, "Asset request not found.");
  }
  await assertOfficeScope(user, request.office_id, context.entities, "allocateAssetRequest");
  if (request.status !== "pending_allocation" && request.status !== "procurement_pending") {
    throw new HttpError(400, "Only a request awaiting allocation can be allocated.");
  }

  const asset = await context.entities.Asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.org_id !== user.org_id || asset.office_id !== request.office_id) {
    throw new HttpError(404, "Asset not found in this office.");
  }
  if (asset.status !== "available") {
    throw new HttpError(400, "Only an available asset can be allocated.");
  }

  await context.entities.Asset.update({ where: { id: asset.id }, data: { status: "assigned" } });
  await context.entities.AssetAssignment.create({
    data: { org_id: user.org_id!, asset_id: asset.id, custodian_user_id: request.requested_by },
  });
  await context.entities.AssetRequest.update({
    where: { id: request.id },
    data: { status: "closed", allocated_asset_id: asset.id },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "AssetRequest",
      entity_id: request.id,
      action: "allocated_closed",
      after_value: { asset_id: asset.id },
    },
  });

  return { success: true };
};

// F-16: "the requirement is handed off to Procurement (outside AddMin) and
// the request stays open pending receipt" -- purely a status/remark record,
// AddMin has no procurement system to actually integrate with.
export const markAssetRequestProcurementPending: MarkAssetRequestProcurementPending<
  { requestId: string; remark?: string },
  { success: true }
> = async ({ requestId, remark }, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ASSET_ADMIN_ROLES, context.entities, "markAssetRequestProcurementPending");

  const request = await context.entities.AssetRequest.findUnique({ where: { id: requestId } });
  if (!request || request.org_id !== user.org_id) {
    throw new HttpError(404, "Asset request not found.");
  }
  await assertOfficeScope(user, request.office_id, context.entities, "markAssetRequestProcurementPending");
  if (request.status !== "pending_allocation") {
    throw new HttpError(400, "Only a request awaiting allocation can be flagged for procurement.");
  }

  await context.entities.AssetRequest.update({
    where: { id: request.id },
    data: { status: "procurement_pending", admin_remark: remark?.trim() || null },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "AssetRequest",
      entity_id: request.id,
      action: "procurement_pending",
      after_value: { remark: remark?.trim() ?? null },
    },
  });

  return { success: true };
};
