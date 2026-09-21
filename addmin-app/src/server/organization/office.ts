import { HttpError } from "wasp/server";
import type {
  UpdateOrganizationProfile,
  CreateOffice,
  BulkImportOffices,
  ListOffices,
  GetOffice,
  ListOrgUsers,
  UpdateUserOffice,
} from "wasp/server/operations";
import type { PrismaClient } from "@prisma/client";
import { assertRole, ALL_ROLES, type Role } from "../shared/authz";
import { CHECKLIST_TEMPLATE } from "../onboarding/checklistTemplates";

// Build Step 04 (planmysaas-blueprint/08-build-playbook.md): Organization &
// Office module. F-03's "createOrganization" action from 04-architecture.md's
// API surface is really an update -- the Organization row already exists
// from signup (src/auth/email/userSignupFields.ts creates it with
// placeholder name/currency/timezone), so this is where the admin fills in
// the real profile. Named to match 04-architecture.md's table anyway would
// be misleading, hence UpdateOrganizationProfile.

const OFFICE_ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];

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
 * per row) -- the create-office-and-seed-its-checklist logic must not fork
 * into two implementations that drift, per Build Step 04's mandatory pattern.
 */
async function createOfficeForOrg(
  orgId: string,
  input: CreateOfficeInput,
  entities: {
    Office: PrismaClient["office"];
    OfficeSetupProfile: PrismaClient["officeSetupProfile"];
    OfficeChecklistItem: PrismaClient["officeChecklistItem"];
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
      setup_status: "draft",
    },
  });

  const setupProfile = await entities.OfficeSetupProfile.create({
    data: {
      org_id: orgId,
      office_id: office.id,
      completion_pct: 0,
    },
  });

  // Every new office gets the full template, un-reviewed -- see
  // src/server/onboarding/checklist.ts's file header for what
  // (applicability: "no", status: "pending") means as the "not yet visited
  // by the admin" sentinel state.
  await entities.OfficeChecklistItem.createMany({
    data: CHECKLIST_TEMPLATE.map((item) => ({
      org_id: orgId,
      office_id: office.id,
      office_setup_profile_id: setupProfile.id,
      template_item_code: item.code,
      category: item.category,
      applicability: "no" as const,
      status: "pending" as const,
    })),
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

function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 1) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    header.forEach((key, idx) => {
      row[key] = cells[idx] ?? "";
    });
    return row;
  });
}

// Roles that pick an office on /app/bills, /app/payments, etc. — not only
// office admins (Build Step 07: Checker / Payment Authorizer need read access
// to offices in their office_scope).
const OFFICE_LIST_ROLES: Role[] = [
  ...OFFICE_ADMIN_ROLES,
  "office_head",
  "vendor_manager",
  "checker",
  "payment_authorizer",
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

// Used by the onboarding wizard's "assign owner" pickers (F-04's Roles step)
// -- listing every user in the caller's org, not office-scoped, since a role
// owner can be assigned before their own office_scope is configured.
export const listOrgUsers: ListOrgUsers<
  void,
  Array<{ id: string; email: string | null; role: string | null; office_scope: Record<string, string[]> | null }>
> = async (_args, context) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "listOrgUsers");
  if (!user.org_id) return [];

  const users = await context.entities.User.findMany({
    where: { org_id: user.org_id },
    select: { id: true, email: true, role: true, office_scope: true },
    orderBy: { email: "asc" },
  });
  return users as unknown as Array<{
    id: string;
    email: string | null;
    role: string | null;
    office_scope: Record<string, string[]> | null;
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
