import { HttpError } from "wasp/server";
import type {
  UpdateOrganizationProfile,
  CreateOffice,
  BulkImportOffices,
  ListOffices,
  GetOffice,
  UpdateOffice,
  ListOrgUsers,
  UpdateUserOffice,
  UpdateUserManager,
} from "wasp/server/operations";
import type { PrismaClient } from "@prisma/client";
import { assertRole, assertOfficeScope, ALL_ROLES, type Role } from "../shared/authz";
import { parseCsv } from "../shared/csv";

// Build Step 04 (planmysaas-blueprint/08-build-playbook.md): Organization &
// Office module. F-03's "createOrganization" action from 04-architecture.md's
// API surface is really an update -- the Organization row already exists
// from signup (src/auth/email/userSignupFields.ts creates it with
// placeholder name/currency/timezone), so this is where the admin fills in
// the real profile. Named to match 04-architecture.md's table anyway would
// be misleading, hence UpdateOrganizationProfile.

export const OFFICE_ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];

type OrgProfileInput = {
  name: string;
  gstin?: string;
  default_currency: string;
  timezone: string;
};

export const updateOrganizationProfile: UpdateOrganizationProfile<
  OrgProfileInput,
  { orgId: string }
> = async (input, context) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "updateOrganizationProfile");
  if (!user.org_id) {
    throw new HttpError(400, "You must belong to an organization first.");
  }
  if (!input.name.trim()) {
    throw new HttpError(400, "Organization name is required.");
  }

  await context.entities.Organization.update({
    where: { id: user.org_id },
    data: {
      name: input.name.trim(),
      gstin: input.gstin?.trim() || null,
      default_currency: input.default_currency,
      timezone: input.timezone,
    },
  });

  return { orgId: user.org_id };
};

type CreateOfficeInput = {
  name: string;
  address: string;
  office_type: string;
  ownership_type: string;
  code?: string;
};

/**
 * Shared by both createOffice (single) and bulkImportOffices (CSV, one call
 * per row) -- must not fork into two implementations that drift.
 *
 * Onboarding-checklist hidden (product decision, see
 * planmysaas-blueprint/11-without-setup-decision.md, "Option A"): a new
 * office is immediately usable -- no guided wizard, no activation gate, no
 * OfficeChecklistItem rows seeded. `OfficeSetupProfile` is still created
 * (Office Home's completionPct read and the FK both still expect a row) but
 * fixed at 100% since there's no checklist left to track against it.
 */
async function createOfficeForOrg(
  orgId: string,
  input: CreateOfficeInput,
  entities: {
    Office: PrismaClient["office"];
    OfficeSetupProfile: PrismaClient["officeSetupProfile"];
  },
): Promise<{ officeId: string; code: string }> {
  if (!input.name.trim()) throw new HttpError(400, "Office name is required.");
  if (!input.address.trim()) throw new HttpError(400, "Office address is required.");

  const code = (input.code?.trim() || slugifyToCode(input.name)).toUpperCase();

  const existing = await entities.Office.findUnique({
    where: { org_id_code: { org_id: orgId, code } },
  });
  if (existing) {
    throw new HttpError(400, `Office code "${code}" is already used in this organization.`);
  }

  const office = await entities.Office.create({
    data: {
      org_id: orgId,
      code,
      name: input.name.trim(),
      address: input.address.trim(),
      office_type: input.office_type as never,
      ownership_type: input.ownership_type as never,
      setup_status: "active",
    },
  });

  await entities.OfficeSetupProfile.create({
    data: {
      org_id: orgId,
      office_id: office.id,
      completion_pct: 100,
    },
  });

  return { officeId: office.id, code };
}

