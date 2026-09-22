import { HttpError } from "wasp/server";
import type { CreateLandlord, ListLandlords } from "wasp/server/operations";
import { assertRole, type Role } from "../shared/authz";

// Build Step 08 (planmysaas-blueprint/08-build-playbook.md): Property &
// Lease Module, F-12/F-13. Landlord is org-wide (not office-scoped) since
// the same landlord can own multiple offices' leases.
export const OFFICE_ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];

type CreateLandlordInput = {
  name: string;
  pan?: string;
  bank_details?: Record<string, string>;
  tds_applicable: boolean;
  tds_rate_pct?: number;
};

export const createLandlord: CreateLandlord<CreateLandlordInput, { id: string }> = async (input, context) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "createLandlord");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");

  if (!input.name.trim()) throw new HttpError(400, "Landlord name is required.");

  const landlord = await context.entities.Landlord.create({
    data: {
      org_id: user.org_id,
      name: input.name.trim(),
      pan: input.pan?.trim() || null,
      bank_details: input.bank_details ?? {},
      tds_applicable: input.tds_applicable,
      tds_rate_pct: input.tds_applicable ? (input.tds_rate_pct ?? null) : null,
    },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "Landlord",
      entity_id: landlord.id,
      action: "created",
      after_value: { name: landlord.name, tds_applicable: landlord.tds_applicable },
    },
  });

  return { id: landlord.id };
};

export const listLandlords: ListLandlords<
  void,
  Array<{ id: string; name: string; pan: string | null; tds_applicable: boolean; tds_rate_pct: string | null }>
> = async (_args, context) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "listLandlords");
  if (!user.org_id) return [];

  const landlords = await context.entities.Landlord.findMany({
    where: { org_id: user.org_id },
    orderBy: { name: "asc" },
  });

  return landlords.map((l) => ({
    id: l.id,
    name: l.name,
    pan: l.pan,
    tds_applicable: l.tds_applicable,
    tds_rate_pct: l.tds_rate_pct === null ? null : l.tds_rate_pct.toString(),
  }));
};
