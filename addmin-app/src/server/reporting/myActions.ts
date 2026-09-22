import type { ListMyActions } from "wasp/server/operations";
import type { PrismaClient } from "@prisma/client";
import { userFromSession } from "../shared/authz";
import { buildScheduleContextMap } from "./scheduleContext";

// Build Step 09, F-18: "My Actions queue aggregates pending items across
// Utility, Lease, Maintenance, Asset, Vendor, and Compliance modules into
// one list per user." Deliberately no new table -- the Reporting Module
// "owns no primary data" (04-architecture.md); this reads across the
// modules that already exist and normalizes into one shape.
export type ActionItem = {
  id: string;
  module: "utility" | "lease" | "maintenance" | "asset" | "vendor" | "compliance";
  title: string;
  subtitle: string;
  url: string;
  dueDate: string | null;
  severity: "overdue" | "due_soon" | "normal";
};

function officeIdsInScope(user: { role: string | null; office_scope: unknown }, allOfficeIds: string[]): string[] {
  if (user.role === "platform_admin") return allOfficeIds;
  return Object.keys((user.office_scope ?? {}) as Record<string, string[]>);
}

function severityFor(daysUntilDue: number): ActionItem["severity"] {
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 7) return "due_soon";
  return "normal";
}

export const listMyActions: ListMyActions<void, ActionItem[]> = async (_args, context) => {
  const user = await userFromSession(context.user, context.entities);
  if (!user.org_id) return [];
  const orgId = user.org_id;
  const today = new Date();

  const allOffices = await context.entities.Office.findMany({ where: { org_id: orgId }, select: { id: true } });
  const allOfficeIds = allOffices.map((o) => o.id);
  const myOfficeIds = officeIdsInScope(user, allOfficeIds);

  const items: ActionItem[] = [];

  // --- Utility: bills pending my approval, or awaiting my payment. ---
  const pendingApprovalSteps = await context.entities.ApprovalStep.findMany({
    where: { org_id: orgId, approver_user_id: user.id, status: "pending", payable_type: "utility_bill" },
    include: { utilityBill: { include: { utilityAccount: true } } },
  });
  for (const step of pendingApprovalSteps) {
    if (!step.utilityBill) continue;
    items.push({
      id: `approval-${step.id}`,
      module: "utility",
      title: `Approve bill: ${step.utilityBill.utilityAccount.provider_name}`,
      subtitle: `${step.utilityBill.billing_period} · ${step.utilityBill.amount}`,
      url: `/app/bills/${step.utilityBill.id}`,
      dueDate: step.utilityBill.due_date.toISOString(),
      severity: severityFor(daysUntil(step.utilityBill.due_date, today)),
    });
  }

  if (user.role === "payment_authorizer") {
    const payableBills = await context.entities.UtilityBill.findMany({
      where: { org_id: orgId, status: { in: ["approved", "partially_paid", "overdue"] } },
      include: { utilityAccount: true },
    });
    for (const bill of payableBills) {
      if (!myOfficeIds.includes(bill.utilityAccount.office_id)) continue;
      items.push({
        id: `pay-${bill.id}`,
        module: "utility",
        title: `Record payment: ${bill.utilityAccount.provider_name}`,
        subtitle: `${bill.billing_period} · ${bill.amount}`,
        url: `/app/bills/${bill.id}`,
        dueDate: bill.due_date.toISOString(),
        severity: severityFor(daysUntil(bill.due_date, today)),
      });
    }
  }

  // --- Utility/Lease/AMC: obligations I own that are missing. ---
  const scheduleContext = await buildScheduleContextMap(context.entities, orgId);
  const myMissingInstances = await context.entities.ObligationInstance.findMany({
    where: { org_id: orgId, status: "missing" },
  });
  for (const instance of myMissingInstances) {
    const ctx = scheduleContext.get(instance.schedule_id);
    if (!ctx || ctx.ownerUserId !== user.id) continue;
    items.push({
      id: `obligation-${instance.id}`,
      module: ctx.scopeType === "utility" ? "utility" : "lease",
      title: `Missing: ${ctx.label}`,
      subtitle: `Period ${instance.period}`,
      url: ctx.url,
      dueDate: instance.expected_date.toISOString(),
      severity: "overdue",
    });
  }

  // --- Asset: requests pending my approval as a manager. ---
  const pendingMyApproval = await context.entities.AssetRequest.findMany({
    where: { org_id: orgId, status: "pending_manager_approval", requestedBy: { manager_user_id: user.id } },
    include: { requestedBy: true },
  });
  for (const r of pendingMyApproval) {
    items.push({
      id: `asset-approve-${r.id}`,
      module: "asset",
      title: `Approve asset request: ${r.category}`,
      subtitle: `${r.requestedBy.email} — "${r.reason}"`,
      url: "/app/asset-requests",
      dueDate: null,
      severity: "normal",
    });
  }

  // --- Asset: requests awaiting allocation, for admins in scope. ---
  if (user.role === "platform_admin" || user.role === "office_admin") {
    const awaitingAllocation = await context.entities.AssetRequest.findMany({
      where: { org_id: orgId, status: { in: ["pending_allocation", "procurement_pending"] } },
    });
    for (const r of awaitingAllocation) {
      if (!myOfficeIds.includes(r.office_id)) continue;
      items.push({
        id: `asset-allocate-${r.id}`,
        module: "asset",
        title: `Allocate asset: ${r.category}`,
        subtitle: r.status === "procurement_pending" ? "Awaiting procurement" : "Ready to allocate",
        url: `/app/assets?officeId=${r.office_id}`,
        dueDate: null,
        severity: "normal",
      });
    }
  }

  // --- Maintenance: open requests (no work order yet), for admins. ---
  if (user.role === "platform_admin" || user.role === "office_admin") {
    const openRequests = await context.entities.MaintenanceRequest.findMany({
      where: { org_id: orgId, status: "open" },
    });
    for (const r of openRequests) {
      if (!myOfficeIds.includes(r.office_id)) continue;
      items.push({
        id: `maint-open-${r.id}`,
        module: "maintenance",
        title: `Create work order: ${r.category}`,
        subtitle: `Priority: ${r.priority}`,
        url: `/app/maintenance/${r.id}`,
        dueDate: null,
        severity: r.priority === "critical" || r.priority === "high" ? "due_soon" : "normal",
      });
    }
  }

  // --- Maintenance: work orders I need to execute, for facility staff. ---
  if (user.role === "facility_staff" || user.role === "office_admin" || user.role === "platform_admin") {
    const myWorkOrders = await context.entities.WorkOrder.findMany({
      where: { org_id: orgId, status: { in: ["assigned", "in_progress"] } },
      include: { maintenanceRequest: true },
    });
    for (const wo of myWorkOrders) {
      if (!myOfficeIds.includes(wo.maintenanceRequest.office_id)) continue;
      items.push({
        id: `maint-execute-${wo.id}`,
        module: "maintenance",
        title: `${wo.status === "assigned" ? "Start" : "Complete"} work order: ${wo.maintenanceRequest.category}`,
        subtitle: `SLA due ${new Date(wo.sla_due_at).toLocaleDateString()}`,
        url: `/app/maintenance/${wo.maintenance_request_id}`,
        dueDate: wo.sla_due_at.toISOString(),
        severity: severityFor(daysUntil(wo.sla_due_at, today)),
      });
    }
  }

  // --- Vendor: pending activation. ---
  if (user.role === "platform_admin" || user.role === "vendor_manager") {
    const pendingVendors = await context.entities.Vendor.findMany({
      where: { org_id: orgId, status: "pending_activation" },
    });
    for (const v of pendingVendors) {
      items.push({
        id: `vendor-${v.id}`,
        module: "vendor",
        title: `Activate vendor: ${v.name}`,
        subtitle: v.category,
        url: `/app/vendors/${v.id}`,
        dueDate: null,
        severity: "normal",
      });
    }
  }

  // --- Compliance: missing/expiring/expired items, for admins/coordinators. ---
  if (user.role === "platform_admin" || user.role === "office_admin" || user.role === "compliance_coordinator") {
    const complianceItems = await context.entities.ComplianceItem.findMany({
      where: { org_id: orgId, status: { in: ["missing", "expiring", "expired"] } },
    });
    for (const c of complianceItems) {
      if (!myOfficeIds.includes(c.office_id)) continue;
      items.push({
        id: `compliance-${c.id}`,
        module: "compliance",
        title: `${c.status === "missing" ? "Upload" : "Renew"}: ${c.compliance_type}`,
        subtitle: c.expiry_date ? `Expires ${new Date(c.expiry_date).toLocaleDateString()}` : "No document on file",
        url: `/app/compliance?officeId=${c.office_id}`,
        dueDate: c.expiry_date ? c.expiry_date.toISOString() : null,
        severity: c.status === "expired" ? "overdue" : c.status === "expiring" ? "due_soon" : "normal",
      });
    }
  }

  // Onboarding checklist items are no longer surfaced here -- the guided
  // setup checklist is hidden per
  // planmysaas-blueprint/11-without-setup-decision.md ("Option A").

  // Overdue first, then soonest due date, undated items last.
  const severityRank = { overdue: 0, due_soon: 1, normal: 2 };
  return items.sort((a, b) => {
    const rankDiff = severityRank[a.severity] - severityRank[b.severity];
    if (rankDiff !== 0) return rankDiff;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
};

function daysUntil(date: Date, today: Date): number {
  const floor = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((floor(date) - floor(today)) / (24 * 60 * 60 * 1000));
}
