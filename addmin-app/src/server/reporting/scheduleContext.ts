import type { PrismaClient } from "@prisma/client";

// Build Step 09 (planmysaas-blueprint/08-build-playbook.md): Reporting
// Module, F-18. RecurringObligationSchedule.scope_ref_id is polymorphic
// (Step 06's design) -- Office Home, My Actions, and the Executive
// Dashboard all need "which office is this obligation for, and what human
// label/drill-down link does it deserve," so that resolution lives here
// once instead of three times.
type Entities = {
  RecurringObligationSchedule: PrismaClient["recurringObligationSchedule"];
  UtilityAccount: PrismaClient["utilityAccount"];
  Lease: PrismaClient["lease"];
  AMCContract: PrismaClient["aMCContract"];
};

export type ScheduleContext = {
  scheduleId: string;
  scopeType: string;
  officeId: string | null;
  ownerUserId: string;
  label: string;
  url: string;
};

export async function buildScheduleContextMap(
  entities: Entities,
  orgId: string,
): Promise<Map<string, ScheduleContext>> {
  // Every schedule, not just active ones -- a terminated lease's past
  // obligation instances still need a label/link when they show up in a
  // report, and callers filter instances by status/date themselves.
  const schedules = await entities.RecurringObligationSchedule.findMany({ where: { org_id: orgId } });

  const utilityIds = schedules.filter((s) => s.scope_type === "utility").map((s) => s.scope_ref_id);
  const leaseIds = schedules.filter((s) => s.scope_type === "rent" || s.scope_type === "cam").map((s) => s.scope_ref_id);
  const amcIds = schedules.filter((s) => s.scope_type === "amc").map((s) => s.scope_ref_id);

  // findMany with an empty `in` array just returns [] -- no need to branch
  // on ids.length, which was tripping up TS's inference across the tuple.
  const [accounts, leases, contracts] = await Promise.all([
    entities.UtilityAccount.findMany({ where: { id: { in: utilityIds } } }),
    entities.Lease.findMany({ where: { id: { in: leaseIds } }, include: { landlord: true } }),
    entities.AMCContract.findMany({ where: { id: { in: amcIds } }, include: { vendor: true } }),
  ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const leaseById = new Map(leases.map((l) => [l.id, l]));
  const contractById = new Map(contracts.map((c) => [c.id, c]));

  // An AMC contract linked to a utility_account (not an office directly)
  // needs that account's office too -- a second, smaller lookup.
  const amcUtilityIds = contracts
    .filter((c) => c.linked_entity_type === "utility_account")
    .map((c) => c.linked_entity_id);
  const amcAccounts = await entities.UtilityAccount.findMany({ where: { id: { in: amcUtilityIds } } });
  const amcAccountById = new Map(amcAccounts.map((a) => [a.id, a]));

  const map = new Map<string, ScheduleContext>();
  for (const s of schedules) {
    if (s.scope_type === "utility") {
      const acct = accountById.get(s.scope_ref_id);
      if (acct) {
        map.set(s.id, {
          scheduleId: s.id,
          scopeType: "utility",
          officeId: acct.office_id,
          ownerUserId: s.owner_user_id,
          label: `${acct.provider_name} (utility)`,
          url: `/app/utilities/${acct.id}`,
        });
      }
    } else if (s.scope_type === "rent" || s.scope_type === "cam") {
      const lease = leaseById.get(s.scope_ref_id);
      if (lease) {
        map.set(s.id, {
          scheduleId: s.id,
          scopeType: s.scope_type,
          officeId: lease.office_id,
          ownerUserId: s.owner_user_id,
          label: `${lease.landlord.name} (${s.scope_type})`,
          url: `/app/property/leases/${lease.id}`,
        });
      }
    } else if (s.scope_type === "amc") {
      const contract = contractById.get(s.scope_ref_id);
      if (contract) {
        const officeId =
          contract.linked_entity_type === "office"
            ? contract.linked_entity_id
            : (amcAccountById.get(contract.linked_entity_id)?.office_id ?? null);
        map.set(s.id, {
          scheduleId: s.id,
          scopeType: "amc",
          officeId,
          ownerUserId: s.owner_user_id,
          label: `${contract.vendor.name} (AMC)`,
          url: `/app/vendors/${contract.vendor_id}`,
        });
      }
    }
  }
  return map;
}
