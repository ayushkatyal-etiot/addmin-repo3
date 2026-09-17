import { useState } from "react";
import { useQuery, listOffices, bulkImportOffices } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { ButtonLink, Button } from "../../shared/components/Button";

const SETUP_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  setup_incomplete: "Setup Incomplete",
  active: "Active",
  inactive: "Inactive",
};

const SETUP_STATUS_CLASS: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  setup_incomplete: "bg-amber-100 text-amber-800",
  active: "bg-primary-100 text-primary-800",
  inactive: "bg-red-100 text-red-700",
};

// F-03 (planmysaas-blueprint/05-features.md): office list with setup status,
// plus CSV bulk import (per-row error reporting, doesn't fail the whole batch).
export function OfficeListPage() {
  const { data: offices, isLoading, refetch } = useQuery(listOffices);
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<
    Array<{ row: number; success: boolean; error?: string }> | null
  >(null);
  const [showImport, setShowImport] = useState(false);

  async function onImport() {
    setImporting(true);
    setResults(null);
    try {
      const { results } = await bulkImportOffices({ csv });
      setResults(results);
      await refetch();
    } catch (err) {
      setResults([{ row: 0, success: false, error: err instanceof Error ? err.message : "Import failed." }]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Offices</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowImport((v) => !v)}>
            Bulk import (CSV)
          </Button>
          <ButtonLink to="/app/offices/new">Add office</ButtonLink>
        </div>
      </div>

      {showImport && (
        <div className="card mb-6 p-6">
          <p className="mb-2 text-sm text-neutral-600">
            Paste CSV with header row: <code>name,address,office_type,ownership_type,code</code> (code is
            optional). Each row is imported independently -- a bad row won't block the rest.
          </p>
          <textarea
            className="mb-3 h-32 w-full rounded-md border border-neutral-300 p-2 font-mono text-sm"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={"name,address,office_type,ownership_type,code\nMumbai HQ,1 Main St,head_office,owned,MUM-HQ"}
          />
          <Button onClick={onImport} disabled={importing || !csv.trim()}>
            {importing ? "Importing…" : "Import"}
          </Button>

          {results && (
            <ul className="mt-4 flex flex-col gap-1 text-sm">
              {results.map((r) => (
                <li key={r.row} className={r.success ? "text-primary-700" : "text-red-600"}>
                  Row {r.row}: {r.success ? "imported" : `error - ${r.error}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isLoading && <p className="text-neutral-500">Loading…</p>}

      {!isLoading && offices?.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">
          No offices yet. <Link to="/app/offices/new" className="font-semibold text-primary-600 underline">Add your first office</Link>.
        </div>
      )}

      {!isLoading && offices && offices.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Ownership</th>
                <th className="px-4 py-3">Setup</th>
                <th className="px-4 py-3">Completion</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {offices.map((office) => (
                <tr key={office.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3 font-mono text-xs">{office.code}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{office.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{office.office_type.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-neutral-600">{office.ownership_type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SETUP_STATUS_CLASS[office.setup_status]}`}
                    >
                      {SETUP_STATUS_LABEL[office.setup_status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{office.completion_pct}%</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/app/offices/:officeId/setup"
                      params={{ officeId: office.id }}
                      className="font-semibold text-primary-600 underline"
                    >
                      Setup
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
