import { HttpError } from "wasp/server";
import type { GetOfficeHome } from "wasp/server/operations";
import { assertRole, assertOfficeScope, userFromSession, ALL_ROLES } from "../shared/authz";
import { buildScheduleContextMap } from "./scheduleContext";

// Build Step 09, F-18: "Office Home shows current obligations, pending
// actions, overdue items, upcoming renewals, and setup completion in one
// view" for the Office Admin's default/assigned office. This is the real
// landing page (src/HomePage.tsx redirects here) -- replaces the old
// generic multi-office KPI mock (getDashboardSummary), which showed no
// obligations/renewals/pending-actions at all.
const RENEWAL_WINDOW_DAYS = 90;
const DUE_SOON_WINDOW_DAYS = 14;

type LineItem = { id: string; label: string; subtitle: string; date: string | null; url: string };

type OfficeHomeSummary = {
  officeId: string;
  officeName: string;
  completionPct: number;
  hasAnyActivity: boolean;
  obligationsDueSoon: LineItem[];
  obligationsOverdue: LineItem[];
  pendingApprovals: LineItem[];
  upcomingRenewals: LineItem[];
  complianceGapCount: number;
};

export const getOfficeHome: GetOfficeHome<{ officeId: string }, OfficeHomeSummary> = async (
  { officeId },
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, ALL_ROLES, context.entities, "getOfficeHome");
  await assertOfficeScope(user, officeId, context.entities, "getOfficeHome");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");
  const orgId = user.org_id;

  const office = await context.entities.Office.findUnique({ where: { id: officeId }, include: { setupProfile: true } });
  if (!office || office.org_id !== orgId) {
    throw new HttpError(404, "Office not found.");
  }

  const today = new Date();
  const dueSoonCutoff = new Date(today.getTime() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const renewalCutoff = new Date(today.getTime() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Obligations due soon / overdue, scoped to this office via the shared
  // schedule-context resolver (utility/rent/cam/amc all funnel through it).
  const scheduleContext = await buildScheduleContextMap(context.entities, orgId);
  const scheduleIdsForOffice = [...scheduleContext.values()].filter((c) => c.officeId === officeId).map((c) => c.scheduleId);

  const [dueSoonInstances, overdueInstances] = await Promise.all([
    scheduleIdsForOffice.length
      ? context.entities.ObligationInstance.findMany({
          where: { schedule_id: { in: scheduleIdsForOffice }, status: "expected", expected_date: { lte: dueSoonCutoff } },
          orderBy: { expected_date: "asc" },
        })
      : [],
    scheduleIdsForOffice.length
      ? context.entities.ObligationInstance.findMany({
          where: { schedule_id: { in: scheduleIdsForOffice }, status: "missing" },
          orderBy: { expected_date: "asc" },
        })
      : [],
  ]);

  const toLineItem = (instance: (typeof dueSoonInstances)[number]): LineItem => {
    const ctx = scheduleContext.get(instance.schedule_id);
    return {
      id: instance.id,
      label: ctx?.label ?? "Obligation",
      subtitle: `Period ${instance.period}`,
      date: instance.expected_date.toISOString(),
      url: ctx?.url ?? "/app/bills",
    };
  };

  // Pending approvals: bills pending approval, asset requests awaiting
  // allocation, maintenance requests without a work order -- all for this
  // office specifically.
  const [pendingBills, pendingAssetRequests, openMaintenance] = await Promise.all([
    context.entities.UtilityBill.findMany({
      where: { org_id: orgId, status: "pending_approval", utilityAccount: { office_id: officeId } },
      include: { utilityAccount: true },
    }),
    context.entities.AssetRequest.findMany({
      where: { org_id: orgId, office_id: officeId, status: { in: ["pending_manager_approval", "pending_allocation", "procurement_pending"] } },
    }),
    context.entities.MaintenanceRequest.findMany({
      where: { org_id: orgId, office_id: officeId, status: "open" },
    }),
  ]);

  const pendingApprovals: LineItem[] = [
    ...pendingBills.map((b) => ({
      id: `bill-${b.id}`,
      label: `Bill: ${b.utilityAccount.provider_name}`,
      subtitle: "Pending approval",
      date: b.due_date.toISOString(),
      url: `/app/bills/${b.id}`,
    })),
    ...pendingAssetRequests.map((r) => ({
      id: `asset-${r.id}`,
      label: `Asset request: ${r.category}`,
      subtitle: r.status.replace(/_/g, " "),
      date: null,
      url: "/app/asset-requests",
    })),
    ...openMaintenance.map((m) => ({
      id: `maint-${m.id}`,
      label: `Maintenance: ${m.category}`,
      subtitle: "Needs a work order",
      date: null,
      url: `/app/maintenance/${m.id}`,
    })),
  ];

  // Upcoming renewals: leases directly on this office, and AMC contracts
  // linked to this office (directly, or via a utility connection at this
  // office) -- same resolution rule as scheduleContext's, applied directly
  // to AMCContract rather than round-tripping through its schedule.
  const [leases, allAmcContracts] = await Promise.all([
    context.entities.Lease.findMany({
      where: { org_id: orgId, office_id: officeId, status: { in: ["active", "expiring"] }, end_date: { lte: renewalCutoff } },
      include: { landlord: true },
    }),
    context.entities.AMCContract.findMany({
      where: { org_id: orgId, status: { in: ["active", "due_for_renewal"] }, end_date: { lte: renewalCutoff } },
      include: { vendor: true },
    }),
  ]);
  const amcUtilityAccountIds = allAmcContracts
    .filter((c) => c.linked_entity_type === "utility_account")
    .map((c) => c.linked_entity_id);
  const amcUtilityAccounts = amcUtilityAccountIds.length
    ? await context.entities.UtilityAccount.findMany({ where: { id: { in: amcUtilityAccountIds } } })
    : [];
  const officeIdByUtilityAccountId = new Map(amcUtilityAccounts.map((a) => [a.id, a.office_id]));
  const amcContractsForOffice = allAmcContracts.filter((c) => {
    const contractOfficeId =
      c.linked_entity_type === "office" ? c.linked_entity_id : officeIdByUtilityAccountId.get(c.linked_entity_id);
    return contractOfficeId === officeId;
  });

  const upcomingRenewals: LineItem[] = [
    ...leases.map((l) => ({
      id: `lease-${l.id}`,
      label: `Lease: ${l.landlord.name}`,
      subtitle: "Renewal due",
      date: l.end_date.toISOString(),
      url: `/app/property/leases/${l.id}`,
    })),
    ...amcContractsForOffice.map((c) => ({
      id: `amc-${c.id}`,
      label: `AMC: ${c.vendor.name}`,
      subtitle: "Renewal due",
      date: c.end_date.toISOString(),
      url: `/app/vendors/${c.vendor_id}`,
    })),
  ].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const complianceGapCount = await context.entities.ComplianceItem.count({
    where: { org_id: orgId, office_id: officeId, status: { in: ["missing", "expiring", "expired"] } },
  });

  const hasAnyActivity =
    dueSoonInstances.length > 0 ||
    overdueInstances.length > 0 ||
    pendingApprovals.length > 0 ||
    upcomingRenewals.length > 0 ||
    complianceGapCount > 0;

  return {
    officeId: office.id,
    officeName: office.name,
    completionPct: Number(office.setupProfile?.completion_pct ?? 0),
    hasAnyActivity,
    obligationsDueSoon: dueSoonInstances.map(toLineItem),
    obligationsOverdue: overdueInstances.map(toLineItem),
    pendingApprovals,
    upcomingRenewals,
    complianceGapCount,
  };
};
