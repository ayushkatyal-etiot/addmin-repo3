import { useEffect, useState } from "react";
import { Link } from "react-router";
import { platformApiUrl } from "./apiBase";
import { Badge } from "../shared/components/Badge";

type OrgRow = {
  id: string;
  name: string;
  tenant_status: string;
  plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
};

// F-20 (planmysaas-blueprint/05-features.md): Platform Operator-only, lists
// every customer Organization across org boundaries -- the one deliberate
// exception in the system. No customer-facing chrome (see 06-frontend.md).
export function OrgListPage() {
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(platformApiUrl("/platform/organizations"), { credentials: "include" })
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/platform/signin";
          return;
        }
        if (!res.ok) throw new Error("Failed to load organizations.");
        setOrgs(await res.json());
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."));
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl p-12">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Organizations</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!orgs && !error && <p className="text-neutral-500">Loading…</p>}

      {orgs && orgs.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">No organizations yet.</div>
      )}

      {orgs && orgs.length > 0 && (
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">Name</th>
                <th className="table-head-cell">Tenant status</th>
                <th className="table-head-cell">Plan</th>
                <th className="table-head-cell">Subscription</th>
                <th className="table-head-cell">Trial ends</th>
                <th className="table-head-cell" />
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} className="table-row-hover">
                  <td className="table-cell font-medium text-neutral-900">{org.name}</td>
                  <td className="table-cell">
                    <Badge tone={org.tenant_status === "suspended" ? "danger" : "success"}>
                      {org.tenant_status}
                    </Badge>
                  </td>
                  <td className="table-cell text-neutral-600">{org.plan ?? "—"}</td>
                  <td className="table-cell text-neutral-600">{org.subscription_status ?? "—"}</td>
                  <td className="table-cell text-neutral-600">
                    {org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="table-cell text-right">
                    <Link
                      to={`/platform/organizations/${org.id}`}
                      className="font-semibold text-primary-600 underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      )}
    </div>
  );
}
