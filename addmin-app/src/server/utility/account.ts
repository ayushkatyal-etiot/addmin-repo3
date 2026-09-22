import { HttpError } from "wasp/server";
import type {
  CreateUtilityAccount,
  BulkImportUtilityAccounts,
  ListUtilityAccounts,
  GetUtilityAccount,
  DeactivateUtilityAccount,
} from "wasp/server/operations";
import { assertRole, assertOfficeScope, type Role } from "../shared/authz";
import { createObligationSchedule, deactivateObligationSchedule } from "../obligation/schedule";
import { reconcileUtilityObligationInstances } from "../obligation/instanceLifecycle";
import { parseCsv } from "../shared/csv";

// Build Step 06 (planmysaas-blueprint/08-build-playbook.md): Utility Module.
// createUtilityAccount also creates the RecurringObligationSchedule in the
// same call -- F-07's "every active UtilityAccount has exactly one
// RecurringObligationSchedule" is an invariant this module owns, not
// something a caller has to remember to do as a second step.

export const OFFICE_ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];

// Not exposed as separate form fields in this step's UI -- a utility bill's
// due timing is "by end of billing period" for every org today. Revisit if a
// real per-provider due-date rule is ever needed.
const DEFAULT_EXPECTED_WINDOW_DAYS = 7;
const DEFAULT_DUE_RULE = "Expected by end of billing period.";

type CreateUtilityAccountInput = {
  office_id: string;
  utility_type: string;
  provider_name: string;
  meter_account_no: string;
  billing_cycle: "monthly" | "bimonthly" | "quarterly";
  vendor_id?: string;
  // Defaults to today when omitted -- lets an admin backdate a connection
  // that was actually live before it was entered into AddMin, so the
  // schedule's periods line up with real billing history instead of
  // starting from data-entry day.
  start_date?: string;
};

export const createUtilityAccount: CreateUtilityAccount<
  CreateUtilityAccountInput,
  { id: string }
> = async (input, context) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "createUtilityAccount");
  await assertOfficeScope(user, input.office_id, context.entities, "createUtilityAccount");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");

  if (!input.provider_name.trim()) throw new HttpError(400, "Provider name is required.");
  if (!input.meter_account_no.trim()) throw new HttpError(400, "Account/meter number is required.");

  let activeFrom = new Date();
  if (input.start_date) {
    activeFrom = new Date(input.start_date);
    if (Number.isNaN(activeFrom.getTime())) {
      throw new HttpError(400, "Start date is invalid.");
    }
    if (activeFrom.getTime() > Date.now()) {
      throw new HttpError(400, "Start date cannot be in the future.");
    }
  }

  const office = await context.entities.Office.findUnique({ where: { id: input.office_id } });
  if (!office || office.org_id !== user.org_id) {
    throw new HttpError(404, "Office not found.");
  }

  // F-06: "A single office can have multiple connections of the same
  // utility type" -- so no uniqueness check on (office, utility_type). The
  // real duplicate to guard is the same physical connection re-entered
  // twice, which meter_account_no captures.
  const existing = await context.entities.UtilityAccount.findFirst({
    where: { office_id: input.office_id, meter_account_no: input.meter_account_no.trim() },
  });
  if (existing) {
    throw new HttpError(400, "A utility connection with this account/meter number already exists for this office.");
  }

  const account = await context.entities.UtilityAccount.create({
    data: {
      org_id: user.org_id,
      office_id: input.office_id,
      utility_type: input.utility_type as never,
      provider_name: input.provider_name.trim(),
      meter_account_no: input.meter_account_no.trim(),
      billing_cycle: input.billing_cycle,
      vendor_id: input.vendor_id || null,
      status: "active",
    },
  });

  await createObligationSchedule(context.entities, {
    org_id: user.org_id,
    scope_type: "utility",
    scope_ref_id: account.id,
    frequency: input.billing_cycle,
    expected_window_days: DEFAULT_EXPECTED_WINDOW_DAYS,
    due_rule: DEFAULT_DUE_RULE,
    owner_user_id: user.id,
    active_from: activeFrom,
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "UtilityAccount",
      entity_id: account.id,
      action: "created",
      after_value: { provider_name: account.provider_name, utility_type: account.utility_type },
    },
  });

  return { id: account.id };
};

type BulkImportRowResult = { row: number; success: boolean; accountId?: string; error?: string };

