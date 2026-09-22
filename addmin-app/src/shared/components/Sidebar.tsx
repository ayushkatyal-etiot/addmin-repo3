import { ReactNode } from "react";
import { Link as WaspLink } from "wasp/client/router";
import { Link, useLocation } from "react-router";
import { useAuth } from "wasp/client/auth";
import Logo from "../../assets/addmin-logo.png";
import { useSelectedOffice } from "../SelectedOfficeContext";
import { sentenceCase } from "../text";
import { SidebarNavSearch } from "./SidebarNavSearch";

function roleLabelForOffice(
  globalRole: string | null | undefined,
  officeScope: unknown,
  officeId: string,
): string | null {
  if (globalRole === "platform_admin") return "Platform admin";
  if (officeId) {
    const scope = (officeScope ?? {}) as Record<string, string[]>;
    const perOffice = scope[officeId]?.[0];
    if (perOffice) return sentenceCase(perOffice);
  }
  return globalRole ? sentenceCase(globalRole) : null;
}

function displayNameFromEmail(email: string | undefined): string {
  if (!email) return "Account";
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function userInitials(email: string | undefined): string {
  return (email ?? "?")
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const UTILITIES_ROLES = new Set([
  "platform_admin",
  "office_admin",
  "office_head",
  "vendor_manager",
]);

const LEASES_ROLES = new Set(["platform_admin", "office_admin", "office_head", "payment_authorizer"]);

const VENDORS_ROLES = new Set(["platform_admin", "vendor_manager", "office_admin", "facility_staff"]);

const MAINTENANCE_ROLES = new Set(["platform_admin", "office_admin", "facility_staff", "employee"]);

const ASSETS_ADMIN_ROLES = new Set(["platform_admin", "office_admin"]);

const COMPLIANCE_ROLES = new Set(["platform_admin", "office_admin", "compliance_coordinator", "office_head"]);

const EXECUTIVE_ROLES = new Set(["platform_admin", "office_head"]);

// Restyled per Sample Dashboard.dc.html's sidebar (icons, section grouping,
// identity footer) -- same real nav items and role gating as before, just
// grouped into "Overview" (day-to-day) and "Manage" (admin-only), mirroring
// the mockup's two-section shape onto this app's actual IA: Workflow/Users
// are already gated to admin roles, so they're the closest real match to
// the mockup's Manage group.
export function Sidebar() {
  const { data: user } = useAuth();
  const { officeId, selectedOffice } = useSelectedOffice();
  const location = useLocation();
  const canManageWorkflow = user?.role === "platform_admin" || user?.role === "office_admin";
  const showUtilities = !!user?.role && UTILITIES_ROLES.has(user.role);
  const showLeases = !!user?.role && LEASES_ROLES.has(user.role);
  const showVendors = !!user?.role && VENDORS_ROLES.has(user.role);
  const showMaintenance = !!user?.role && MAINTENANCE_ROLES.has(user.role);
  const showAssetsAdmin = !!user?.role && ASSETS_ADMIN_ROLES.has(user.role);
  const showCompliance = !!user?.role && COMPLIANCE_ROLES.has(user.role);
  const showExecutive = !!user?.role && EXECUTIVE_ROLES.has(user.role);

  const overviewItems = [
    { to: "/app/dashboard", label: "Dashboard", icon: <DashboardIcon />, show: true },
    { to: "/app/my-actions", label: "My actions", icon: <MyActionsIcon />, show: true },
    { to: "/app/reports/executive", label: "Executive dashboard", icon: <ExecutiveIcon />, show: showExecutive },
    { to: "/app/offices", label: "Offices", icon: <BuildingIcon />, show: true },
    { to: "/app/utilities", label: "Utilities", icon: <UtilitiesIcon />, show: showUtilities },
    { to: "/app/property/leases", label: "Leases", icon: <LeasesIcon />, show: showLeases },
    { to: "/app/vendors", label: "Vendors", icon: <VendorsIcon />, show: showVendors },
    { to: "/app/maintenance", label: "Maintenance", icon: <MaintenanceIcon />, show: showMaintenance },
    { to: "/app/assets", label: "Assets", icon: <AssetsIcon />, show: showAssetsAdmin },
    { to: "/app/compliance", label: "Compliance", icon: <ComplianceIcon />, show: showCompliance },
    { to: "/app/asset-requests", label: "Asset requests", icon: <AssetRequestsIcon />, show: true },
    { to: "/app/bills", label: "Bills", icon: <BillsIcon />, show: true },
    { to: "/app/approvals", label: "Approvals", icon: <ApprovalsIcon />, show: true },
    { to: "/app/payments", label: "Payments", icon: <PaymentsIcon />, show: true },
    { to: "/app/subscribe", label: "Subscription", icon: <SubscriptionIcon />, show: true },
  ] as const;

  const manageItems = [
    { to: "/admin/workflow", label: "Workflow", icon: <WorkflowIcon />, show: canManageWorkflow },
    { to: "/admin/users", label: "Users", icon: <UsersIcon />, show: canManageWorkflow },
    { to: "/admin/notifications", label: "Notifications", icon: <BellIcon />, show: canManageWorkflow },
    { to: "/admin/audit-logs", label: "Audit logs", icon: <AuditLogIcon />, show: canManageWorkflow },
  ] as const;

  const initials = userInitials(user?.email ?? undefined);
  const displayName = displayNameFromEmail(user?.email ?? undefined);
  const officeRoleLabel = roleLabelForOffice(user?.role, user?.office_scope, officeId);

  return (
    <aside className="sticky top-0 flex h-screen w-62 shrink-0 flex-col overflow-hidden border-r border-neutral-100 bg-white p-3">
      <WaspLink to="/" className="mb-3 flex shrink-0 items-center gap-2 px-2">
        <img src={Logo} alt="AddMin" className="h-auto w-22 object-contain" />
      </WaspLink>

      <div className="mb-3 shrink-0">
        <SidebarNavSearch />
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-0.5"
        aria-label="Main navigation"
      >
        <NavGroup title="Overview" items={overviewItems} pathname={location.pathname} />
        {manageItems.some((i) => i.show) && (
          <NavGroup title="Manage" items={manageItems} pathname={location.pathname} />
        )}
      </nav>

      <div className="mt-3 flex shrink-0 items-start gap-2.5 border-t border-neutral-100 pt-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
          {initials || "?"}
        </div>
        <div className="min-w-0 flex-1 leading-snug">
          <div className="truncate text-sm font-semibold text-neutral-900" title={displayName}>
            {displayName}
          </div>
          {officeRoleLabel && (
            <div className="truncate text-xs font-medium text-primary-700" title={officeRoleLabel}>
              {officeRoleLabel}
            </div>
          )}
          {selectedOffice && (
            <div className="truncate text-xs text-neutral-500" title={selectedOffice.name}>
              {selectedOffice.name}
            </div>
          )}
          {user?.email && (
            <div className="truncate text-xs text-neutral-400" title={user.email}>
              {user.email}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavGroup({
  title,
  items,
  pathname,
}: {
  title: string;
  items: readonly { to: string; label: string; icon: ReactNode; show: boolean }[];
  pathname: string;
}) {
  const visible = items.filter((i) => i.show);
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="nav-section-label mb-1">{title}</div>
      {visible.map((item) => {
        const isActive = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`nav-item ${
              isActive ? "bg-primary-500 text-white" : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            <span className="flex shrink-0">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function icon(children: ReactNode) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function DashboardIcon() {
  return icon(
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </>,
  );
}

function BuildingIcon() {
  return icon(
    <>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    </>,
  );
}

function UtilitiesIcon() {
  return icon(<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />);
}

function LeasesIcon() {
  return icon(
    <>
      <path d="M15 2H9a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z" />
      <path d="M8 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4" />
      <path d="M16 7h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-4" />
    </>,
  );
}

function VendorsIcon() {
  return icon(
    <>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </>,
  );
}

function MaintenanceIcon() {
  return icon(<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />);
}

function AssetsIcon() {
  return icon(
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <circle cx="12" cy="16" r="1" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>,
  );
}

function ComplianceIcon() {
  return icon(
    <>
      <path d="M9 12l2 2 4-4" />
      <path d="M21 12c0 6-4.5 9-9 10-4.5-1-9-4-9-10V5l9-3 9 3Z" />
    </>,
  );
}

function MyActionsIcon() {
  return icon(
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </>,
  );
}

function ExecutiveIcon() {
  return icon(
    <>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>,
  );
}

function AssetRequestsIcon() {
  return icon(
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="m9 15 2 2 4-4" />
    </>,
  );
}

function BillsIcon() {
  return icon(
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </>,
  );
}

function ApprovalsIcon() {
  return icon(
    <>
      <path d="m9 12 2 2 4-4" />
      <circle cx="12" cy="12" r="10" />
    </>,
  );
}

function PaymentsIcon() {
  return icon(
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </>,
  );
}

function SubscriptionIcon() {
  return icon(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />);
}

function WorkflowIcon() {
  return icon(
    <>
      <rect width="8" height="8" x="3" y="3" rx="2" />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect width="8" height="8" x="13" y="13" rx="2" />
    </>,
  );
}

function AuditLogIcon() {
  return icon(
    <>
      <path d="M14 2v6h6" />
      <path d="M4 22V4a2 2 0 0 1 2-2h8l6 6v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </>,
  );
}

function BellIcon() {
  return icon(
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>,
  );
}

function UsersIcon() {
  return icon(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
  );
}
