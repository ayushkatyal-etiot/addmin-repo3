import { useSearchParams, useNavigate } from "react-router";
import { useQuery, listOffices, listUtilityBills } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { useAuth } from "wasp/client/auth";
import { ErrorBanner } from "../../shared/components/ErrorBanner";

const PAYABLE_STATUSES = ["approved", "partially_paid", "overdue"];

const STATUS_CLASS: Record<string, string> = {
  approved: "bg-primary-100 text-primary-800",
  partially_paid: "bg-blue-100 text-blue-800",
  overdue: "bg-red-100 text-red-800",
  paid: "bg-green-100 text-green-800",
};

// F-11: bills awaiting payment, for the Payment Authorizer -- actual payment
// recording happens on BillDetailPage, this is just the worklist.
export function PaymentsPage() {
  const { data: user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: offices, isLoading: officesLoading, error: officesError } = useQuery(listOffices);

  const officeId = searchParams.get("officeId") ?? offices?.[0]?.id ?? "";
  const { data: bills, isLoading: billsLoading, error: billsError } = useQuery(
    listUtilityBills,
    officeId ? { officeId } : undefined,
    { enabled: !!officeId },
  );

  const payableBills = (bills ?? []).filter((b) => PAYABLE_STATUSES.includes(b.status));
  const paidBills = (bills ?? []).filter((b) => b.status === "paid");

  if (officesLoading) return null;

  if (officesError) {
    return (
      <div className="mx-auto w-full max-w-4xl p-12">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Payments</h1>
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
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Payments</h1>
      {user?.role === "payment_authorizer" && (
        <p className="mb-4 text-sm text-neutral-600">
          This queue is for <strong>utility bills</strong> (approved / overdue). For rent and CAM, go to{" "}
          <Link to="/app/property/leases" className="font-semibold text-primary-600 underline">
            Leases
          </Link>{" "}
          and record payment on a lease.
        </p>
      )}

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

      {!billsLoading && payableBills.length === 0 && paidBills.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">
          No bills yet for this office. An admin must enter and get a bill <strong>approved</strong> before it appears
          in the payment queue.
        </div>
      )}

      {!billsLoading && payableBills.length === 0 && paidBills.length > 0 && (
        <div className="card mb-6 p-6 text-sm text-neutral-600">
          Nothing awaiting payment — all recorded bills for this office are paid. See payment history below.
        </div>
      )}

      {!billsLoading && payableBills.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">Awaiting payment</h2>
          <div className="card mb-10 overflow-hidden">
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
                {payableBills.map((b) => (
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
                    <td className="px-4 py-3 text-right text-primary-600 underline">Pay</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!billsLoading && paidBills.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">Payment history</h2>
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
                {paidBills.map((b) => (
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
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS.paid}`}>
                        paid
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-primary-600 underline">View</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
