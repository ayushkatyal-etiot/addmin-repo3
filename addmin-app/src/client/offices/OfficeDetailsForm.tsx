import { useEffect, useState } from "react";
import { useQuery, getOffice, updateOffice } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { sentenceCase } from "../../shared/text";

const OFFICE_TYPES = ["head_office", "regional", "branch", "warehouse", "other"];
const OWNERSHIP_TYPES = ["owned", "rented"];

const inputClass =
  "w-full min-h-9.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 focus:border-primary-500 focus:outline-hidden focus:ring-4 focus:ring-primary-100";

export function OfficeDetailsForm({ officeId }: { officeId: string }) {
  const { data: office, isLoading, refetch } = useQuery(getOffice, { officeId });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [officeType, setOfficeType] = useState(OFFICE_TYPES[0]);
  const [ownershipType, setOwnershipType] = useState(OWNERSHIP_TYPES[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!office) return;
    setName(office.name);
    setAddress(office.address);
    setOfficeType(office.office_type);
    setOwnershipType(office.ownership_type);
  }, [office]);

  if (isLoading || !office) {
    return <div className="auth-panel mb-6 h-32 animate-pulse" />;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateOffice({
        officeId,
        name,
        address,
        office_type: officeType,
        ownership_type: ownershipType,
      });
      await refetch();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save office details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-panel mb-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Office details</h2>
          <p className="text-sm text-neutral-500">Code {office.code} · {sentenceCase(office.setup_status)}</p>
        </div>
        {!editing && (
          <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
            Edit details
          </Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={onSave} className="flex flex-col gap-4">
          <div>
            <label className="label block">Office name</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label block">Address</label>
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block">Office type</label>
              <select className="select-field" value={officeType} onChange={(e) => setOfficeType(e.target.value)}>
                {OFFICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {sentenceCase(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label block">Ownership</label>
              <select className="select-field" value={ownershipType} onChange={(e) => setOwnershipType(e.target.value)}>
                {OWNERSHIP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {sentenceCase(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setName(office.name);
                setAddress(office.address);
                setOfficeType(office.office_type);
                setOwnershipType(office.ownership_type);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Name</dt>
            <dd className="font-medium text-neutral-900">{office.name}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Type</dt>
            <dd className="font-medium text-neutral-900">{sentenceCase(office.office_type)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-neutral-500">Address</dt>
            <dd className="font-medium text-neutral-900">{office.address}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Ownership</dt>
            <dd className="font-medium text-neutral-900">{sentenceCase(office.ownership_type)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
