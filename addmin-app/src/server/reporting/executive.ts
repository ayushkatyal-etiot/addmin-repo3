import { HttpError } from "wasp/server";
import type { GetExecutiveDashboard } from "wasp/server/operations";
import { assertRole, userFromSession, type Role } from "../shared/authz";
import { buildScheduleContextMap } from "./scheduleContext";

// Build Step 09, F-18: cross-office view for Office Head/Senior Management.
// Filters (office/module/period/status) are combinable -- the client
// persists them in the URL (useSearchParams), this just accepts whatever
// combination arrives. Every KPI is backed by the same `items` list
// returned alongside it, which is the drill-down: each item carries the
// url of its real source record, nothing here is a bare number with no
// way to see what it's counting.
export const EXECUTIVE_ROLES: Role[] = ["platform_admin", "office_head"];

type LineItem = {
  id: string;
  office: string;
  module: string;
  label: string;
  subtitle: string;
  date: string | null;
  status: "overdue" | "due_soon" | "renewal" | "compliance_gap";
  url: string;
};

type ExecutiveDashboardInput = {
  officeId?: string;
  module?: string; // "utility" | "rent" | "cam" | "amc" | "compliance"
  status?: string; // "overdue" | "due_soon" | "renewal" | "compliance_gap"
  from?: string;
  to?: string;
};

type ExecutiveDashboardResult = {
  kpis: { overdue: number; dueSoon: number; upcomingRenewals: number; complianceGaps: number; totalSpend: number };
  spendByOffice: Array<{ officeId: string; officeName: string; amount: number }>;
  items: LineItem[];
};

const RENEWAL_WINDOW_DAYS = 90;
const DUE_SOON_WINDOW_DAYS = 14;

