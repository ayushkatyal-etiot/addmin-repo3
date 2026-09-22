import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, listOffices, createOffice, updateOrganizationProfile } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { AuthScreen } from "../../shared/components/auth/AuthScreen";
import { WizardHeader } from "../../shared/components/auth/WizardHeader";
import { useSelectedOffice } from "../../shared/SelectedOfficeContext";
import { sentenceCase } from "../../shared/text";

const OFFICE_TYPES = ["head_office", "regional", "branch", "warehouse", "other"];
const OWNERSHIP_TYPES = ["owned", "rented"];
// Top 5 for now, per office scope -- extend if orgs outside these markets sign up.
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];
const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"];

// Matches the design system's Input/Select components (components/forms/
// Input.jsx, Select.jsx): 38px tall, border-only focus state -- Input gets a
// soft brand-tinted ring on top, Select doesn't.
const inputClass =
  "w-full min-h-9.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 focus:border-primary-500 focus:outline-hidden focus:ring-4 focus:ring-primary-100";

// F-03 (planmysaas-blueprint/05-features.md): Organization & Office
// Hierarchy Setup. When this is the org's very first office, the org
// profile fields are folded into this same form (step 1+2 of F-03's user
// flow) rather than a separate screen -- there's nothing else to show on a
// standalone "org profile" page before any office exists.
export function NewOfficePage() {
  const navigate = useNavigate();
  const { setOfficeId } = useSelectedOffice();
  const { data: offices, isLoading: officesLoading } = useQuery(listOffices);
  const isFirstOffice = !officesLoading && (offices?.length ?? 0) === 0;

  const [orgName, setOrgName] = useState("");
  const [gstin, setGstin] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [officeType, setOfficeType] = useState(OFFICE_TYPES[0]);
  const [ownershipType, setOwnershipType] = useState(OWNERSHIP_TYPES[0]);
  const [code, setCode] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (isFirstOffice && orgName.trim()) {
        await updateOrganizationProfile({
          name: orgName,
          gstin: gstin || undefined,
          default_currency: currency,
          timezone,
        });
      }
      const result = await createOffice({
        name,
        address,
        office_type: officeType,
        ownership_type: ownershipType,
        code: code || undefined,
      });
      setOfficeId(result.officeId);
      navigate("/app/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create office.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen center={false}>
      <div className="mx-auto w-full max-w-180">
        <WizardHeader
          icon={<BuildingIcon />}
          title="Add office"
          subtitle="Set up your organization and its first office."
        />

        <form onSubmit={onSubmit} className="auth-panel flex flex-col gap-6">
          {isFirstOffice && (
            <fieldset className="flex flex-col gap-3 border-b border-neutral-200 pb-6">
              <legend className="mb-2 text-sm font-semibold text-neutral-900">
                Organization details (first time only)
              </legend>
              <div>
                <label className="label">Organization name</label>
                <input className={inputClass} value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <div>
                <label className="label">GSTIN (optional)</label>
                <input className={inputClass} value={gstin} onChange={(e) => setGstin(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Currency</label>
                  <select className="select-field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Timezone</label>
                  <select className="select-field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>
          )}

          <div>
            <label className="label">Office name</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Address</label>
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Office type</label>
              <select className="select-field" value={officeType} onChange={(e) => setOfficeType(e.target.value)}>
                {OFFICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {sentenceCase(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Ownership</label>
              <select className="select-field" value={ownershipType} onChange={(e) => setOwnershipType(e.target.value)}>
                {OWNERSHIP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {sentenceCase(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Office code (optional -- auto-generated if left blank)</label>
            <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            Create office
          </Button>
        </form>
      </div>
    </AuthScreen>
  );
}

function BuildingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  );
}
