import { HttpError } from "wasp/server";
import type { CreateLease, ListLeases, GetLease, TerminateLease } from "wasp/server/operations";
import { assertRole, assertOfficeScope, type Role } from "../shared/authz";
import { createObligationSchedule, deactivateObligationSchedule } from "../obligation/schedule";
import { reconcileLeaseObligationInstances } from "../obligation/instanceLifecycle";

// Build Step 08 (planmysaas-blueprint/08-build-playbook.md): Property &
// Lease Module. createLease also creates the rent (and CAM, if present)
// RecurringObligationSchedule in the same call, mirroring Step 06's
// UtilityAccount+schedule invariant -- see src/server/utility/account.ts.
const OFFICE_ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];
const LEASE_READ_ROLES: Role[] = [...OFFICE_ADMIN_ROLES, "office_head", "payment_authorizer"];

// Not exposed as a form field -- every lease's rent obligation windows 7
// days ahead of its due date, same default the utility module uses. Revisit
// if a real per-landlord notice-period rule is ever needed.
const DEFAULT_EXPECTED_WINDOW_DAYS = 7;

type CreateLeaseInput = {
  office_id: string;
  landlord_id: string;
  start_date: string;
  end_date: string;
  /** Anchors monthly rent/CAM obligation periods (defaults to start_date). */
  rent_due_anchor_date?: string;
  rent_amount: number;
  cam_amount?: number;
  security_deposit?: number;
  escalation_pct?: number;
  escalation_effective_date?: string;
};

export const createLease: CreateLease<CreateLeaseInput, { id: string }> = async (input, context) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "createLease");
  await assertOfficeScope(user, input.office_id, context.entities, "createLease");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");

  if (!(input.rent_amount > 0)) throw new HttpError(400, "Rent amount must be greater than 0.");

  const startDate = new Date(input.start_date);
  const endDate = new Date(input.end_date);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new HttpError(400, "Start and end dates are required.");
  }
  if (endDate.getTime() <= startDate.getTime()) {
    throw new HttpError(400, "Lease end date must be later than the start date.");
  }

  let rentDueAnchor = startDate;
  if (input.rent_due_anchor_date) {
    rentDueAnchor = new Date(input.rent_due_anchor_date);
    if (Number.isNaN(rentDueAnchor.getTime())) {
      throw new HttpError(400, "Rent due anchor date is invalid.");
    }
  }
  if (rentDueAnchor.getTime() < startDate.getTime() || rentDueAnchor.getTime() > endDate.getTime()) {
    throw new HttpError(400, "Rent due anchor date must fall within the lease term.");
  }

  const office = await context.entities.Office.findUnique({ where: { id: input.office_id } });
  if (!office || office.org_id !== user.org_id) {
    throw new HttpError(404, "Office not found.");
  }
  const landlord = await context.entities.Landlord.findUnique({ where: { id: input.landlord_id } });
  if (!landlord || landlord.org_id !== user.org_id) {
    throw new HttpError(404, "Landlord not found.");
  }

  let escalationEffectiveDate: Date | null = null;
  if (input.escalation_pct) {
    if (!input.escalation_effective_date) {
      throw new HttpError(400, "Escalation effective date is required when an escalation percentage is set.");
    }
    escalationEffectiveDate = new Date(input.escalation_effective_date);
    if (Number.isNaN(escalationEffectiveDate.getTime())) {
      throw new HttpError(400, "Escalation effective date is invalid.");
    }
  }

  const lease = await context.entities.Lease.create({
    data: {
      org_id: user.org_id,
      office_id: input.office_id,
      landlord_id: input.landlord_id,
      start_date: startDate,
      end_date: endDate,
      rent_due_anchor_date: rentDueAnchor,
      rent_amount: input.rent_amount,
      cam_amount: input.cam_amount ?? null,
      security_deposit: input.security_deposit ?? null,
      escalation_pct: input.escalation_pct ?? null,
      escalation_effective_date: escalationEffectiveDate,
      status: "active",
    },
  });

  await createObligationSchedule(context.entities, {
    org_id: user.org_id,
    scope_type: "rent",
    scope_ref_id: lease.id,
    frequency: "monthly",
    expected_window_days: DEFAULT_EXPECTED_WINDOW_DAYS,
    due_rule: "Rent due per lease terms.",
    owner_user_id: user.id,
    active_from: rentDueAnchor,
  });

  if (input.cam_amount) {
    await createObligationSchedule(context.entities, {
      org_id: user.org_id,
      scope_type: "cam",
      scope_ref_id: lease.id,
      frequency: "monthly",
      expected_window_days: DEFAULT_EXPECTED_WINDOW_DAYS,
      due_rule: "CAM charges due per lease terms.",
      owner_user_id: user.id,
      active_from: rentDueAnchor,
    });
  }

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "Lease",
      entity_id: lease.id,
      action: "created",
      after_value: { office_id: lease.office_id, landlord_id: lease.landlord_id, rent_amount: input.rent_amount },
    },
  });

  return { id: lease.id };
};

export const listLeases: ListLeases<
  { officeId: string },
  Array<{
    id: string;
    landlord_name: string;
    start_date: string;
    end_date: string;
    rent_due_anchor_date: string;
    rent_amount: string;
    cam_amount: string | null;
    status: string;
  }>
