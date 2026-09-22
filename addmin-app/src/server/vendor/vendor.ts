import { HttpError } from "wasp/server";
import type {
  CreateVendor,
  BulkImportVendors,
  ListVendors,
  GetVendor,
  ActivateVendor,
  RecordVendorPerformanceReview,
} from "wasp/server/operations";
import { assertRole, userFromSession, type Role } from "../shared/authz";
import { parseCsv } from "../shared/csv";

// Build Step 08 (planmysaas-blueprint/08-build-playbook.md): Vendor Module,
// F-14. Vendor is org-wide, not office-scoped (schema.prisma has no
// office_id on Vendor) -- the same vendor (e.g. a citywide DG servicing
// company) can be assigned across multiple offices' AMC contracts.
export const VENDOR_ADMIN_ROLES: Role[] = ["platform_admin", "vendor_manager"];
export const VENDOR_READ_ROLES: Role[] = [...VENDOR_ADMIN_ROLES, "office_admin", "facility_staff"];

type CreateVendorInput = {
  name: string;
  category: string;
  pan_gstin?: string;
};

// F-14: "Vendor status starts as Pending Activation until documents are
// validated" -- never created directly as active.
export const createVendor: CreateVendor<CreateVendorInput, { id: string }> = async (input, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, VENDOR_ADMIN_ROLES, context.entities, "createVendor");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");
  if (!input.name.trim()) throw new HttpError(400, "Vendor name is required.");

  const vendor = await context.entities.Vendor.create({
    data: {
      org_id: user.org_id,
      name: input.name.trim(),
      category: input.category as never,
      pan_gstin: input.pan_gstin?.trim() || null,
      status: "pending_activation",
    },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "Vendor",
      entity_id: vendor.id,
      action: "created",
      after_value: { name: vendor.name, category: vendor.category },
    },
  });

  return { id: vendor.id };
};

type BulkImportRowResult = { row: number; success: boolean; vendorId?: string; error?: string };

// CSV header: name,category,pan_gstin (pan_gstin optional). Rows are
// independent -- one bad row doesn't fail the batch, same as
// bulkImportOffices/bulkImportAssets. Reuses createVendor per row rather
// than duplicating its validation/status/audit-log logic.
export const bulkImportVendors: BulkImportVendors<
  { csv: string },
  { results: BulkImportRowResult[] }
> = async ({ csv }, context) => {
  await assertRole(context.user, VENDOR_ADMIN_ROLES, context.entities, "bulkImportVendors");

  const rows = parseCsv(csv);
  if (rows.length === 0) {
    throw new HttpError(400, "CSV has no data rows.");
  }

  const results: BulkImportRowResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // header is row 1
    try {
      if (!row.category?.trim()) throw new HttpError(400, "category is required.");
      const vendor = await createVendor(
        { name: row.name ?? "", category: row.category.trim(), pan_gstin: row.pan_gstin?.trim() || undefined },
        context,
      );
      results.push({ row: rowNumber, success: true, vendorId: vendor.id });
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

export const listVendors: ListVendors<
  void,
  Array<{ id: string; name: string; category: string; pan_gstin: string | null; status: string }>
> = async (_args, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, VENDOR_READ_ROLES, context.entities, "listVendors");
  if (!user.org_id) {
    throw new HttpError(400, "You must belong to an organization first.");
  }

  const vendors = await context.entities.Vendor.findMany({
    where: { org_id: user.org_id },
    orderBy: { name: "asc" },
  });

  return vendors.map((v) => ({
    id: v.id,
    name: v.name,
    category: v.category,
    pan_gstin: v.pan_gstin,
    status: v.status,
  }));
};

export const getVendor: GetVendor<
  { id: string },
  {
    id: string;
    name: string;
    category: string;
    pan_gstin: string | null;
    status: string;
    amcContracts: Array<{
      id: string;
      linked_entity_type: string;
      linked_entity_id: string;
      start_date: string;
      end_date: string;
      status: string;
    }>;
    performanceReviews: Array<{
      id: string;
      sla_compliance_pct: string;
      response_time_hours: string;
      quality_rating: number;
      remark: string | null;
      created_at: string;
    }>;
  }
> = async ({ id }, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, VENDOR_READ_ROLES, context.entities, "getVendor");

  const vendor = await context.entities.Vendor.findUnique({
    where: { id },
    include: {
      amcContracts: { orderBy: { start_date: "desc" } },
      performanceReviews: { orderBy: { created_at: "desc" } },
    },
  });
  if (!vendor || vendor.org_id !== user.org_id) {
    throw new HttpError(404, "Vendor not found.");
  }

  return {
    id: vendor.id,
    name: vendor.name,
    category: vendor.category,
    pan_gstin: vendor.pan_gstin,
    status: vendor.status,
    amcContracts: vendor.amcContracts.map((c) => ({
      id: c.id,
      linked_entity_type: c.linked_entity_type,
      linked_entity_id: c.linked_entity_id,
      start_date: c.start_date.toISOString(),
      end_date: c.end_date.toISOString(),
      status: c.status,
    })),
    performanceReviews: vendor.performanceReviews.map((r) => ({
      id: r.id,
      sla_compliance_pct: r.sla_compliance_pct.toString(),
      response_time_hours: r.response_time_hours.toString(),
      quality_rating: r.quality_rating,
      remark: r.remark,
      created_at: r.created_at.toISOString(),
    })),
  };
};

