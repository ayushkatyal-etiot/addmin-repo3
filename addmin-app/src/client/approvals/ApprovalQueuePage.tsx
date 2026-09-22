import { useNavigate } from "react-router";
import { useQuery, listApprovalQueue } from "wasp/client/operations";
import { ErrorBanner } from "../../shared/components/ErrorBanner";

// F-10: a Checker's pending approvals, routed to them by resolveApprovalRoute
// at submission time (src/server/workflow/approval.ts).
export function ApprovalQueuePage() {
  const { data: queue, isLoading, error } = useQuery(listApprovalQueue);
  const navigate = useNavigate();

  if (isLoading) return null;

  return (
    <div className="mx-auto w-full max-w-4xl p-12">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Approval queue</h1>
      <ErrorBanner error={error} />

      {queue?.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">Nothing awaiting your approval.</div>
      )}

      {queue && queue.length > 0 && (
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">Provider</th>
                <th className="table-head-cell">Period</th>
                <th className="table-head-cell">Amount</th>
                <th className="table-head-cell">Due date</th>
                <th className="table-head-cell" />
              </tr>
            </thead>
            <tbody>
              {queue.map((q) => (
                <tr
                  key={q.stepId}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                  onClick={() => navigate(`/app/bills/${q.billId}`)}
                >
                  <td className="table-cell font-medium text-neutral-900">{q.provider_name}</td>
                  <td className="table-cell text-neutral-600">{q.billing_period}</td>
                  <td className="table-cell text-neutral-600">{q.amount}</td>
                  <td className="table-cell text-neutral-600">{new Date(q.due_date).toLocaleDateString()}</td>
                  <td className="table-cell text-right text-primary-600 underline">Review</td>
                </tr>
              ))}
            </tbody>
          </table>
      )}
    </div>
  );
}
