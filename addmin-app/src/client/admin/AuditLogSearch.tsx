import { useState } from "react";
import { useQuery, searchAuditLogs } from "wasp/client/operations";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { Button } from "../../shared/components/Button";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

// Build Step 11: search/filter over AuditLog, previously only queryable
// directly against the DB. entity_type/action are free strings across every
// module (see assertRole/assertOfficeScope's action name arg and each
// operation's AuditLog.create calls) so filtering here is substring/exact
// match, not a fixed enum.
export function AuditLogSearch() {
  const [entityType, setEntityType] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery(searchAuditLogs, {
    entityType: entityType || undefined,
    actorEmail: actorEmail || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function onFilterChange<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(1);
      setter(v);
    };
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Audit logs</h1>
      <ErrorBanner error={error} />

      <div className="card mb-6 grid grid-cols-4 gap-4 p-5">
        <div>
          <label className="label">Entity type</label>
          <input
            className={inputClass}
            placeholder="e.g. Lease, WorkOrder"
            value={entityType}
            onChange={(e) => onFilterChange(setEntityType)(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Actor email</label>
          <input
            className={inputClass}
            placeholder="contains..."
            value={actorEmail}
            onChange={(e) => onFilterChange(setActorEmail)(e.target.value)}
          />
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className={inputClass} value={from} onChange={(e) => onFilterChange(setFrom)(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className={inputClass} value={to} onChange={(e) => onFilterChange(setTo)(e.target.value)} />
        </div>
      </div>

      {isLoading ? null : (
        <>
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">When</th>
                <th className="table-head-cell">Actor</th>
                <th className="table-head-cell">Action</th>
                <th className="table-head-cell">Entity</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r) => (
                <tr key={r.id} className="table-row-hover">
                  <td className="table-cell text-neutral-500">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="table-cell text-neutral-700">
                    {r.actorEmail ?? (r.actor_platform_operator_id ? "Platform operator" : "System")}
                  </td>
                  <td className="table-cell text-neutral-900">{r.action}</td>
                  <td className="table-cell text-neutral-600">
                    {r.entity_type} · {r.entity_id}
                  </td>
                </tr>
              ))}
              {(data?.rows.length ?? 0) === 0 && (
                <tr>
                  <td className="table-cell text-neutral-400" colSpan={4}>
                    No matching activity.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-neutral-500">
              Page {page} of {totalPages} ({data?.total ?? 0} total)
            </span>
            <div className="flex gap-2">
              <Button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
