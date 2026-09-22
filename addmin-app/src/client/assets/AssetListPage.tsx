import { useState } from "react";
import {
  useQuery,
  listAssets,
  createAsset,
  bulkImportAssets,
  setAssetStatus,
  listAssetRequestsForOffice,
  allocateAssetRequest,
  markAssetRequestProcurementPending,
} from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { DatePicker } from "../../shared/components/DatePicker";
import { FileUploadField, readTextFile } from "../../shared/components/FileUploadField";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { PageLoading } from "../../shared/components/PageLoading";
import { useSelectedOffice, NoOfficesInScope } from "../../shared/SelectedOfficeContext";
import { sentenceCase } from "../../shared/text";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

const ASSET_STATUS_TONE: Record<string, BadgeTone> = {
  available: "success",
  assigned: "info",
  under_service: "warning",
  retired: "neutral",
};

const REQUEST_STATUS_TONE: Record<string, BadgeTone> = {
  pending_manager_approval: "neutral",
  rejected: "danger",
  returned: "warning",
  pending_allocation: "info",
  procurement_pending: "warning",
  closed: "success",
};

// F-16: Office Admin's asset register (add/bulk-import/retire) and the
// allocation queue (requests awaiting an available asset), one page.
export function AssetListPage() {
  const { officeId, isLoading: officesLoading, error: officesError, hasOffices } = useSelectedOffice();
  const { data: assets, isLoading: assetsLoading, error: assetsError, refetch: refetchAssets } = useQuery(
    listAssets,
    officeId ? { officeId } : undefined,
    { enabled: !!officeId },
  );
  const { data: requests, refetch: refetchRequests } = useQuery(
    listAssetRequestsForOffice,
    officeId ? { officeId } : undefined,
    { enabled: !!officeId },
  );

  const [category, setCategory] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [warrantyEnd, setWarrantyEnd] = useState("");
  const [csv, setCsv] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResults, setCsvResults] = useState<Array<{ row: number; success: boolean; error?: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allocatingRequestId, setAllocatingRequestId] = useState<string | null>(null);
  const [allocateAssetId, setAllocateAssetId] = useState("");

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setIsSubmitting(true);
    try {
      await action();
      await Promise.all([refetchAssets(), refetchRequests()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const availableAssets = (assets ?? []).filter((a) => a.status === "available");
  const openRequests = (requests ?? []).filter((r) => r.status === "pending_allocation" || r.status === "procurement_pending");

  if (officesLoading) return <PageLoading />;

  if (officesError) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Assets</h1>
        <ErrorBanner error={officesError} />
      </div>
    );
  }

  if (!hasOffices) {
    return (
      <div className="p-6">
        <NoOfficesInScope />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Assets</h1>

      <div className="card mb-8 flex flex-col gap-4 p-8">
        <h2 className="text-lg font-semibold text-neutral-900">Add asset</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Category</label>
            <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <label className="label">Serial no. (optional)</label>
            <input className={inputClass} value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
          </div>
          <div>
            <label className="label">Warranty end (optional)</label>
            <DatePicker className={inputClass} value={warrantyEnd} onChange={setWarrantyEnd} />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button
          className="self-start"
          disabled={isSubmitting || !category}
          onClick={() =>
            run(async () => {
              await createAsset({
                office_id: officeId,
                category,
                serial_no: serialNo || undefined,
                warranty_end: warrantyEnd || undefined,
              });
              setCategory("");
              setSerialNo("");
              setWarrantyEnd("");
            })
          }
        >
          Add asset
        </Button>

        <div className="mt-4 border-t border-neutral-200 pt-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Bulk import (CSV)</h3>
          <p className="mb-2 text-xs text-neutral-500">Columns: office_code,category,serial_no,warranty_end</p>
          <div className="mb-2">
            <FileUploadField
              accept=".csv,text/csv,text/plain"
              hint="Upload a CSV file or paste below"
              file={csvFile}
              onFileChange={(file) => {
                setCsvFile(file);
                if (file) void readTextFile(file).then(setCsv);
              }}
            />
          </div>
          <textarea
            className={`${inputClass} h-24 font-mono text-xs`}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <Button
            variant="ghost"
            className="mt-2"
            disabled={isSubmitting || !csv.trim()}
            onClick={() =>
              run(async () => {
                const { results } = await bulkImportAssets({ csv });
                setCsvResults(results);
                setCsv("");
              })
            }
          >
            Import CSV
          </Button>
          {csvResults && (
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {csvResults.map((r) => (
                <li key={r.row} className={r.success ? "text-primary-700" : "text-red-600"}>
                  Row {r.row}: {r.success ? "OK" : r.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {openRequests.length > 0 && (
        <div className="card mb-8 overflow-hidden">
          <div className="border-b border-neutral-100 p-4">
            <h2 className="text-lg font-semibold text-neutral-900">Allocation queue</h2>
          </div>
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">Requested by</th>
                <th className="table-head-cell">Category</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell" />
              </tr>
            </thead>
            <tbody>
              {openRequests.map((r) => (
                <tr key={r.id} className="table-row-hover align-top">
                  <td className="table-cell text-neutral-900">{r.requested_by_email}</td>
                  <td className="table-cell text-neutral-600">{r.category}</td>
                  <td className="table-cell">
                    <Badge tone={REQUEST_STATUS_TONE[r.status] ?? "neutral"}>{sentenceCase(r.status)}</Badge>
                  </td>
                  <td className="table-cell">
                    {allocatingRequestId === r.id ? (
                      <div className="flex items-center gap-2">
                        <select className="select-field" value={allocateAssetId} onChange={(e) => setAllocateAssetId(e.target.value)}>
                          <option value="" disabled>
                            Select an asset
                          </option>
                          {availableAssets.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.category} {a.serial_no ? `(${a.serial_no})` : ""}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          disabled={isSubmitting || !allocateAssetId}
                          onClick={() =>
                            run(async () => {
                              await allocateAssetRequest({ requestId: r.id, assetId: allocateAssetId });
                              setAllocatingRequestId(null);
                              setAllocateAssetId("");
                            })
                          }
                        >
                          Allocate
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setAllocatingRequestId(r.id)} disabled={availableAssets.length === 0}>
                          Allocate
                        </Button>
                        {r.status === "pending_allocation" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isSubmitting}
                            onClick={() => run(() => markAssetRequestProcurementPending({ requestId: r.id }))}
                          >
                            No stock
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ErrorBanner error={assetsError} />

      {assetsLoading && <PageLoading />}

      {!assetsLoading && assets?.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">No assets for this office yet.</div>
      )}

      {!assetsLoading && assets && assets.length > 0 && (
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">Category</th>
                <th className="table-head-cell">Serial no.</th>
                <th className="table-head-cell">Warranty end</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell" />
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="table-row-hover">
                  <td className="table-cell font-medium text-neutral-900">{a.category}</td>
                  <td className="table-cell font-mono text-xs">{a.serial_no ?? "—"}</td>
                  <td className="table-cell text-neutral-600">
                    {a.warranty_end ? new Date(a.warranty_end).toLocaleDateString() : "—"}
                  </td>
                  <td className="table-cell">
                    <Badge tone={ASSET_STATUS_TONE[a.status] ?? "neutral"}>{sentenceCase(a.status)}</Badge>
                  </td>
                  <td className="table-cell text-right">
                    {a.status === "available" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isSubmitting}
                        onClick={() => run(() => setAssetStatus({ id: a.id, status: "under_service" }))}
                      >
                        Send for service
                      </Button>
                    )}
                    {a.status === "under_service" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isSubmitting}
                        onClick={() => run(() => setAssetStatus({ id: a.id, status: "available" }))}
                      >
                        Back in service
                      </Button>
                    )}
                    {(a.status === "available" || a.status === "under_service") && (
                      <Button
                        size="sm"
                        variant="danger"
                        className="ml-2"
                        disabled={isSubmitting}
                        onClick={() => run(() => setAssetStatus({ id: a.id, status: "retired" }))}
                      >
                        Retire
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      )}
    </div>
  );
}
