import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, listUtilityAccounts, getUtilityAccount, createUtilityBill } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { DatePicker } from "../../shared/components/DatePicker";
import { useSelectedOffice, NoOfficesInScope } from "../../shared/SelectedOfficeContext";
import { PageLoading } from "../../shared/components/PageLoading";

const OPEN_INSTANCE_STATUSES = ["expected", "missing"];

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

export function NewBillPage() {
  const navigate = useNavigate();
  const { officeId, isLoading: officesLoading, hasOffices } = useSelectedOffice();

  const { data: accounts, isLoading: accountsLoading } = useQuery(
    listUtilityAccounts,
    officeId ? { officeId } : undefined,
    { enabled: !!officeId },
  );

  const [accountId, setAccountId] = useState("");
  const effectiveAccountId = accountId || accounts?.[0]?.id || "";

  const { data: account } = useQuery(
    getUtilityAccount,
    effectiveAccountId ? { accountId: effectiveAccountId } : undefined,
    { enabled: !!effectiveAccountId },
  );
  const openPeriods = (account?.instances ?? []).filter((i) => OPEN_INSTANCE_STATUSES.includes(i.status));

  const [billingPeriod, setBillingPeriod] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (openPeriods.length > 0 && !openPeriods.some((p) => p.period === billingPeriod)) {
      setBillingPeriod(openPeriods[0].period);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAccountId, openPeriods.map((p) => p.period).join(",")]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { id } = await createUtilityBill({
        utility_account_id: effectiveAccountId,
        billing_period: billingPeriod,
        amount: Number(amount),
        due_date: dueDate,
      });
      navigate(`/app/bills/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create bill.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (officesLoading) return <PageLoading />;

  if (!hasOffices) {
    return (
      <div className="mx-auto w-full max-w-2xl p-12">
        <NoOfficesInScope />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-12">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Enter utility bill</h1>
      <p className="mb-4 text-sm text-neutral-500">Connections are loaded for the office selected in the top bar.</p>

      <form onSubmit={onSubmit} className="card flex flex-col gap-6 p-8">
        <div>
          <label className="label">Utility connection</label>
          {!accountsLoading && (accounts?.length ?? 0) === 0 ? (
            <p className="text-sm text-neutral-500">No utility connections for this office yet.</p>
          ) : (
            <select className="select-field" value={effectiveAccountId} onChange={(e) => setAccountId(e.target.value)}>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.provider_name} ({a.meter_account_no})
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="label">Billing period</label>
          {openPeriods.length > 0 ? (
            <select className="select-field" value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)}>
              {openPeriods.map((p) => (
                <option key={p.id} value={p.period}>
                  {p.period} (due {new Date(p.expected_date).toLocaleDateString()}) — {p.status}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={inputClass}
              placeholder="e.g. 2026-09"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              required
            />
          )}
          {openPeriods.length === 0 && account && (
            <p className="mt-1 text-xs text-neutral-500">
              No obligation period is open yet for this connection — enter the period manually (e.g. 2026-09). It
              won't auto-link to obligation history unless it matches the period the system later generates.
            </p>
          )}
        </div>
        <div>
          <label className="label">Amount</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Due date</label>
          <DatePicker className={inputClass} value={dueDate} onChange={setDueDate} required />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={isSubmitting || !effectiveAccountId}>
          Save as draft
        </Button>
      </form>
    </div>
  );
}
