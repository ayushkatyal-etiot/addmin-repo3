import { useNavigate } from "react-router";
import { useQuery, listUtilityBills } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { useAuth } from "wasp/client/auth";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { useSelectedOffice, NoOfficesInScope } from "../../shared/SelectedOfficeContext";
import { sentenceCase } from "../../shared/text";

const PAYABLE_STATUSES = ["approved", "partially_paid", "overdue"];

const STATUS_TONE: Record<string, BadgeTone> = {
  approved: "success",
  partially_paid: "info",
  overdue: "danger",
  paid: "success",
};

// F-11: bills awaiting payment, for the Payment Authorizer -- actual payment
// recording happens on BillDetailPage, this is just the worklist.
export function PaymentsPage() {
  const { data: user } = useAuth();
  const navigate = useNavigate();
  const { officeId, isLoading: officesLoading, error: officesError, hasOffices } = useSelectedOffice();
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

  if (!hasOffices) {
    return (
      <div className="mx-auto w-full max-w-4xl p-12">
        <NoOfficesInScope />
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
                {payableBills.map((b) => (
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
                    <td className="table-cell text-right text-primary-600 underline">Pay</td>
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
                {paidBills.map((b) => (
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
                      <Badge tone="success">Paid</Badge>
                    </td>
                    <td className="table-cell text-right text-primary-600 underline">View</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </>
      )}
    </div>
  );
}
