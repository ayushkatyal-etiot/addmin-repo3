export type NavSearchRoute = {
  prefix: string;
  label: string;
  description: string;
};

// Jump-to-page search (command palette) — labels are not shown in the top bar.
export const NAV_SEARCH_ROUTES: NavSearchRoute[] = [
  {
    prefix: "/app/utilities/new",
    label: "Add utility connection",
    description: "Register a new electricity, water, or other utility account for an office.",
  },
  {
    prefix: "/app/bills/new",
    label: "Enter bill",
    description: "Record a utility bill against a connection and submit it for approval.",
  },
  {
    prefix: "/app/property/leases/new",
    label: "Add lease",
    description: "Create a lease with rent, dates, and landlord details.",
  },
  {
    prefix: "/app/offices/new",
    label: "Add office",
    description: "Onboard a new office location to your organization.",
  },
  {
    prefix: "/app/dashboard",
    label: "Dashboard",
    description: "Overview of offices, spend, compliance, and recent activity.",
  },
  {
    prefix: "/app/offices",
    label: "Offices",
    description: "View and manage all offices.",
  },
  {
    prefix: "/app/utilities",
    label: "Utility connections",
    description: "List utility accounts and expected billing periods.",
  },
  {
    prefix: "/app/property/leases",
    label: "Leases",
    description: "Manage property leases, rent, and payment history.",
  },
  {
    prefix: "/app/vendors",
    label: "Vendors",
    description: "View vendors, AMC contracts, and activation status.",
  },
  {
    prefix: "/app/maintenance",
    label: "Maintenance",
    description: "Track maintenance requests and work orders.",
  },
  {
    prefix: "/app/assets",
    label: "Assets",
    description: "Register and manage office assets and warranties.",
  },
  {
    prefix: "/app/asset-requests",
    label: "Asset requests",
    description: "Review and fulfill employee asset requests.",
  },
  {
    prefix: "/app/compliance",
    label: "Compliance",
    description: "Upload certificates and track expiry by compliance type.",
  },
  {
    prefix: "/app/bills",
    label: "Bills",
    description: "Browse utility bills across connections and statuses.",
  },
  {
    prefix: "/app/approvals",
    label: "Approval queue",
    description: "Approve or reject bills waiting in your queue.",
  },
  {
    prefix: "/app/payments",
    label: "Payments",
    description: "Record and review authorized bill payments.",
  },
  {
    prefix: "/app/subscribe",
    label: "Subscription",
    description: "View plan, trial status, and billing subscription.",
  },
  {
    prefix: "/admin/workflow",
    label: "Approval workflow",
    description: "Configure approval tiers and rules for your org.",
  },
  {
    prefix: "/admin/users",
    label: "Users",
    description: "Invite users and assign offices, roles, and managers.",
  },
];

export function findNavSearchRoute(query: string): NavSearchRoute | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return filterNavSearchRoutes(query)[0];
}

export function filterNavSearchRoutes(query: string): NavSearchRoute[] {
  const q = query.trim().toLowerCase();
  const routes = [...NAV_SEARCH_ROUTES];
  if (!q) {
    return routes.sort((a, b) => a.label.localeCompare(b.label));
  }
  return routes
    .filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.prefix.toLowerCase().includes(q),
    )
    .sort((a, b) => {
      const aLabel = a.label.toLowerCase().startsWith(q);
      const bLabel = b.label.toLowerCase().startsWith(q);
      if (aLabel !== bLabel) return aLabel ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
}
