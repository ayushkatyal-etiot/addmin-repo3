import { Fragment, useState } from "react";
import {
  useQuery,
  listComplianceItems,
  setComplianceApplicability,
  uploadComplianceDocument,
} from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { DatePicker } from "../../shared/components/DatePicker";
import { FileUploadField } from "../../shared/components/FileUploadField";
import { uploadDocument } from "../../shared/uploadDocument";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { PageLoading } from "../../shared/components/PageLoading";
import { useSelectedOffice, NoOfficesInScope } from "../../shared/SelectedOfficeContext";
import { sentenceCase } from "../../shared/text";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

const STATUS_TONE: Record<string, BadgeTone> = {
  missing: "neutral",
  valid: "success",
  expiring: "warning",
  expired: "danger",
  not_applicable: "neutral",
};

// F-17: the checklist (mark applicability, upload/renew documents).
// Seeded types the office hasn't touched yet still show up as "missing"
// (listComplianceItems synthesizes them), so the checklist always looks
// complete even for offices that predate this module.
export function ComplianceListPage() {
  const { officeId, isLoading: officesLoading, error: officesError, hasOffices } = useSelectedOffice();
  const { data: items, isLoading: itemsLoading, error: itemsError, refetch } = useQuery(
    listComplianceItems,
    officeId ? { officeId } : undefined,
    { enabled: !!officeId },
  );

  const [newType, setNewType] = useState("");
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setIsSubmitting(true);
    try {
      await action();
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openUpload(type: string) {
    setExpandedType(type);
    setDocFile(null);
    setExpiryDate("");
  }

  if (officesLoading) return <PageLoading />;

  if (officesError) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Compliance</h1>
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
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Compliance</h1>

      <div className="card mb-6 flex items-end gap-3 p-4">
        <div className="flex-1">
          <label className="label">Add a custom certificate type</label>
          <input
            className={inputClass}
            placeholder="e.g. lift_license"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          />
        </div>
        <Button
          disabled={isSubmitting || !newType.trim()}
          onClick={() =>
            run(async () => {
              await setComplianceApplicability({ office_id: officeId, compliance_type: newType.trim(), applicability: "missing" });
              setNewType("");
            })
          }
        >
          Add
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <ErrorBanner error={itemsError} />

      {itemsLoading && <PageLoading />}

      {!itemsLoading && items && (
        <table className="table-shell">
          <thead>
            <tr>
              <th className="table-head-cell">Certificate</th>
              <th className="table-head-cell">Status</th>
              <th className="table-head-cell">Expiry</th>
              <th className="table-head-cell" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <Fragment key={item.compliance_type}>
                <tr className="border-t border-neutral-100 align-top">
                  <td className="table-cell font-medium">
                    {sentenceCase(item.compliance_type)}
                    {!item.seeded && <span className="ml-2 text-xs text-neutral-400">(custom)</span>}
                  </td>
                  <td className="table-cell">
                    <Badge tone={STATUS_TONE[item.status] ?? "neutral"}>{sentenceCase(item.status)}</Badge>
                  </td>
                  <td className="table-cell text-neutral-600">
                    {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex justify-end gap-2">
                      {item.status !== "not_applicable" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isSubmitting}
                          onClick={() =>
                            run(() =>
                              setComplianceApplicability({
                                office_id: officeId,
                                compliance_type: item.compliance_type,
                                applicability: "not_applicable",
                              }),
                            )
                          }
                        >
                          Not applicable
                        </Button>
                      )}
                      <Button size="sm" onClick={() => openUpload(item.compliance_type)}>
                        {item.status === "valid" || item.status === "expiring" || item.status === "expired"
                          ? "Renew"
                          : "Upload"}
                      </Button>
                    </div>
                  </td>
                </tr>
                {expandedType === item.compliance_type && (
                  <tr className="border-t border-neutral-100 bg-neutral-50/50">
                    <td className="table-cell" colSpan={4}>
                      <div className="flex flex-col gap-4 py-2 sm:grid sm:grid-cols-[minmax(0,1fr)_11.5rem_auto] sm:grid-rows-[auto_auto_auto] sm:gap-x-4 sm:gap-y-1">
                        <div className="contents">
                          <label className="label sm:col-start-1 sm:row-start-1">Document</label>
                          <div className="sm:col-start-1 sm:row-start-2">
                            <FileUploadField
                              file={docFile}
                              onFileChange={setDocFile}
                              disabled={isSubmitting}
                              showHint={false}
                            />
                          </div>
                          <p className="text-xs text-neutral-500 sm:col-start-1 sm:row-start-3">
                            PDF, images, or CSV up to 10 MB
                          </p>
                        </div>
                        <div className="contents">
                          <label className="label sm:col-start-2 sm:row-start-1">Expiry date</label>
                          <div className="sm:col-start-2 sm:row-start-2">
                            <DatePicker className={inputClass} value={expiryDate} onChange={setExpiryDate} required />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:col-start-3 sm:row-start-2 sm:h-10">
                          <Button
                            disabled={isSubmitting || !docFile || !expiryDate}
                            onClick={() =>
                              run(async () => {
                                if (!docFile) return;
                                const uploaded = await uploadDocument(docFile);
                                await uploadComplianceDocument({
                                  office_id: officeId,
                                  compliance_type: item.compliance_type,
                                  doc_ref: uploaded.docRef,
                                  expiry_date: expiryDate,
                                });
                                setExpandedType(null);
                              })
                            }
                          >
                            Save
                          </Button>
                          <Button variant="ghost" onClick={() => setExpandedType(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
