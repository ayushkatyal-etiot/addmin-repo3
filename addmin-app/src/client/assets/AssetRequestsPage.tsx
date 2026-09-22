import { useState } from "react";
import {
  useQuery,
  listMyAssetRequests,
  listPendingManagerApprovals,
  createAssetRequest,
  decideAssetRequestAsManager,
} from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { PageLoading } from "../../shared/components/PageLoading";
import { useSelectedOffice, NoOfficesInScope } from "../../shared/SelectedOfficeContext";
import { sentenceCase } from "../../shared/text";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

const STATUS_TONE: Record<string, BadgeTone> = {
  pending_manager_approval: "neutral",
  rejected: "danger",
  returned: "warning",
  pending_allocation: "info",
  procurement_pending: "warning",
  closed: "success",
};

// F-16: "Employee submits ... reason" + "Employee's manager approves,
// rejects, or returns" -- both halves live here since most people are
// exactly one of "someone with requests" and occasionally "someone else's
// manager," never a separate persona. Visibility itself is enforced
// server-side (listMyAssetRequests/listPendingManagerApprovals), not by
// hiding UI.
export function AssetRequestsPage() {
  const { officeId, isLoading: officesLoading, hasOffices } = useSelectedOffice();
  const { data: myRequests, isLoading: myRequestsLoading, error: myRequestsError, refetch: refetchMine } = useQuery(
    listMyAssetRequests,
  );
  const { data: pendingApprovals, refetch: refetchApprovals } = useQuery(listPendingManagerApprovals);

  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setIsSubmitting(true);
    try {
      await action();
      await Promise.all([refetchMine(), refetchApprovals()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (officesLoading || myRequestsLoading) return <PageLoading />;

  if (!hasOffices) {
    return (
      <div className="p-6">
        <NoOfficesInScope />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Asset requests</h1>

      {officeId && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await createAssetRequest({ office_id: officeId, category, reason });
              setCategory("");
              setReason("");
            });
          }}
          className="card mb-8 flex flex-col gap-4 p-8"
        >
          <h2 className="text-lg font-semibold text-neutral-900">Request an asset</h2>
          <p className="text-sm text-neutral-500">Request applies to the office selected in the top bar.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <input
                className={inputClass}
                placeholder="e.g. laptop"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Reason</label>
            <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={isSubmitting || !category || !reason} className="self-start">
            Submit request
          </Button>
        </form>
      )}

      {pendingApprovals && pendingApprovals.length > 0 && (
        <div className="card mb-8 overflow-hidden">
          <div className="border-b border-neutral-100 p-4">
            <h2 className="text-lg font-semibold text-neutral-900">Awaiting your approval</h2>
          </div>
          <ul className="flex flex-col divide-y divide-neutral-100">
            {pendingApprovals.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-900">{r.category}</p>
                    <p className="text-sm text-neutral-500">
                      {r.requested_by_email} — "{r.reason}"
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    placeholder="Remark (required for reject/return)"
                    value={remarks[r.id] ?? ""}
                    onChange={(e) => setRemarks({ ...remarks, [r.id]: e.target.value })}
                  />
                  <Button
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => run(() => decideAssetRequestAsManager({ requestId: r.id, decision: "approve" }))}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={isSubmitting || !remarks[r.id]?.trim()}
                    onClick={() =>
                      run(() =>
                        decideAssetRequestAsManager({ requestId: r.id, decision: "reject", remark: remarks[r.id] }),
                      )
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isSubmitting || !remarks[r.id]?.trim()}
                    onClick={() =>
                      run(() =>
                        decideAssetRequestAsManager({ requestId: r.id, decision: "return", remark: remarks[r.id] }),
                      )
                    }
                  >
                    Return
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ErrorBanner error={myRequestsError} />

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">My requests</h2>
      {(myRequests?.length ?? 0) === 0 ? (
        <div className="card p-8 text-center text-neutral-500">You haven't submitted any asset requests yet.</div>
      ) : (
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">Category</th>
                <th className="table-head-cell">Reason</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {myRequests!.map((r) => (
                <tr key={r.id} className="table-row-hover">
                  <td className="table-cell font-medium text-neutral-900">{r.category}</td>
                  <td className="table-cell text-neutral-600">{r.reason}</td>
                  <td className="table-cell">
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{sentenceCase(r.status)}</Badge>
                  </td>
                  <td className="table-cell text-neutral-600">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
      )}
    </div>
  );
}