export const getExecutiveDashboard: GetExecutiveDashboard<ExecutiveDashboardInput, ExecutiveDashboardResult> = async (
  filters,
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, EXECUTIVE_ROLES, context.entities, "getExecutiveDashboard");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");
  const orgId = user.org_id;

  const today = new Date();
  const dueSoonCutoff = new Date(today.getTime() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const renewalCutoff = new Date(today.getTime() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const fromDate = filters.from ? new Date(filters.from) : null;
  const toDate = filters.to ? new Date(filters.to) : null;

  const offices = await context.entities.Office.findMany({ where: { org_id: orgId } });
  const officeNameById = new Map(offices.map((o) => [o.id, o.name]));
  const officeIds = filters.officeId ? [filters.officeId] : offices.map((o) => o.id);

  const scheduleContext = await buildScheduleContextMap(context.entities, orgId);
  const relevantScheduleIds = [...scheduleContext.values()]
    .filter((c) => officeIds.includes(c.officeId ?? ""))
    .filter((c) => !filters.module || c.scopeType === filters.module)
    .map((c) => c.scheduleId);

  const items: LineItem[] = [];

  if (!filters.module || ["utility", "rent", "cam", "amc"].includes(filters.module)) {
    const [overdueInstances, dueSoonInstances] = await Promise.all([
      relevantScheduleIds.length
        ? context.entities.ObligationInstance.findMany({
            where: { org_id: orgId, schedule_id: { in: relevantScheduleIds }, status: "missing" },
          })
        : [],
      relevantScheduleIds.length
        ? context.entities.ObligationInstance.findMany({
            where: { org_id: orgId, schedule_id: { in: relevantScheduleIds }, status: "expected", expected_date: { lte: dueSoonCutoff } },
          })
        : [],
    ]);

    for (const [instances, status] of [
      [overdueInstances, "overdue"],
      [dueSoonInstances, "due_soon"],
    ] as const) {
      for (const instance of instances) {
        if (inDateRange(instance.expected_date, fromDate, toDate) === false) continue;
        const ctx = scheduleContext.get(instance.schedule_id);
        if (!ctx) continue;
        items.push({
          id: `${status}-${instance.id}`,
          office: officeNameById.get(ctx.officeId ?? "") ?? "Unknown office",
          module: ctx.scopeType,
          label: ctx.label,
          subtitle: `Period ${instance.period}`,
          date: instance.expected_date.toISOString(),
          status,
          url: ctx.url,
        });
      }
    }
  }

  if (!filters.module || filters.module === "rent") {
    const leases = await context.entities.Lease.findMany({
      where: {
        org_id: orgId,
        office_id: { in: officeIds },
        status: { in: ["active", "expiring"] },
        end_date: { lte: renewalCutoff },
      },
      include: { landlord: true },
    });
    for (const l of leases) {
      if (inDateRange(l.end_date, fromDate, toDate) === false) continue;
      items.push({
        id: `renewal-lease-${l.id}`,
        office: officeNameById.get(l.office_id) ?? "Unknown office",
        module: "rent",
        label: `Lease: ${l.landlord.name}`,
        subtitle: "Renewal due",
        date: l.end_date.toISOString(),
        status: "renewal",
        url: `/app/property/leases/${l.id}`,
      });
    }
  }

  if (!filters.module || filters.module === "amc") {
    const amcContracts = await context.entities.AMCContract.findMany({
      where: { org_id: orgId, status: { in: ["active", "due_for_renewal"] }, end_date: { lte: renewalCutoff } },
      include: { vendor: true },
    });
    const utilityAccountIds = amcContracts
      .filter((c) => c.linked_entity_type === "utility_account")
      .map((c) => c.linked_entity_id);
    const utilityAccounts = utilityAccountIds.length
      ? await context.entities.UtilityAccount.findMany({ where: { id: { in: utilityAccountIds } } })
      : [];
    const officeIdByAccountId = new Map(utilityAccounts.map((a) => [a.id, a.office_id]));

    for (const c of amcContracts) {
      const contractOfficeId = c.linked_entity_type === "office" ? c.linked_entity_id : officeIdByAccountId.get(c.linked_entity_id);
      if (!contractOfficeId || !officeIds.includes(contractOfficeId)) continue;
      if (inDateRange(c.end_date, fromDate, toDate) === false) continue;
      items.push({
        id: `renewal-amc-${c.id}`,
        office: officeNameById.get(contractOfficeId) ?? "Unknown office",
        module: "amc",
        label: `AMC: ${c.vendor.name}`,
        subtitle: "Renewal due",
        date: c.end_date.toISOString(),
        status: "renewal",
        url: `/app/vendors/${c.vendor_id}`,
      });
    }
  }

  if (!filters.module || filters.module === "compliance") {
    const complianceItems = await context.entities.ComplianceItem.findMany({
      where: { org_id: orgId, office_id: { in: officeIds }, status: { in: ["missing", "expiring", "expired"] } },
    });
    for (const c of complianceItems) {
      items.push({
        id: `compliance-${c.id}`,
        office: officeNameById.get(c.office_id) ?? "Unknown office",
        module: "compliance",
        label: c.compliance_type,
        subtitle: c.status,
        date: c.expiry_date ? c.expiry_date.toISOString() : null,
        status: "compliance_gap",
        url: `/app/compliance?officeId=${c.office_id}`,
      });
    }
  }

  const filteredItems = filters.status ? items.filter((i) => i.status === filters.status) : items;

  // Spend: paid utility bills across offices in scope, for the same period filter.
  const bills = await context.entities.UtilityBill.findMany({
    where: { org_id: orgId, utilityAccount: { office_id: { in: officeIds } } },
    include: { utilityAccount: true },
  });
  const spendByOfficeMap = new Map<string, number>();
  let totalSpend = 0;
  for (const bill of bills) {
    if (inDateRange(bill.due_date, fromDate, toDate) === false) continue;
    const amount = Number(bill.amount);
    totalSpend += amount;
    spendByOfficeMap.set(bill.utilityAccount.office_id, (spendByOfficeMap.get(bill.utilityAccount.office_id) ?? 0) + amount);
  }

  return {
    kpis: {
      overdue: items.filter((i) => i.status === "overdue").length,
      dueSoon: items.filter((i) => i.status === "due_soon").length,
      upcomingRenewals: items.filter((i) => i.status === "renewal").length,
      complianceGaps: items.filter((i) => i.status === "compliance_gap").length,
      totalSpend,
    },
    spendByOffice: [...spendByOfficeMap.entries()].map(([id, amount]) => ({
      officeId: id,
      officeName: officeNameById.get(id) ?? "Unknown office",
      amount,
    })),
    items: filteredItems.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).slice(0, 200),
  };
};

function inDateRange(date: Date, from: Date | null, to: Date | null): boolean {
  if (from && date.getTime() < from.getTime()) return false;
  if (to && date.getTime() > to.getTime()) return false;
  return true;
}
