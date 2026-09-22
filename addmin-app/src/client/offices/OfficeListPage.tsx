import { useState } from "react";
import { useQuery, listOffices, bulkImportOffices } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { ButtonLink } from "../../shared/components/Button";
import { BulkImportPanel } from "../../shared/components/BulkImportPanel";
import { sentenceCase } from "../../shared/text";

// F-03 (planmysaas-blueprint/05-features.md): office list, plus CSV bulk
// import (per-row error reporting, doesn't fail the whole batch). Setup
// status/completion columns removed -- onboarding checklist is hidden per
// planmysaas-blueprint/11-without-setup-decision.md ("Option A"); offices
// are active on creation.
export function OfficeListPage() {
  const { data: offices, isLoading, refetch } = useQuery(listOffices);
  const [showImport, setShowImport] = useState(false);

  async function onImport(csv: string) {
    const result = await bulkImportOffices({ csv });
    await refetch();
    return result;
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[32px] font-bold tracking-tight text-neutral-900">Offices</h1>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="text-sm font-semibold text-primary-600 underline"
          >
            Bulk import (CSV)
          </button>
          <ButtonLink to="/app/offices/new">Add office</ButtonLink>
        </div>
      </div>

      {showImport && (
        <BulkImportPanel
          header="name,address,office_type,ownership_type,code"
          examples="Mumbai HQ,1 Main St,head_office,owned,MUM-HQ"
          onImport={onImport}
        />
      )}

      {isLoading && <p className="text-neutral-500">Loading…</p>}

      {!isLoading && offices?.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">
          No offices yet. <Link to="/app/offices/new" className="font-semibold text-primary-600 underline">Add your first office</Link>.
        </div>
      )}

      {!isLoading && offices && offices.length > 0 && (
        <table className="table-shell">
          <thead>
            <tr>
              <th className="table-head-cell">Code</th>
              <th className="table-head-cell">Name</th>
              <th className="table-head-cell">Type</th>
              <th className="table-head-cell">Ownership</th>
              <th className="table-head-cell" />
            </tr>
          </thead>
          <tbody>
            {offices.map((office) => (
              <tr key={office.id} className="table-row-hover">
                <td className="table-cell font-mono text-sm text-neutral-500">{office.code}</td>
                <td className="table-cell font-bold text-neutral-900">{office.name}</td>
                <td className="table-cell text-neutral-600">{sentenceCase(office.office_type)}</td>
                <td className="table-cell text-neutral-600">{sentenceCase(office.ownership_type)}</td>
                <td className="table-cell text-right">
                  <Link
                    to="/app/offices/:officeId/setup"
                    params={{ officeId: office.id }}
                    className="text-sm font-semibold text-primary-600 underline"
                  >
                    Edit details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
