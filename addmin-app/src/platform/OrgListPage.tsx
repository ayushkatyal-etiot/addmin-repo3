import { useEffect, useState } from "react";
import { Link } from "react-router";
import { platformApiUrl } from "./apiBase";

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
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Tenant status</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Trial ends</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3 font-medium text-neutral-900">{org.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        org.tenant_status === "suspended"
                          ? "bg-red-100 text-red-700"
                          : "bg-primary-100 text-primary-800"
                      }`}
                    >
                      {org.tenant_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{org.plan ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">{org.subscription_status ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
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
        </div>
      )}
    </div>
  );
}
