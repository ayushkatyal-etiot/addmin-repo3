import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery, listOffices, createUtilityAccount } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";

const UTILITY_TYPES = [
  "electricity",
  "water",
  "internet",
  "telephone",
  "gas",
  "dg",
  "ups",
  "solar",
  "other",
];
const BILLING_CYCLES = ["monthly", "bimonthly", "quarterly"];

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

// F-06: provider, account/meter number, and billing cycle are mandatory --
// creating this also creates the RecurringObligationSchedule server-side
// (src/server/utility/account.ts), not something this form has to know about.
export function NewUtilityAccountPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: offices, isLoading: officesLoading } = useQuery(listOffices);

  const [officeId, setOfficeId] = useState(searchParams.get("officeId") ?? "");
  const [utilityType, setUtilityType] = useState(UTILITY_TYPES[0]);
  const [providerName, setProviderName] = useState("");
  const [meterAccountNo, setMeterAccountNo] = useState("");
  const [billingCycle, setBillingCycle] = useState(BILLING_CYCLES[0]);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveOfficeId = officeId || offices?.[0]?.id || "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createUtilityAccount({
        office_id: effectiveOfficeId,
        utility_type: utilityType,
        provider_name: providerName,
        meter_account_no: meterAccountNo,
        billing_cycle: billingCycle as "monthly" | "bimonthly" | "quarterly",
        start_date: startDate,
      });
      navigate(`/app/utilities?officeId=${effectiveOfficeId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create utility connection.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (officesLoading) return null;

  return (
    <div className="mx-auto w-full max-w-2xl p-12">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Add utility connection</h1>

      <form onSubmit={onSubmit} className="card flex flex-col gap-6 p-8">
        <div>
          <label className="label">Office</label>
          <select
            className={inputClass}
            value={effectiveOfficeId}
            onChange={(e) => setOfficeId(e.target.value)}
          >
            {(offices ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Utility type</label>
          <select className={inputClass} value={utilityType} onChange={(e) => setUtilityType(e.target.value)}>
            {UTILITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Provider name</label>
          <input
            className={inputClass}
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Account / meter number</label>
          <input
            className={inputClass}
            value={meterAccountNo}
            onChange={(e) => setMeterAccountNo(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Billing cycle</label>
          <select className={inputClass} value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
            {BILLING_CYCLES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Start date</label>
          <input
            type="date"
            className={inputClass}
            value={startDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={isSubmitting || !effectiveOfficeId}>
          Add connection
        </Button>
      </form>
    </div>
  );
}
