import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import {
  useQuery,
  getLease,
  listRentPayments,
  recordRentPayment,
  terminateLease,
  waiveMissingItem,
} from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { ErrorBanner } from "../../shared/components/ErrorBanner";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

const INSTANCE_STATUS_CLASS: Record<string, string> = {
  expected: "bg-neutral-100 text-neutral-700",
  received: "bg-primary-100 text-primary-800",
  missing: "bg-red-100 text-red-700",
  in_process: "bg-amber-100 text-amber-800",
  closed: "bg-neutral-100 text-neutral-500",
  cancelled: "bg-neutral-100 text-neutral-400",
  waived: "bg-neutral-100 text-neutral-500",
};

// F-12/F-13: lease terms, rent/CAM payment recording with server-computed
// TDS, and payment history -- one page, same shape as BillDetailPage.tsx.
export function LeaseDetailPage() {
  const { data: user } = useAuth();
  const isPaymentAuthorizer = user?.role === "payment_authorizer";
  const canManageLease = user?.role === "platform_admin" || user?.role === "office_admin";
  const { leaseId } = useParams<{ leaseId: string }>();
  const navigate = useNavigate();
  const { data: lease, isLoading, error: loadError, refetch } = useQuery(getLease, leaseId ? { id: leaseId } : undefined, {
    enabled: !!leaseId,
  });
  const { data: payments, refetch: refetchPayments } = useQuery(
    listRentPayments,
    leaseId ? { leaseId } : undefined,
    { enabled: !!leaseId },
  );

  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("bank_transfer");
  const [error, setError] = useState<string | null>(null);
  const [lastNetAmount, setLastNetAmount] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [waiveRemark, setWaiveRemark] = useState("");
  const [waiveError, setWaiveError] = useState<string | null>(null);

  if (isLoading) return null;
  if (!lease) {
    return (
      <div className="mx-auto w-full max-w-3xl p-12">
        <ErrorBanner error={loadError} />
        {!loadError && "Not found."}
      </div>
    );
  }

  async function recordFor(type: "rent" | "cam") {
    if (!leaseId) return;
    setError(null);
    setLastNetAmount(null);
    setIsSubmitting(true);
    try {
      const result = await recordRentPayment({ leaseId, type, due_date: dueDate, mode });
      setLastNetAmount(result.net_amount);
      await Promise.all([refetch(), refetchPayments()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record payment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onWaive(instanceId: string) {
    if (!waiveRemark.trim()) {
      setWaiveError("A remark is required to waive this item.");
      return;
    }
    setWaiveError(null);
    try {
      await waiveMissingItem({ instanceId, remark: waiveRemark });
      setWaivingId(null);
      setWaiveRemark("");
      await refetch();
    } catch (err) {
      setWaiveError(err instanceof Error ? err.message : "Could not waive item.");
    }
  }

  async function onTerminate() {
    if (!leaseId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await terminateLease({ id: leaseId });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not terminate lease.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-12">
      <button className="mb-4 text-sm text-neutral-500 hover:underline" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="card mb-6 p-8">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">{lease.landlord_name}</h1>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">
            {lease.status}
          </span>
        </div>
        <p className="text-sm text-neutral-500">
          {new Date(lease.start_date).toLocaleDateString()} – {new Date(lease.end_date).toLocaleDateString()}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">Rent due anchor</dt>
            <dd className="font-medium text-neutral-900">{new Date(lease.rent_due_anchor_date).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Rent (current)</dt>
            <dd className="font-medium text-neutral-900">{lease.rent_amount}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">CAM</dt>
            <dd className="font-medium text-neutral-900">{lease.cam_amount ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Security deposit</dt>
            <dd className="font-medium text-neutral-900">
              {lease.security_deposit ?? "—"} {lease.security_deposit && (lease.security_deposit_refunded ? "(refunded)" : "(held)")}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">TDS on this landlord</dt>
            <dd className="font-medium text-neutral-900">{lease.landlord_tds_applicable ? "Applicable" : "Not applicable"}</dd>
          </div>
          {lease.escalation_pct && (
            <div>
              <dt className="text-neutral-500">Escalation</dt>
              <dd className="font-medium text-neutral-900">
                {lease.escalation_pct}% effective {new Date(lease.escalation_effective_date!).toLocaleDateString()}
              </dd>
            </div>
          )}
        </dl>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {lastNetAmount && <p className="mt-4 text-sm text-green-600">Payment recorded. Net amount paid: {lastNetAmount}.</p>}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-neutral-700">Obligation history</h2>
      {waiveError && <p className="mb-3 text-sm text-red-600">{waiveError}</p>}

      {lease.obligation_instances.length === 0 && (
        <div className="card mb-6 p-8 text-center text-neutral-500">
          No obligation instances yet — run{" "}
          <code className="text-xs">wasp db seed runObligationJobs</code> or wait for the nightly job once this lease
          enters its rent/CAM notice window.
        </div>
      )}

      {lease.obligation_instances.length > 0 && (
        <div className="card mb-6 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Expected date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {lease.obligation_instances.map((i) => (
                <tr key={i.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3 uppercase text-neutral-600">{i.scope_type}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{i.period}</td>
                  <td className="px-4 py-3 text-neutral-600">{new Date(i.expected_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${INSTANCE_STATUS_CLASS[i.status]}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManageLease && i.status === "missing" && waivingId !== i.id && (
                      <button
                        type="button"
                        className="font-semibold text-primary-600 underline"
                        onClick={() => setWaivingId(i.id)}
                      >
                        Waive
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManageLease && waivingId && (
        <div className="card mb-6 p-4">
          <label className="label">Remark (required)</label>
          <textarea
            className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={waiveRemark}
            onChange={(e) => setWaiveRemark(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={() => onWaive(waivingId)}>Confirm waive</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setWaivingId(null);
                setWaiveRemark("");
                setWaiveError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {lease.status !== "terminated" && isPaymentAuthorizer && (
        <div className="card mb-6 p-8">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Record payment</h2>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Installment due date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={dueDate}
                  min={lease.start_date.slice(0, 10)}
                  max={lease.end_date.slice(0, 10)}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Mode</label>
                <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              The billing period is derived from this due date and the rent due anchor (like utility bill due dates).
            </p>
            <div className="flex gap-3">
              <Button disabled={isSubmitting || !dueDate} onClick={() => recordFor("rent")}>
                Record rent payment
              </Button>
              {lease.cam_amount && (
                <Button variant="ghost" disabled={isSubmitting || !dueDate} onClick={() => recordFor("cam")}>
                  Record CAM payment
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {(payments?.length ?? 0) > 0 && (
        <div className="card mb-6 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Due date</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">TDS</th>
                <th className="px-4 py-3">Net</th>
                <th className="px-4 py-3">Mode</th>
              </tr>
            </thead>
            <tbody>
              {payments!.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3 text-neutral-600">{p.payable_type}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {p.due_date ? new Date(p.due_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{p.period}</td>
                  <td className="px-4 py-3 text-neutral-600">{p.amount}</td>
                  <td className="px-4 py-3 text-neutral-600">{p.tds_amount ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{p.net_amount}</td>
                  <td className="px-4 py-3 text-neutral-600">{p.mode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lease.status !== "terminated" && canManageLease && (
        <div className="card p-8">
          <h2 className="mb-2 text-lg font-semibold text-neutral-900">Terminate lease</h2>
          <p className="mb-4 text-sm text-neutral-500">
            Cancels all remaining future rent/CAM obligation instances. This cannot be undone.
          </p>
          <Button variant="danger" disabled={isSubmitting} onClick={onTerminate}>
            Terminate lease
          </Button>
        </div>
      )}
    </div>
  );
}
