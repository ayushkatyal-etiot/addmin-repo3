import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, listVendors, createVendor } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { ErrorBanner } from "../../shared/components/ErrorBanner";

const CATEGORIES = ["utility_provider", "dg", "ups", "solar", "amc", "building_mgmt", "other"];

const STATUS_CLASS: Record<string, string> = {
  pending_activation: "bg-amber-100 text-amber-800",
  active: "bg-primary-100 text-primary-800",
  suspended: "bg-red-100 text-red-700",
  inactive: "bg-neutral-100 text-neutral-500",
};

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

// F-14: vendors are org-wide (no office nesting) -- register, then activate
// from the detail page once documents are validated.
export function VendorListPage() {
  const navigate = useNavigate();
  const { data: vendors, isLoading, error: loadError, refetch } = useQuery(listVendors);

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
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register vendor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className="mx-auto w-full max-w-4xl p-12">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Vendors</h1>

      <ErrorBanner error={loadError} />

      <form onSubmit={onSubmit} className="card mb-8 flex flex-col gap-4 p-8">
        <h2 className="text-lg font-semibold text-neutral-900">Register a vendor</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Name</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Category</label>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
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

      {vendors?.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">No vendors registered yet.</div>
      )}

      {vendors && vendors.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">PAN / GSTIN</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr
                  key={v.id}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                  onClick={() => navigate(`/app/vendors/${v.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-neutral-900">{v.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{v.category.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-neutral-600">{v.pan_gstin ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[v.status]}`}>
                      {v.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-primary-600 underline">View</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
