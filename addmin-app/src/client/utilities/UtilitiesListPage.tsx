import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, listUtilityAccounts, bulkImportUtilityAccounts } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { Button } from "../../shared/components/Button";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { BulkImportPanel } from "../../shared/components/BulkImportPanel";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { PageLoading } from "../../shared/components/PageLoading";
import { useSelectedOffice } from "../../shared/SelectedOfficeContext";
import { sentenceCase } from "../../shared/text";

const STATUS_TONE: Record<string, BadgeTone> = {
  active: "success",
  inactive: "neutral",
};

// F-06: utility connections list — office scope comes from the top bar selector.
export function UtilitiesListPage() {
  const navigate = useNavigate();
  const { officeId, isLoading: officesLoading, error: officesError, hasOffices } = useSelectedOffice();
  const { data: accounts, isLoading: accountsLoading, error: accountsError, refetch } = useQuery(
    listUtilityAccounts,
    officeId ? { officeId } : undefined,
    { enabled: !!officeId },
  );
  const [showImport, setShowImport] = useState(false);

  if (officesLoading) return <PageLoading />;

  if (officesError) {
    return (
      <div className="mx-auto w-full max-w-4xl p-12">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Utility connections</h1>
        <ErrorBanner error={officesError} />
      </div>
    );
  }

  if (!hasOffices) {
    return (
      <div className="mx-auto w-full max-w-4xl p-12">
        <div className="card p-8 text-center text-neutral-500">
          No offices in your scope.{" "}
          <Link to="/app/offices/new" className="font-semibold text-primary-600 underline">
            Add an office
          </Link>{" "}
          (admins) or ask an admin to assign your office access.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Utility connections</h1>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="text-sm font-semibold text-primary-600 underline"
          >
            Bulk import (CSV)
          </button>
          <Button onClick={() => navigate("/app/utilities/new")}>Add connection</Button>
        </div>
      </div>

      {showImport && (
        <BulkImportPanel
          header="office_code,utility_type,provider_name,meter_account_no,billing_cycle,vendor_id,start_date"
          examples="MUM-HQ,electricity,BEST,1234567890,monthly,,"
          onImport={async (csv) => {
            const result = await bulkImportUtilityAccounts({ csv });
            await refetch();
            return result;
          }}
        />
      )}

      <ErrorBanner error={accountsError} />

      {accountsLoading && <p className="text-neutral-500">Loading…</p>}

      {!accountsLoading && accounts?.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">
          No utility connections for this office yet.
        </div>
      )}

      {!accountsLoading && accounts && accounts.length > 0 && (
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">Type</th>
                <th className="table-head-cell">Provider</th>
                <th className="table-head-cell">Account / meter no.</th>
                <th className="table-head-cell">Billing cycle</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                  onClick={() => navigate(`/app/utilities/${a.id}`)}
                >
                  <td className="table-cell text-neutral-600">{sentenceCase(a.utility_type)}</td>
                  <td className="table-cell font-medium text-neutral-900">{a.provider_name}</td>
                  <td className="table-cell font-mono text-xs">{a.meter_account_no}</td>
                  <td className="table-cell text-neutral-600">{sentenceCase(a.billing_cycle)}</td>
                  <td className="table-cell">
                    <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{sentenceCase(a.status)}</Badge>
                  </td>
                  <td className="table-cell text-right text-primary-600 underline">View</td>
                </tr>
              ))}
            </tbody>
          </table>
      )}
    </div>
  );
}
