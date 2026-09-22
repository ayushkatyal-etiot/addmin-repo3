import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, listLandlords, createLandlord, createLease } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { DatePicker } from "../../shared/components/DatePicker";
import { useSelectedOffice, NoOfficesInScope } from "../../shared/SelectedOfficeContext";
import { PageLoading } from "../../shared/components/PageLoading";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

// F-12: landlord registration + lease terms in one flow (05-features.md's
// user flow step 2-3 does this as one continuous admin action, not two
// separate pages) -- "select existing" vs "register new" toggle covers both.
export function LeaseWizard() {
  const navigate = useNavigate();
  const { officeId, isLoading: officesLoading, hasOffices } = useSelectedOffice();
  const { data: landlords, isLoading: landlordsLoading, refetch: refetchLandlords } = useQuery(listLandlords);
  const [landlordMode, setLandlordMode] = useState<"existing" | "new">("existing");
  const [landlordId, setLandlordId] = useState("");
  const [landlordName, setLandlordName] = useState("");
  const [landlordPan, setLandlordPan] = useState("");
  const [tdsApplicable, setTdsApplicable] = useState(false);
  const [tdsRatePct, setTdsRatePct] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rentDueAnchorDate, setRentDueAnchorDate] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [camAmount, setCamAmount] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [escalationPct, setEscalationPct] = useState("");
  const [escalationDate, setEscalationDate] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveLandlordId = landlordMode === "existing" ? landlordId || landlords?.[0]?.id || "" : "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      let resolvedLandlordId = effectiveLandlordId;
      if (landlordMode === "new") {
        const result = await createLandlord({
          name: landlordName,
          pan: landlordPan || undefined,
          tds_applicable: tdsApplicable,
          tds_rate_pct: tdsRatePct ? Number(tdsRatePct) : undefined,
        });
        resolvedLandlordId = result.id;
        await refetchLandlords();
      }

      await createLease({
        office_id: officeId,
        landlord_id: resolvedLandlordId,
        start_date: startDate,
        end_date: endDate,
        rent_due_anchor_date: rentDueAnchorDate || startDate,
        rent_amount: Number(rentAmount),
        cam_amount: camAmount ? Number(camAmount) : undefined,
        security_deposit: securityDeposit ? Number(securityDeposit) : undefined,
        escalation_pct: escalationPct ? Number(escalationPct) : undefined,
        escalation_effective_date: escalationDate || undefined,
      });
      navigate("/app/property/leases");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create lease.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (officesLoading || landlordsLoading) return <PageLoading />;

  if (!hasOffices) {
    return (
      <div className="mx-auto w-full max-w-2xl p-12">
        <NoOfficesInScope />
      </div>
    );
  }

  const canSubmit =
    officeId &&
    startDate &&
    endDate &&
    rentAmount &&
    (landlordMode === "existing" ? effectiveLandlordId : landlordName.trim());

  return (
    <div className="mx-auto w-full max-w-2xl p-12">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Add lease</h1>
      <p className="mb-4 text-sm text-neutral-500">Lease will be created for the office selected in the top bar.</p>

      <form onSubmit={onSubmit} className="card flex flex-col gap-6 p-8">
        <div>
          <label className="label">Landlord</label>
          <div className="mb-2 flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={landlordMode === "existing"}
                onChange={() => setLandlordMode("existing")}
                disabled={!landlords || landlords.length === 0}
              />
              Select existing
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={landlordMode === "new"} onChange={() => setLandlordMode("new")} />
              Register new
            </label>
          </div>

          {landlordMode === "existing" ? (
            <select className="select-field" value={effectiveLandlordId} onChange={(e) => setLandlordId(e.target.value)}>
              {(landlords ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4">
              <div>
                <label className="label">Name</label>
                <input className={inputClass} value={landlordName} onChange={(e) => setLandlordName(e.target.value)} required />
              </div>
              <div>
                <label className="label">PAN (optional)</label>
                <input className={inputClass} value={landlordPan} onChange={(e) => setLandlordPan(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={tdsApplicable} onChange={(e) => setTdsApplicable(e.target.checked)} />
                TDS applicable on rent to this landlord
              </label>
              {tdsApplicable && (
                <div>
                  <label className="label">TDS rate % (optional — falls back to org default)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    value={tdsRatePct}
                    onChange={(e) => setTdsRatePct(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Lease start date</label>
            <DatePicker
              className={inputClass}
              value={startDate}
              onChange={(next) => {
                setStartDate(next);
                if (!rentDueAnchorDate || rentDueAnchorDate === startDate) {
                  setRentDueAnchorDate(next);
                }
              }}
              required
            />
          </div>
          <div>
            <label className="label">Lease end date</label>
            <DatePicker className={inputClass} value={endDate} onChange={setEndDate} required />
          </div>
        </div>

        <div>
          <label className="label">Rent due date</label>
          <p className="mb-2 text-xs text-neutral-500">
            Monthly rent/CAM obligation periods are calculated from this day (defaults to lease start).
          </p>
          <DatePicker
            className={inputClass}
            value={rentDueAnchorDate || startDate}
            min={startDate || undefined}
            max={endDate || undefined}
            onChange={setRentDueAnchorDate}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Monthly rent</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={inputClass}
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Monthly CAM (optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={camAmount}
              onChange={(e) => setCamAmount(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Security deposit (optional)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            value={securityDeposit}
            onChange={(e) => setSecurityDeposit(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Escalation % (optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={escalationPct}
              onChange={(e) => setEscalationPct(e.target.value)}
            />
          </div>
          {escalationPct && (
            <div>
              <label className="label">Escalation effective date</label>
              <DatePicker className={inputClass} value={escalationDate} onChange={setEscalationDate} required />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={isSubmitting || !canSubmit}>
          Create lease
        </Button>
      </form>
    </div>
  );
}
