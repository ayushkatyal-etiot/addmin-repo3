import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, listMaintenanceRequests, createMaintenanceRequest } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { Button } from "../../shared/components/Button";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { PageLoading } from "../../shared/components/PageLoading";
import { useSelectedOffice } from "../../shared/SelectedOfficeContext";
import { sentenceCase } from "../../shared/text";

const PRIORITIES = ["low", "medium", "high", "critical"];

const PRIORITY_TONE: Record<string, BadgeTone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  open: "neutral",
  assigned: "info",
  in_progress: "warning",
  resolved: "success",
  closed: "neutral",
};

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

// F-15: any office-scoped Employee/Facility Staff/Office Admin can report a
// fault -- the office switcher + report form live together here, same
// pattern as UtilitiesListPage.tsx. Routing to a vendor and the SLA clock
// only start once an Office Admin creates a Work Order, on the detail page.
export function MaintenanceListPage() {
  const navigate = useNavigate();
  const { officeId, isLoading: officesLoading, error: officesError, hasOffices } = useSelectedOffice();
  const { data: requests, isLoading: requestsLoading, error: requestsError, refetch } = useQuery(
    listMaintenanceRequests,
    officeId ? { officeId } : undefined,
    { enabled: !!officeId },
  );

  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState(PRIORITIES[0]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createMaintenanceRequest({ office_id: officeId, category, priority, description: description || undefined });
      setCategory("");
      setDescription("");
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log maintenance request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (officesLoading) return <PageLoading />;

  if (officesError) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Maintenance</h1>
        <ErrorBanner error={officesError} />
      </div>
    );
  }

  if (!hasOffices) {
    return (
      <div className="p-6">
        <div className="card p-8 text-center text-neutral-500">
          No offices in your scope.{" "}
          <Link to="/app/offices/new" className="font-semibold text-primary-600 underline">
            Add an office
          </Link>{" "}
          (admins) or ask an admin to assign your office access.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Maintenance</h1>

      <form onSubmit={onSubmit} className="card mb-8 flex flex-col gap-4 p-8">
        <h2 className="text-lg font-semibold text-neutral-900">Report an issue</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Category</label>
            <input
              className={inputClass}
              placeholder="e.g. DG, UPS, plumbing"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="select-field" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {sentenceCase(p)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={isSubmitting || !category} className="self-start">
          Submit request
        </Button>
      </form>

      <ErrorBanner error={requestsError} />

      {requestsLoading && <PageLoading />}

      {!requestsLoading && requests?.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">No maintenance requests for this office yet.</div>
      )}

      {!requestsLoading && requests && requests.length > 0 && (
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">Category</th>
                <th className="table-head-cell">Priority</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell">Work order</th>
                <th className="table-head-cell" />
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                  onClick={() => navigate(`/app/maintenance/${r.id}`)}
                >
                  <td className="table-cell font-medium text-neutral-900">{r.category}</td>
                  <td className="table-cell">
                    <Badge tone={PRIORITY_TONE[r.priority] ?? "neutral"}>{sentenceCase(r.priority)}</Badge>
                  </td>
                  <td className="table-cell">
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{sentenceCase(r.status)}</Badge>
                  </td>
                  <td className="table-cell text-neutral-600">
                    {r.work_order_status ? sentenceCase(r.work_order_status) : "Not yet assigned"}
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
