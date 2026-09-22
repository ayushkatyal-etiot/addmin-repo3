import { useNavigate } from "react-router";
import { useQuery, listUtilityBills } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { useSelectedOffice, NoOfficesInScope } from "../../shared/SelectedOfficeContext";
import { sentenceCase } from "../../shared/text";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  pending_approval: "warning",
  approved: "success",
  rejected: "danger",
  partially_paid: "info",
  paid: "success",
  overdue: "danger",
};

export function BillsListPage() {
  const navigate = useNavigate();
  const { officeId, isLoading: officesLoading, error: officesError, hasOffices } = useSelectedOffice();
  const { data: bills, isLoading: billsLoading, error: billsError } = useQuery(
    listUtilityBills,
    officeId ? { officeId } : undefined,
    { enabled: !!officeId },
  );

  if (officesLoading) return null;

  if (officesError) {
    return (
      <div className="mx-auto w-full max-w-4xl p-12">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Utility bills</h1>
        <ErrorBanner error={officesError} />
      </div>
    );
  }

  if (!hasOffices) {
    return (
      <div className="mx-auto w-full max-w-4xl p-12">
        <NoOfficesInScope />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Utility bills</h1>
        <Button onClick={() => navigate("/app/bills/new")}>Enter bill</Button>
      </div>

      <ErrorBanner error={billsError} />

      {billsLoading && <p className="text-neutral-500">Loading…</p>}

      {!billsLoading && bills?.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">No bills for this office yet.</div>
      )}

      {!billsLoading && bills && bills.length > 0 && (
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">Provider</th>
                <th className="table-head-cell">Period</th>
                <th className="table-head-cell">Amount</th>
                <th className="table-head-cell">Due date</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell" />
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr
                  key={b.id}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                  onClick={() => navigate(`/app/bills/${b.id}`)}
                >
                  <td className="table-cell font-medium text-neutral-900">{b.provider_name}</td>
                  <td className="table-cell text-neutral-600">{b.billing_period}</td>
                  <td className="table-cell text-neutral-600">{b.amount}</td>
                  <td className="table-cell text-neutral-600">{new Date(b.due_date).toLocaleDateString()}</td>
                  <td className="table-cell">
                    <Badge tone={STATUS_TONE[b.status] ?? "neutral"}>{sentenceCase(b.status)}</Badge>
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