> = async ({ officeId }, context) => {
  const user = await assertRole(context.user, LEASE_READ_ROLES, context.entities, "listLeases");
  await assertOfficeScope(user, officeId, context.entities, "listLeases");

  const leases = await context.entities.Lease.findMany({
    where: { office_id: officeId },
    include: { landlord: true },
    orderBy: { start_date: "desc" },
  });

  return leases.map((l) => ({
    id: l.id,
    landlord_name: l.landlord.name,
    start_date: l.start_date.toISOString(),
    end_date: l.end_date.toISOString(),
    rent_due_anchor_date: l.rent_due_anchor_date.toISOString(),
    rent_amount: l.rent_amount.toString(),
    cam_amount: l.cam_amount === null ? null : l.cam_amount.toString(),
    status: l.status,
  }));
};

export const getLease: GetLease<
  { id: string },
  {
    id: string;
    office_id: string;
    landlord_id: string;
    landlord_name: string;
    landlord_tds_applicable: boolean;
    start_date: string;
    end_date: string;
    rent_due_anchor_date: string;
    rent_amount: string;
    cam_amount: string | null;
    security_deposit: string | null;
    security_deposit_refunded: boolean;
    escalation_pct: string | null;
    escalation_effective_date: string | null;
    status: string;
    obligation_instances: Array<{
      id: string;
      scope_type: string;
      period: string;
      expected_date: string;
      status: string;
    }>;
  }
> = async ({ id }, context) => {
  const user = await assertRole(context.user, LEASE_READ_ROLES, context.entities, "getLease");
  const lease = await context.entities.Lease.findUnique({ where: { id }, include: { landlord: true } });
  if (!lease || lease.org_id !== user.org_id) {
    throw new HttpError(404, "Lease not found.");
  }
  await assertOfficeScope(user, lease.office_id, context.entities, "getLease");

  const schedules = await context.entities.RecurringObligationSchedule.findMany({
    where: { scope_type: { in: ["rent", "cam"] }, scope_ref_id: lease.id },
  });
  const scheduleIds = schedules.map((s) => s.id);
  const scheduleTypeById = new Map(schedules.map((s) => [s.id, s.scope_type]));

  await reconcileLeaseObligationInstances(context.entities, lease.id, scheduleIds, scheduleTypeById);

  const rawInstances =
    scheduleIds.length > 0
      ? await context.entities.ObligationInstance.findMany({
          where: { schedule_id: { in: scheduleIds } },
          orderBy: { expected_date: "desc" },
        })
      : [];

  return {
    id: lease.id,
    office_id: lease.office_id,
    landlord_id: lease.landlord_id,
    landlord_name: lease.landlord.name,
    landlord_tds_applicable: lease.landlord.tds_applicable,
    start_date: lease.start_date.toISOString(),
    end_date: lease.end_date.toISOString(),
    rent_due_anchor_date: lease.rent_due_anchor_date.toISOString(),
    rent_amount: lease.rent_amount.toString(),
    cam_amount: lease.cam_amount === null ? null : lease.cam_amount.toString(),
    security_deposit: lease.security_deposit === null ? null : lease.security_deposit.toString(),
    security_deposit_refunded: lease.security_deposit_refunded,
    escalation_pct: lease.escalation_pct === null ? null : lease.escalation_pct.toString(),
    escalation_effective_date: lease.escalation_effective_date?.toISOString() ?? null,
    status: lease.status,
    obligation_instances: rawInstances.map((i) => ({
      id: i.id,
      scope_type: scheduleTypeById.get(i.schedule_id) ?? "rent",
      period: i.period,
      expected_date: i.expected_date.toISOString(),
      status: i.status,
    })),
  };
};

// F-12 edge case: lease terminated mid-cycle cancels remaining *future*
// scheduled rent/CAM instances rather than leaving them dangling, without
// touching anything already expected/received/missing as of today.
export const terminateLease: TerminateLease<{ id: string }, { success: true }> = async ({ id }, context) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "terminateLease");

  const lease = await context.entities.Lease.findUnique({ where: { id } });
  if (!lease || lease.org_id !== user.org_id) {
    throw new HttpError(404, "Lease not found.");
  }
  await assertOfficeScope(user, lease.office_id, context.entities, "terminateLease");
  if (lease.status === "terminated") {
    throw new HttpError(400, "This lease is already terminated.");
  }

  const today = new Date();

  await deactivateObligationSchedule(context.entities, "rent", lease.id);
  await deactivateObligationSchedule(context.entities, "cam", lease.id);

  const schedules = await context.entities.RecurringObligationSchedule.findMany({
    where: { scope_type: { in: ["rent", "cam"] }, scope_ref_id: lease.id },
  });
  await context.entities.ObligationInstance.updateMany({
    where: { schedule_id: { in: schedules.map((s) => s.id) }, status: "expected", expected_date: { gt: today } },
    data: { status: "cancelled" },
  });

  await context.entities.Lease.update({
    where: { id: lease.id },
    data: { status: "terminated", end_date: today },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "Lease",
      entity_id: lease.id,
      action: "terminated",
    },
  });

  return { success: true };
};
