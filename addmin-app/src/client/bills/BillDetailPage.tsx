import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import {
  useQuery,
  getUtilityBill,
  updateUtilityBill,
  submitUtilityBill,
  approveUtilityBill,
  recordPayment,
} from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { DatePicker } from "../../shared/components/DatePicker";
import { ErrorBanner } from "../../shared/components/ErrorBanner";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

// F-09/F-10/F-11: the full bill lifecycle lives on one page -- amend (draft),
// submit (draft), approve/reject/return (checker, pending_approval), record
// payment (payment authorizer, approved/partially_paid/overdue).
export function BillDetailPage() {
  const { billId } = useParams<{ billId: string }>();
  const navigate = useNavigate();
  const { data: user } = useAuth();
  const { data: bill, isLoading, error: loadError, refetch } = useQuery(getUtilityBill, billId ? { billId } : undefined, {
    enabled: !!billId,
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [remark, setRemark] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("bank_transfer");

  if (isLoading) return null;
  if (!bill) {
    return (
      <div className="p-6">
        <ErrorBanner error={loadError} />
        {!loadError && "Not found."}
      </div>
    );
  }

  const remaining = Number(bill.amount) - Number(bill.paid_amount);
  const isPaymentAuthorizer = user?.role === "payment_authorizer";
  const isMaker = user?.id === bill.created_by;
  const pendingStep = bill.approvalSteps.find((s) => s.status === "pending");
  const isMyApproval = pendingStep?.approver_user_id === user?.id;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setIsSubmitting(true);
    try {
      await action();
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-6">
      <button className="mb-4 text-sm text-neutral-500 hover:underline" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="card mb-6 p-8">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">{bill.provider_name}</h1>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">
            {bill.status.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm text-neutral-500">Billing period {bill.billing_period}</p>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">Amount</dt>
            <dd className="font-medium text-neutral-900">{bill.amount}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Due date</dt>
            <dd className="font-medium text-neutral-900">{new Date(bill.due_date).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Paid so far</dt>
            <dd className="font-medium text-neutral-900">{bill.paid_amount}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Remaining</dt>
            <dd className="font-medium text-neutral-900">{remaining}</dd>
          </div>
        </dl>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      {bill.status === "draft" && (
        <div className="card mb-6 p-8">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Amend & submit</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">New amount (optional)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className={inputClass}
                placeholder={bill.amount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="label">New due date (optional)</label>
              <DatePicker className={inputClass} value={dueDate} onChange={setDueDate} />
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                disabled={isSubmitting || (!amount && !dueDate)}
                onClick={() =>
                  run(() =>
                    updateUtilityBill({
                      billId: bill.id,
                      amount: amount ? Number(amount) : Number(bill.amount),
                      due_date: dueDate || bill.due_date.slice(0, 10),
                    }),
                  )
                }
              >
                Save amendment
              </Button>
              <Button disabled={isSubmitting} onClick={() => run(() => submitUtilityBill({ billId: bill.id }))}>
                Submit for approval
              </Button>
            </div>
          </div>
        </div>
      )}

      {bill.status === "pending_approval" && pendingStep && (
        <div className="card mb-6 p-8">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Approval</h2>
          {isMaker && (
            <p className="text-sm text-neutral-500">You created this bill and cannot approve it yourself.</p>
          )}
          {!isMaker && !isMyApproval && (
            <p className="text-sm text-neutral-500">Routed to another approver.</p>
          )}
          {!isMaker && isMyApproval && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Remark (required for reject/return)</label>
                <input className={inputClass} value={remark} onChange={(e) => setRemark(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button
                  disabled={isSubmitting}
                  onClick={() => run(() => approveUtilityBill({ billId: bill.id, decision: "approve" }))}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  disabled={isSubmitting}
                  onClick={() => run(() => approveUtilityBill({ billId: bill.id, decision: "reject", remark }))}
                >
                  Reject
                </Button>
                <Button
                  variant="ghost"
                  disabled={isSubmitting}
                  onClick={() => run(() => approveUtilityBill({ billId: bill.id, decision: "return", remark }))}
                >
                  Return
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {isPaymentAuthorizer &&
        ["approved", "partially_paid", "overdue"].includes(bill.status) &&
        remaining > 0 && (
        <div className="card mb-6 p-8">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Record payment</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Amount (remaining: {remaining})</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className={inputClass}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Mode</label>
              <select className="select-field" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
              </select>
            </div>
            <Button
              disabled={isSubmitting || !paymentAmount}
              onClick={() =>
                run(async () => {
                  await recordPayment({ billId: bill.id, amount: Number(paymentAmount), mode: paymentMode });
                  setPaymentAmount("");
                })
              }
            >
              Record payment
            </Button>
          </div>
        </div>
      )}

      <div className="card p-8">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Audit trail</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {bill.approvalSteps.map((s) => (
            <li key={s.id} className="text-neutral-600">
              Tier {s.tier}: {s.status}
              {s.remark ? ` — "${s.remark}"` : ""}
              {s.acted_at ? ` (${new Date(s.acted_at).toLocaleString()})` : ""}
            </li>
          ))}
          {bill.payments.map((p) => (
            <li key={p.id} className="text-neutral-600">
              Payment of {p.amount} ({p.status})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