// F-14: "Vendor Manager activates the vendor, making it eligible for work
// assignment" -- the only transition out of pending_activation this step
// wires up (suspend/reactivate isn't in this pass's scope).
export const activateVendor: ActivateVendor<{ id: string }, { success: true }> = async ({ id }, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, VENDOR_ADMIN_ROLES, context.entities, "activateVendor");

  const vendor = await context.entities.Vendor.findUnique({ where: { id } });
  if (!vendor || vendor.org_id !== user.org_id) {
    throw new HttpError(404, "Vendor not found.");
  }
  if (vendor.status !== "pending_activation") {
    throw new HttpError(400, "Only a vendor pending activation can be activated.");
  }

  await context.entities.Vendor.update({ where: { id }, data: { status: "active" } });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "Vendor",
      entity_id: vendor.id,
      action: "activated",
    },
  });

  return { success: true };
};

type RecordVendorPerformanceReviewInput = {
  vendorId: string;
  sla_compliance_pct: number;
  response_time_hours: number;
  quality_rating: number;
  remark?: string;
};

export const recordVendorPerformanceReview: RecordVendorPerformanceReview<
  RecordVendorPerformanceReviewInput,
  { id: string }
> = async (input, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, VENDOR_ADMIN_ROLES, context.entities, "recordVendorPerformanceReview");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");

  const vendor = await context.entities.Vendor.findUnique({ where: { id: input.vendorId } });
  if (!vendor || vendor.org_id !== user.org_id) {
    throw new HttpError(404, "Vendor not found.");
  }
  if (input.quality_rating < 1 || input.quality_rating > 5) {
    throw new HttpError(400, "Quality rating must be between 1 and 5.");
  }
  if (input.sla_compliance_pct < 0 || input.sla_compliance_pct > 100) {
    throw new HttpError(400, "SLA compliance rate must be between 0 and 100.");
  }
  if (input.response_time_hours < 0) {
    throw new HttpError(400, "Response time cannot be negative.");
  }

  const review = await context.entities.VendorPerformanceReview.create({
    data: {
      org_id: user.org_id,
      vendor_id: vendor.id,
      sla_compliance_pct: input.sla_compliance_pct,
      response_time_hours: input.response_time_hours,
      quality_rating: input.quality_rating,
      remark: input.remark?.trim() || null,
      reviewed_by: user.id,
    },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "Vendor",
      entity_id: vendor.id,
      action: "performance_reviewed",
      after_value: { review_id: review.id, quality_rating: input.quality_rating },
    },
  });

  return { id: review.id };
};
