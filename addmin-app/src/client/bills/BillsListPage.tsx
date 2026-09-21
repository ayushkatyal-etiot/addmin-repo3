import { useSearchParams, useNavigate } from "react-router";
import { useQuery, listOffices, listUtilityBills } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { Button } from "../../shared/components/Button";
import { ErrorBanner } from "../../shared/components/ErrorBanner";

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  pending_approval: "bg-amber-100 text-amber-800",
  approved: "bg-primary-100 text-primary-800",
  rejected: "bg-red-100 text-red-700",
  partially_paid: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
};

// F-09 (planmysaas-blueprint/05-features.md): bill entry list, same
// office-switcher-on-page pattern as UtilitiesListPage (Step 06).
export function BillsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: offices, isLoading: officesLoading, error: officesError } = useQuery(listOffices);

  const officeId = searchParams.get("officeId") ?? offices?.[0]?.id ?? "";
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

  if (!offices || offices.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl p-12">
        <div className="card p-8 text-center text-neutral-500">
          No offices in your scope. Ask an admin to assign you to an office when inviting you.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Utility bills</h1>
        <Button onClick={() => navigate(`/app/bills/new?officeId=${officeId}`)}>Enter bill</Button>
      </div>

      <div className="mb-4">
        <select
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          value={officeId}
          onChange={(e) => setSearchParams({ officeId: e.target.value })}
        >
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <ErrorBanner error={billsError} />

      {billsLoading && <p className="text-neutral-500">Loading…</p>}

      {!billsLoading && bills?.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">No bills for this office yet.</div>
      )}

      {!billsLoading && bills && bills.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Due date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr
                  key={b.id}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                  onClick={() => navigate(`/app/bills/${b.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-neutral-900">{b.provider_name}</td>
                  <td className="px-4 py-3 text-neutral-600">{b.billing_period}</td>
                  <td className="px-4 py-3 text-neutral-600">{b.amount}</td>
                  <td className="px-4 py-3 text-neutral-600">{new Date(b.due_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[b.status]}`}>
                      {b.status.replace("_", " ")}
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
