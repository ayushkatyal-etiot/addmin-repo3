import { HttpError } from "wasp/server";
import type { CreateAmcContract, ListAmcContracts, CloseAmcContract } from "wasp/server/operations";
import { assertRole, type Role } from "../shared/authz";
import { createObligationSchedule, deactivateObligationSchedule } from "../obligation/schedule";

// Build Step 08 (planmysaas-blueprint/08-build-playbook.md): F-14's AMC
// tracking half. Reuses Step 06's obligation engine exactly like Lease did
// (src/server/property/lease.ts) -- an AMCContract's renewal is a
// RecurringObligationSchedule with scope_type "amc", not a bespoke
// reimplementation. Renewal *alerts* (60/30 day) and the active ->
// due_for_renewal -> expired status walk live in amcJob.ts, not here.
const VENDOR_ADMIN_ROLES: Role[] = ["platform_admin", "vendor_manager"];

// AMCContract.linked_entity_type/linked_entity_id (schema.prisma) is
// deliberately a polymorphic string pair, not a typed FK -- Asset isn't
// modeled yet (see schema.prisma's Asset Module header), so "office" and
// "utility_account" are the only two link types validated today; anything
// else is accepted as-is so a future entity type doesn't need a migration
// here to start being linkable.
const VALIDATED_LINK_TYPES = ["office", "utility_account"] as const;

// AMC renewal windows top out at 60 days (F-14) -- the schedule needs to be
// "due" that far ahead of expiry for amcJob.ts's alert job to have a period
// to alert against.
const EXPECTED_WINDOW_DAYS = 60;

type CreateAmcContractInput = {
  vendor_id: string;
  linked_entity_type: string;
  linked_entity_id: string;
  start_date: string;
  end_date: string;
};

export const createAmcContract: CreateAmcContract<CreateAmcContractInput, { id: string }> = async (
  input,
  context,
) => {
  const user = await assertRole(context.user, VENDOR_ADMIN_ROLES, context.entities, "createAmcContract");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");

  const vendor = await context.entities.Vendor.findUnique({ where: { id: input.vendor_id } });
  if (!vendor || vendor.org_id !== user.org_id) {
    throw new HttpError(404, "Vendor not found.");
  }
  // F-14: "Vendor cannot be assigned to any work order or AMC while status
  // is Pending Activation."
  if (vendor.status === "pending_activation") {
    throw new HttpError(400, "This vendor is pending activation and cannot be assigned an AMC contract yet.");
  }

  const startDate = new Date(input.start_date);
  const endDate = new Date(input.end_date);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new HttpError(400, "Start and end dates are required.");
  }
  if (endDate.getTime() <= startDate.getTime()) {
    throw new HttpError(400, "AMC end date must be later than the start date.");
  }

  if ((VALIDATED_LINK_TYPES as readonly string[]).includes(input.linked_entity_type)) {
    if (input.linked_entity_type === "office") {
      const office = await context.entities.Office.findUnique({ where: { id: input.linked_entity_id } });
      if (!office || office.org_id !== user.org_id) {
        throw new HttpError(400, "Linked office not found in your organization.");
      }
    } else if (input.linked_entity_type === "utility_account") {
      const account = await context.entities.UtilityAccount.findUnique({ where: { id: input.linked_entity_id } });
      if (!account || account.org_id !== user.org_id) {
        throw new HttpError(400, "Linked utility connection not found in your organization.");
      }
    }
  }

  const contract = await context.entities.AMCContract.create({
    data: {
      org_id: user.org_id,
      vendor_id: vendor.id,
      linked_entity_type: input.linked_entity_type,
      linked_entity_id: input.linked_entity_id,
      start_date: startDate,
      end_date: endDate,
      status: "active",
    },
  });

  await createObligationSchedule(context.entities, {
    org_id: user.org_id,
    scope_type: "amc",
    scope_ref_id: contract.id,
    frequency: "annual",
    expected_window_days: EXPECTED_WINDOW_DAYS,
    due_rule: "AMC renewal due.",
    owner_user_id: user.id,
    active_from: startDate,
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "AMCContract",
      entity_id: contract.id,
      action: "created",
      after_value: { vendor_id: vendor.id, linked_entity_type: input.linked_entity_type },
    },
  });

  return { id: contract.id };
};

export const listAmcContracts: ListAmcContracts<
  { vendorId: string },
  Array<{
    id: string;
    linked_entity_type: string;
    linked_entity_id: string;
    start_date: string;
    end_date: string;
    status: string;
  }>
> = async ({ vendorId }, context) => {
  const user = await assertRole(
    context.user,
    ["platform_admin", "vendor_manager", "office_admin", "facility_staff"],
    context.entities,
    "listAmcContracts",
  );

  const contracts = await context.entities.AMCContract.findMany({
    where: { vendor_id: vendorId, org_id: user.org_id! },
    orderBy: { start_date: "desc" },
  });

  return contracts.map((c) => ({
    id: c.id,
    linked_entity_type: c.linked_entity_type,
    linked_entity_id: c.linked_entity_id,
    start_date: c.start_date.toISOString(),
    end_date: c.end_date.toISOString(),
    status: c.status,
  }));
};

// F-14 edge case parity with Lease termination: closing an AMC stops future
// renewal-obligation generation without touching historical instances.
export const closeAmcContract: CloseAmcContract<{ id: string }, { success: true }> = async ({ id }, context) => {
  const user = await assertRole(context.user, VENDOR_ADMIN_ROLES, context.entities, "closeAmcContract");

  const contract = await context.entities.AMCContract.findUnique({ where: { id } });
  if (!contract || contract.org_id !== user.org_id) {
    throw new HttpError(404, "AMC contract not found.");
  }
  if (contract.status === "closed") {
    throw new HttpError(400, "This AMC contract is already closed.");
  }

  await deactivateObligationSchedule(context.entities, "amc", contract.id);

  await context.entities.AMCContract.update({ where: { id }, data: { status: "closed" } });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "AMCContract",
      entity_id: contract.id,
      action: "closed",
    },
  });

  return { success: true };
};
