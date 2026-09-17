import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, listOffices, createOffice, updateOrganizationProfile } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";

const OFFICE_TYPES = ["head_office", "regional", "branch", "warehouse", "other"];
const OWNERSHIP_TYPES = ["owned", "rented"];

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

// F-03 (planmysaas-blueprint/05-features.md): Organization & Office
// Hierarchy Setup. When this is the org's very first office, the org
// profile fields are folded into this same form (step 1+2 of F-03's user
// flow) rather than a separate screen -- there's nothing else to show on a
// standalone "org profile" page before any office exists.
export function NewOfficePage() {
  const navigate = useNavigate();
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
      navigate(`/app/onboarding?officeId=${result.officeId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create office.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-12">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Add office</h1>

      <form onSubmit={onSubmit} className="card flex flex-col gap-6 p-8">
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
                <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
              <div>
                <label className="label">Timezone</label>
                <input className={inputClass} value={timezone} onChange={(e) => setTimezone(e.target.value)} />
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
            <select className={inputClass} value={officeType} onChange={(e) => setOfficeType(e.target.value)}>
              {OFFICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ownership</label>
            <select className={inputClass} value={ownershipType} onChange={(e) => setOwnershipType(e.target.value)}>
              {OWNERSHIP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
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

        <Button type="submit" disabled={isSubmitting}>
          Create office & continue to setup
        </Button>
      </form>
    </div>
  );
}