function slugifyToCode(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base || "OFFICE"}-${suffix}`;
}

export const createOffice: CreateOffice<CreateOfficeInput, { officeId: string; code: string }> = async (
  input,
  context,
) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "createOffice");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");

  const result = await createOfficeForOrg(user.org_id, input, context.entities);

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "Office",
      entity_id: result.officeId,
      action: "created",
      after_value: { code: result.code, name: input.name },
    },
  });

  return result;
};

type BulkImportRowResult = { row: number; success: boolean; officeId?: string; error?: string };

// A single multi-line CSV string, header row required: name,address,office_type,ownership_type,code
// `code` column is optional per row. Each row is created independently so one
// bad row (e.g. duplicate code) doesn't fail the whole batch, per F-03's
// acceptance criteria.
export const bulkImportOffices: BulkImportOffices<
  { csv: string },
  { results: BulkImportRowResult[] }
> = async ({ csv }, context) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "bulkImportOffices");
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
      const result = await createOfficeForOrg(
        user.org_id,
        {
          name: row.name ?? "",
          address: row.address ?? "",
          office_type: row.office_type ?? "",
          ownership_type: row.ownership_type ?? "",
          code: row.code,
        },
        context.entities,
      );
      await context.entities.AuditLog.create({
        data: {
          org_id: user.org_id,
          actor_user_id: user.id,
          entity_type: "Office",
          entity_id: result.officeId,
          action: "created_via_bulk_import",
          after_value: { code: result.code, name: row.name },
        },
      });
      results.push({ row: rowNumber, success: true, officeId: result.officeId });
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

// Roles that pick an office on /app/bills, /app/payments, etc. — not only
// office admins (Build Step 07: Checker / Payment Authorizer need read access
// to offices in their office_scope).
export const OFFICE_LIST_ROLES: Role[] = [
  ...OFFICE_ADMIN_ROLES,
  "office_head",
  "vendor_manager",
  "checker",
  "payment_authorizer",
  // F-15: "Employee or Facility Staff logs a maintenance request" -- both
  // need their office(s) to file one against.
  "facility_staff",
  "employee",
];

export const listOffices: ListOffices<
  void,
  Array<{
    id: string;
    code: string;
    name: string;
    office_type: string;
    ownership_type: string;
    setup_status: string;
    completion_pct: number;
  }>
> = async (_args, context) => {
  const user = await assertRole(context.user, OFFICE_LIST_ROLES, context.entities, "listOffices");
  if (!user.org_id) return [];

  const orgWideOfficeAccess = user.role === "platform_admin" || user.role === "office_admin";
  const scopedOfficeIds = orgWideOfficeAccess
    ? null
    : Object.keys((user.office_scope ?? {}) as Record<string, string[]>);
  if (!orgWideOfficeAccess && scopedOfficeIds!.length === 0) return [];

  const offices = await context.entities.Office.findMany({
    where: {
      org_id: user.org_id,
      ...(scopedOfficeIds ? { id: { in: scopedOfficeIds } } : {}),
    },
    include: { setupProfile: true },
    orderBy: { created_at: "asc" },
  });

  return offices.map((office) => ({
    id: office.id,
    code: office.code,
    name: office.name,
    office_type: office.office_type,
    ownership_type: office.ownership_type,
    setup_status: office.setup_status,
    completion_pct: office.setupProfile ? Number(office.setupProfile.completion_pct) : 0,
  }));
};

export const getOffice: GetOffice<
  { officeId: string },
  {
    id: string;
    code: string;
    name: string;
    address: string;
    office_type: string;
    ownership_type: string;
    setup_status: string;
  }
> = async ({ officeId }, context) => {
  const user = await assertRole(
    context.user,
    [...OFFICE_ADMIN_ROLES, "office_head"],
    context.entities,
    "getOffice",
  );
  const office = await context.entities.Office.findUnique({ where: { id: officeId } });
  if (!office || office.org_id !== user.org_id) {
    throw new HttpError(404, "Office not found.");
  }
  return {
    id: office.id,
    code: office.code,
    name: office.name,
    address: office.address,
    office_type: office.office_type,
    ownership_type: office.ownership_type,
    setup_status: office.setup_status,
  };
};

type UpdateOfficeInput = {
  officeId: string;
  name: string;
  address: string;
  office_type: string;
  ownership_type: string;
};

export const updateOffice: UpdateOffice<UpdateOfficeInput, { officeId: string }> = async (input, context) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "updateOffice");
  await assertOfficeScope(user, input.officeId, context.entities, "updateOffice");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");
  if (!input.name.trim()) throw new HttpError(400, "Office name is required.");
  if (!input.address.trim()) throw new HttpError(400, "Office address is required.");

  const office = await context.entities.Office.findUnique({ where: { id: input.officeId } });
  if (!office || office.org_id !== user.org_id) {
    throw new HttpError(404, "Office not found.");
  }

  await context.entities.Office.update({
    where: { id: input.officeId },
    data: {
      name: input.name.trim(),
      address: input.address.trim(),
      office_type: input.office_type as never,
      ownership_type: input.ownership_type as never,
    },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "Office",
      entity_id: input.officeId,
      action: "updated",
      after_value: {
        name: input.name.trim(),
        office_type: input.office_type,
        ownership_type: input.ownership_type,
      },
    },
  });

  return { officeId: input.officeId };
};

// Used by the onboarding wizard's "assign owner" pickers (F-04's Roles step)
// -- listing every user in the caller's org, not office-scoped, since a role
// owner can be assigned before their own office_scope is configured.
export const listOrgUsers: ListOrgUsers<
  void,
  Array<{
    id: string;
    email: string | null;
    role: string | null;
    office_scope: Record<string, string[]> | null;
    manager_user_id: string | null;
  }>
> = async (_args, context) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "listOrgUsers");
  if (!user.org_id) return [];

  const users = await context.entities.User.findMany({
    where: { org_id: user.org_id },
    select: { id: true, email: true, role: true, office_scope: true, manager_user_id: true },
    orderBy: { email: "asc" },
  });
  return users as unknown as Array<{
    id: string;
    email: string | null;
    role: string | null;
    office_scope: Record<string, string[]> | null;
    manager_user_id: string | null;
  }>;
};

// platform_admin only -- lets an admin (re)assign which office(s) a teammate
// is scoped to after they've already signed up, since inviteUser's
// officeRoles only sets the *initial* office_scope at invite time. Replaces
// the full office_scope map with the given set (not a merge) -- unchecking
// an office in the UI must actually revoke it. Each office can carry its
// own role (e.g. office_admin at one site, checker at another).
export const updateUserOffice: UpdateUserOffice<{ userId: string; officeRoles: Record<string, string> }, void> = async (
  { userId, officeRoles },
  context,
) => {
  const admin = await assertRole(context.user, ["platform_admin"], context.entities, "updateUserOffice");
  if (!admin.org_id) {
    throw new HttpError(400, "You must belong to an organization to do this.");
  }

  const targetUser = await context.entities.User.findFirst({ where: { id: userId, org_id: admin.org_id } });
  if (!targetUser) {
    throw new HttpError(404, "User not found.");
  }
  if (targetUser.role === "platform_admin") {
    throw new HttpError(400, "Platform admins are not office-scoped.");
  }

  const officeEntries = Object.entries(officeRoles);
  if (officeEntries.length === 0) {
    throw new HttpError(400, "Choose at least one office for this user.");
  }
  for (const [, role] of officeEntries) {
    if (!ALL_ROLES.includes(role as never)) {
      throw new HttpError(400, `"${role}" is not a valid role.`);
    }
  }

  const officeIds = officeEntries.map(([id]) => id);
  const offices = await context.entities.Office.findMany({
    where: { id: { in: officeIds }, org_id: admin.org_id },
  });
  if (offices.length !== officeIds.length) {
    throw new HttpError(400, "One or more selected offices do not belong to your organization.");
  }

  await context.entities.User.update({
    where: { id: userId },
    data: { office_scope: Object.fromEntries(officeEntries.map(([id, role]) => [id, [role]])) },
  });
};

// F-16: sets who approves a User's asset requests (createAssetRequest,
// src/server/asset/asset.ts) -- a self-relation, not a role, since two
// people can share a role but not a manager. Pass managerUserId: null to
// clear it.
export const updateUserManager: UpdateUserManager<{ userId: string; managerUserId: string | null }, void> = async (
  { userId, managerUserId },
  context,
) => {
  const admin = await assertRole(context.user, ["platform_admin", "office_admin"], context.entities, "updateUserManager");
  if (!admin.org_id) {
    throw new HttpError(400, "You must belong to an organization to do this.");
  }

  const targetUser = await context.entities.User.findFirst({ where: { id: userId, org_id: admin.org_id } });
  if (!targetUser) {
    throw new HttpError(404, "User not found.");
  }

  if (managerUserId) {
    if (managerUserId === userId) {
      throw new HttpError(400, "A user cannot be their own manager.");
    }
    const manager = await context.entities.User.findFirst({ where: { id: managerUserId, org_id: admin.org_id } });
    if (!manager) {
      throw new HttpError(404, "Manager not found in this organization.");
    }
  }

  await context.entities.User.update({ where: { id: userId }, data: { manager_user_id: managerUserId } });
};
