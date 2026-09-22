import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import { useQuery, listVendors, createVendor, bulkImportVendors, getMyUserContext } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { BulkImportPanel } from "../../shared/components/BulkImportPanel";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { PageLoading } from "../../shared/components/PageLoading";
import { sentenceCase } from "../../shared/text";

const CATEGORIES = ["utility_provider", "dg", "ups", "solar", "amc", "building_mgmt", "other"];

const STATUS_TONE: Record<string, BadgeTone> = {
  pending_activation: "warning",
  active: "success",
  suspended: "danger",
  inactive: "neutral",
};

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

// F-14: vendors are org-wide (no office nesting) -- register, then activate
// from the detail page once documents are validated.
export function VendorListPage() {
  const navigate = useNavigate();
  const { data: user, isLoading: authLoading } = useAuth();
  const { data: userContext, isLoading: contextLoading } = useQuery(getMyUserContext, undefined, {
    enabled: !!user,
  });
  const canManageVendors = userContext?.canManageVendors ?? false;

  const { data: vendors, isLoading, error: loadError, refetch } = useQuery(listVendors, undefined, {
    enabled: !!user,
  });

  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [panGstin, setPanGstin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createVendor({ name, category, pan_gstin: panGstin || undefined });
      setName("");
      setPanGstin("");
      setShowForm(false);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register vendor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || contextLoading || isLoading) return <PageLoading />;

  return (
    <div className="mx-auto w-full max-w-4xl p-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Vendors</h1>
        {canManageVendors && (
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className="text-sm font-semibold text-primary-600 underline"
            >
              Bulk import (CSV)
            </button>
            <Button type="button" onClick={() => setShowForm((open) => !open)}>
              {showForm ? "Cancel" : "Add vendor"}
            </Button>
          </div>
        )}
      </div>

      <ErrorBanner error={loadError} />

      {canManageVendors && showImport && (
        <BulkImportPanel
          header="name,category,pan_gstin"
          examples="Acme DG Services,dg,29ABCDE1234F1Z5"
          onImport={async (csv) => {
            const result = await bulkImportVendors({ csv });
            await refetch();
            return result;
          }}
        />
      )}

      {canManageVendors && showForm && (
        <form onSubmit={onSubmit} className="card mb-8 flex flex-col gap-4 p-8">
          <h2 className="text-lg font-semibold text-neutral-900">Register a vendor</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Name</label>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="select-field" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {sentenceCase(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">PAN / GSTIN (optional)</label>
              <input className={inputClass} value={panGstin} onChange={(e) => setPanGstin(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={isSubmitting || !name} className="self-start">
            Register vendor
          </Button>
        </form>
      )}

      {!canManageVendors && userContext?.role && (
        <p className="mb-4 text-sm text-neutral-500">
          Your role ({userContext.role.replace(/_/g, " ")}) can view vendors. Only platform admins and vendor managers
          can register new vendors.
        </p>
      )}

      {!loadError && (vendors?.length ?? 0) === 0 && (
        <div className="card p-8 text-center text-neutral-500">
          {canManageVendors
            ? "No vendors in your organization yet — click Add vendor to register one."
            : "No vendors registered yet. Ask a platform admin or vendor manager to register vendors."}
        </div>
      )}

      {loadError && (
        <p className="text-xs text-neutral-500">
          If this mentions MFA, complete setup at <code className="text-xs">/mfa-setup</code> or verify at{" "}
          <code className="text-xs">/mfa-verify</code>, then refresh.
        </p>
      )}

      {vendors && vendors.length > 0 && (
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">Name</th>
                <th className="table-head-cell">Category</th>
                <th className="table-head-cell">PAN / GSTIN</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell" />
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr
                  key={v.id}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                  onClick={() => navigate(`/app/vendors/${v.id}`)}
                >
                  <td className="table-cell font-medium text-neutral-900">{v.name}</td>
                  <td className="table-cell text-neutral-600">{sentenceCase(v.category)}</td>
                  <td className="table-cell text-neutral-600">{v.pan_gstin ?? "—"}</td>
                  <td className="table-cell">
                    <Badge tone={STATUS_TONE[v.status] ?? "neutral"}>{sentenceCase(v.status)}</Badge>
                  </td>
                  <td className="table-cell text-right text-primary-600 underline">View</td>
                </tr>
              ))}
            </tbody>
          </table>
      )}
    </div>
  );
}