// CSV header: office_code,utility_type,provider_name,meter_account_no,billing_cycle,vendor_id,start_date
// (vendor_id/start_date optional). Reuses createUtilityAccount per row so
// the RecurringObligationSchedule invariant (F-07) is never bypassed by a
// bulk-imported row.
export const bulkImportUtilityAccounts: BulkImportUtilityAccounts<
  { csv: string },
  { results: BulkImportRowResult[] }
> = async ({ csv }, context) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "bulkImportUtilityAccounts");
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
      const office = await context.entities.Office.findUnique({
        where: { org_id_code: { org_id: user.org_id, code: row.office_code.trim().toUpperCase() } },
      });
      if (!office) throw new HttpError(400, `No office with code "${row.office_code}".`);

      const account = await createUtilityAccount(
        {
          office_id: office.id,
          utility_type: row.utility_type ?? "",
          provider_name: row.provider_name ?? "",
          meter_account_no: row.meter_account_no ?? "",
          billing_cycle: (row.billing_cycle ?? "") as "monthly" | "bimonthly" | "quarterly",
          vendor_id: row.vendor_id?.trim() || undefined,
          start_date: row.start_date?.trim() || undefined,
        },
        context,
      );
      results.push({ row: rowNumber, success: true, accountId: account.id });
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

export const listUtilityAccounts: ListUtilityAccounts<
  { officeId: string },
  Array<{
    id: string;
    utility_type: string;
    provider_name: string;
    meter_account_no: string;
    billing_cycle: string;
    status: string;
  }>
> = async ({ officeId }, context) => {
  const user = await assertRole(
    context.user,
    [...OFFICE_ADMIN_ROLES, "office_head", "vendor_manager"],
    context.entities,
    "listUtilityAccounts",
  );
  await assertOfficeScope(user, officeId, context.entities, "listUtilityAccounts");

  return context.entities.UtilityAccount.findMany({
    where: { office_id: officeId },
    orderBy: { provider_name: "asc" },
  });
};

export const getUtilityAccount: GetUtilityAccount<
  { accountId: string },
  {
    id: string;
    office_id: string;
    utility_type: string;
    provider_name: string;
    meter_account_no: string;
    billing_cycle: string;
    status: string;
    instances: Array<{
      id: string;
      period: string;
      expected_date: string;
      status: string;
    }>;
  }
> = async ({ accountId }, context) => {
  const user = await assertRole(
    context.user,
    [...OFFICE_ADMIN_ROLES, "office_head", "vendor_manager"],
    context.entities,
    "getUtilityAccount",
  );

  const account = await context.entities.UtilityAccount.findUnique({ where: { id: accountId } });
  if (!account || account.org_id !== user.org_id) {
    throw new HttpError(404, "Utility connection not found.");
  }
  await assertOfficeScope(user, account.office_id, context.entities, "getUtilityAccount");

  const schedule = await context.entities.RecurringObligationSchedule.findFirst({
    where: { scope_type: "utility", scope_ref_id: account.id },
  });
  if (schedule) {
    await reconcileUtilityObligationInstances(context.entities, account.id, schedule.id);
  }
  const instances = schedule
    ? await context.entities.ObligationInstance.findMany({
        where: { schedule_id: schedule.id },
        orderBy: { expected_date: "desc" },
      })
    : [];

  return {
    id: account.id,
    office_id: account.office_id,
    utility_type: account.utility_type,
    provider_name: account.provider_name,
    meter_account_no: account.meter_account_no,
    billing_cycle: account.billing_cycle,
    status: account.status,
    instances: instances.map((i) => ({
      id: i.id,
      period: i.period,
      expected_date: i.expected_date.toISOString(),
      status: i.status,
    })),
  };
};

export const deactivateUtilityAccount: DeactivateUtilityAccount<{ accountId: string }, { success: true }> = async (
  { accountId },
  context,
) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "deactivateUtilityAccount");

  const account = await context.entities.UtilityAccount.findUnique({ where: { id: accountId } });
  if (!account || account.org_id !== user.org_id) {
    throw new HttpError(404, "Utility connection not found.");
  }
  await assertOfficeScope(user, account.office_id, context.entities, "deactivateUtilityAccount");

  await context.entities.UtilityAccount.update({
    where: { id: accountId },
    data: { status: "inactive" },
  });
  // F-07: stops future generation, historical ObligationInstance rows untouched.
  await deactivateObligationSchedule(context.entities, "utility", accountId);

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "UtilityAccount",
      entity_id: accountId,
      action: "deactivated",
    },
  });

  return { success: true };
};
