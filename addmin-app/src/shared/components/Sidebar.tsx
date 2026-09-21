import { useLocation } from "react-router";
import { logout, useAuth } from "wasp/client/auth";
import { Link } from "wasp/client/router";
import Logo from "../../assets/addmin-logo.png";
import { Button } from "./Button";

const UTILITIES_ROLES = new Set([
  "platform_admin",
  "office_admin",
  "office_head",
  "vendor_manager",
]);

const LEASES_ROLES = new Set(["platform_admin", "office_admin", "office_head", "payment_authorizer"]);

const VENDORS_ROLES = new Set(["platform_admin", "vendor_manager", "office_admin", "facility_staff"]);

// Converted from a horizontal top bar to a fixed left column -- same nav
// items and role gating as before, just laid out vertically so the item
// list can grow (Step 08 keeps adding domains) without wrapping or
// crowding a single row.
export function Sidebar() {
  const { data: user } = useAuth();
  const location = useLocation();
  const canManageWorkflow = user?.role === "platform_admin" || user?.role === "office_admin";
  const showUtilities = !!user?.role && UTILITIES_ROLES.has(user.role);
  const showLeases = !!user?.role && LEASES_ROLES.has(user.role);
  const showVendors = !!user?.role && VENDORS_ROLES.has(user.role);

  const navItems = [
    { to: "/app/offices", label: "Offices", show: true },
    { to: "/app/utilities", label: "Utilities", show: showUtilities },
    { to: "/app/property/leases", label: "Leases", show: showLeases },
    { to: "/app/vendors", label: "Vendors", show: showVendors },
    { to: "/app/bills", label: "Bills", show: true },
    { to: "/app/approvals", label: "Approvals", show: true },
    { to: "/app/payments", label: "Payments", show: true },
    { to: "/app/subscribe", label: "Subscription", show: true },
    { to: "/admin/workflow", label: "Workflow", show: canManageWorkflow },
    { to: "/admin/users", label: "Users", show: canManageWorkflow },
  ] as const;

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <Link to="/" className="flex items-center gap-2 border-b border-neutral-200 p-4">
        <img src={Logo} alt="AddMin" className="h-10 w-auto" />
      </Link>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`block rounded-md px-3 py-2 text-sm font-semibold ${
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
        </ul>
      </nav>

      <div className="border-t border-neutral-200 p-3">
        <Button onClick={logout} className="w-full">
          Log out
        </Button>
      </div>
    </aside>
  );
}
