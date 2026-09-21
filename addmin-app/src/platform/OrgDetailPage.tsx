import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { platformApiUrl } from "./apiBase";

type OrgRow = {
  id: string;
  name: string;
  tenant_status: string;
  plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
};

const PLANS = ["starter", "growth", "enterprise"];
const STATUSES = ["trialing", "active", "past_due", "expired", "canceled"];

// F-20: manual override surface for a single org -- the "sales-assisted
// Enterprise" alternate path (05-features.md, F-19) lands here: a Platform
// Operator sets plan=enterprise/status=active directly, no Stripe checkout.
export function OrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    const res = await fetch(platformApiUrl("/platform/organizations"), { credentials: "include" });
    if (res.status === 401) {
      window.location.href = "/platform/signin";
      return;
    }
    const orgs: OrgRow[] = await res.json();
    const found = orgs.find((o) => o.id === orgId) ?? null;
    setOrg(found);
    if (found) {
      setPlan(found.plan ?? "starter");
      setStatus(found.subscription_status ?? "trialing");
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function toggleTenantStatus() {
    if (!org) return;
    const next = org.tenant_status === "suspended" ? "active" : "suspended";
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(platformApiUrl(`/platform/organizations/${orgId}/tenant-status`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenant_status: next }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Failed to update.");
      setMessage(`Tenant status set to ${next}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSubscription(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(platformApiUrl(`/platform/organizations/${orgId}/subscription`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan, status }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Failed to update.");
      setMessage("Subscription updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!org) {
    return <div className="mx-auto w-full max-w-2xl p-12">{error ?? "Loading…"}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-12">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">{org.name}</h1>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-4 text-sm text-primary-700">{message}</p>}

      <div className="card mb-6 p-6">
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Tenant status</h2>
        <p className="mb-3 text-sm text-neutral-600">
          Currently <strong>{org.tenant_status}</strong>. Suspending blocks every API call for this
          org's users immediately.
        </p>
        <button
          onClick={toggleTenantStatus}
          disabled={isSaving}
          className={`rounded-md px-4 py-2 font-semibold text-white ${
            org.tenant_status === "suspended"
              ? "bg-primary-500 hover:bg-primary-600"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {org.tenant_status === "suspended" ? "Reactivate" : "Suspend"}
        </button>
      </div>

      <form onSubmit={saveSubscription} className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Subscription (manual override)</h2>
        <div className="mb-3 flex gap-3">
          <label className="flex-1 text-sm">
            Plan
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 text-sm">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-primary-500 px-4 py-2 font-semibold text-white hover:bg-primary-600"
        >
          Save
        </button>
      </form>
    </div>
  );
}
