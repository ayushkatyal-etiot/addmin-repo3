import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  useQuery,
  getMaintenanceRequest,
  getMyUserContext,
  createWorkOrder,
  updateWorkOrderStatus,
  uploadWorkOrderEvidence,
  verifyWorkOrder,
  listVendors,
} from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { DatePicker } from "../../shared/components/DatePicker";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { FileUploadField } from "../../shared/components/FileUploadField";
import { PageLoading } from "../../shared/components/PageLoading";
import { isUploadedDocRef, uploadDocument, uploadedFileDownloadUrl } from "../../shared/uploadDocument";
import { sentenceCase } from "../../shared/text";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

const WORK_ORDER_ADMIN_ROLES = new Set(["platform_admin", "office_admin"]);
const WORK_ORDER_EXECUTOR_ROLES = new Set(["platform_admin", "office_admin", "facility_staff"]);

// F-15: request -> work order -> evidence -> verification, all on one page,
// same shape as LeaseDetailPage.tsx/BillDetailPage.tsx. Role gates use
// getMyUserContext (not useAuth() alone) since the session can lag a
// just-changed office/role assignment -- see authz.ts's userFromSession.
export function MaintenanceDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { data: userContext } = useQuery(getMyUserContext);
  const canManageWorkOrder = !!userContext?.role && WORK_ORDER_ADMIN_ROLES.has(userContext.role);
  const canExecuteWorkOrder = !!userContext?.role && WORK_ORDER_EXECUTOR_ROLES.has(userContext.role);

  const { data: request, isLoading, error: loadError, refetch } = useQuery(
    getMaintenanceRequest,
    requestId ? { id: requestId } : undefined,
    { enabled: !!requestId },
  );
  const { data: vendors } = useQuery(listVendors, undefined, { enabled: canManageWorkOrder });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Work order creation form
  const [vendorId, setVendorId] = useState("");
  const [slaDueAt, setSlaDueAt] = useState("");

  // Evidence upload form
  const [evidenceKind, setEvidenceKind] = useState<"before" | "after">("before");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceComment, setEvidenceComment] = useState("");

  // Verification form
  const [verifyRemark, setVerifyRemark] = useState("");

  if (isLoading) return <PageLoading />;
  if (!request) {
    return (
      <div className="p-6">
        <ErrorBanner error={loadError} />
        {!loadError && "Not found."}
      </div>
    );
  }

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

  const workOrder = request.workOrder;
  const activeVendors = (vendors ?? []).filter((v) => v.status !== "pending_activation");

  return (
    <div className="p-6">
      <button className="mb-4 text-sm text-neutral-500 hover:underline" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="card mb-6 p-8">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">{request.category}</h1>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">
            {sentenceCase(request.status)}
          </span>
        </div>
        <p className="text-sm text-neutral-500">Priority: {sentenceCase(request.priority)}</p>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      {!workOrder && (
        <div className="card mb-6 p-8">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Create work order</h2>
          {canManageWorkOrder ? (
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Vendor (optional)</label>
                <select className="select-field" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                  <option value="">No eligible vendor yet — leave open</option>
                  {activeVendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({sentenceCase(v.category)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">SLA due date</label>
                <DatePicker
                  mode="datetime"
                  className={inputClass}
                  value={slaDueAt}
                  onChange={setSlaDueAt}
                  placeholder="Pick date and time"
                  required
                />
              </div>
              <Button
                className="self-start"
                disabled={isSubmitting || !slaDueAt}
                onClick={() =>
                  run(() =>
                    createWorkOrder({
                      maintenance_request_id: request.id,
                      vendor_id: vendorId || undefined,
                      sla_due_at: slaDueAt,
                    }),
                  )
                }
              >
                Create work order
              </Button>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Waiting on an Office Admin to create a work order.</p>
          )}
        </div>
      )}

      {workOrder && (
        <div className="card mb-6 p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Work order</h2>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">
              {sentenceCase(workOrder.status)}
            </span>
          </div>
          <dl className="mb-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-neutral-500">Vendor</dt>
              <dd className="font-medium text-neutral-900">{workOrder.vendor_name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">SLA due</dt>
              <dd className="font-medium text-neutral-900">{new Date(workOrder.sla_due_at).toLocaleString()}</dd>
            </div>
          </dl>
          {workOrder.verification_remark && (
            <p className="mb-4 text-sm text-amber-700">Reopened: "{workOrder.verification_remark}"</p>
          )}

          {canExecuteWorkOrder && workOrder.status === "assigned" && (
            <Button
              disabled={isSubmitting}
              onClick={() => run(() => updateWorkOrderStatus({ workOrderId: workOrder.id, status: "in_progress" }))}
            >
              Mark in progress
            </Button>
          )}

          {canExecuteWorkOrder && (workOrder.status === "assigned" || workOrder.status === "in_progress") && (
            <div className="mt-6 flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">Upload evidence</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Kind</label>
                  <select
                    className="select-field"
                    value={evidenceKind}
                    onChange={(e) => setEvidenceKind(e.target.value as "before" | "after")}
                  >
                    <option value="before">Before</option>
                    <option value="after">After</option>
                  </select>
                </div>
                <div>
                  <label className="label">Evidence file</label>
                  <FileUploadField file={evidenceFile} onFileChange={setEvidenceFile} disabled={isSubmitting} />
                </div>
              </div>
              <div>
                <label className="label">Comment (optional)</label>
                <input className={inputClass} value={evidenceComment} onChange={(e) => setEvidenceComment(e.target.value)} />
              </div>
              <Button
                variant="ghost"
                className="self-start"
                disabled={isSubmitting || !evidenceFile}
                onClick={() =>
                  run(async () => {
                    if (!evidenceFile) return;
                    const uploaded = await uploadDocument(evidenceFile);
                    await uploadWorkOrderEvidence({
                      workOrderId: workOrder.id,
                      kind: evidenceKind,
                      doc_ref: uploaded.docRef,
                      comment: evidenceComment || undefined,
                    });
                    setEvidenceFile(null);
                    setEvidenceComment("");
                  })
                }
              >
                Add evidence
              </Button>
            </div>
          )}

          {canExecuteWorkOrder && workOrder.status === "in_progress" && (
            <Button
              className="mt-6"
              disabled={isSubmitting}
              onClick={() => run(() => updateWorkOrderStatus({ workOrderId: workOrder.id, status: "completed" }))}
            >
              Mark completed
            </Button>
          )}

          {canManageWorkOrder && workOrder.status === "completed" && (
            <div className="mt-6 flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">Verify completion</h3>
              <div>
                <label className="label">Remark (required to reopen)</label>
                <input className={inputClass} value={verifyRemark} onChange={(e) => setVerifyRemark(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button
                  disabled={isSubmitting}
                  onClick={() => run(() => verifyWorkOrder({ workOrderId: workOrder.id, decision: "verified" }))}
                >
                  Verify &amp; close
                </Button>
                <Button
                  variant="danger"
                  disabled={isSubmitting || !verifyRemark}
                  onClick={() =>
                    run(async () => {
                      await verifyWorkOrder({ workOrderId: workOrder.id, decision: "reopen", remark: verifyRemark });
                      setVerifyRemark("");
                    })
                  }
                >
                  Reopen
                </Button>
              </div>
            </div>
          )}

          {workOrder.evidence.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-neutral-900">Evidence log</h3>
              <ul className="flex flex-col gap-2 text-sm">
                {workOrder.evidence.map((e) => (
                  <li key={e.id} className="text-neutral-600">
                    [{sentenceCase(e.kind)}]{" "}
                    {isUploadedDocRef(e.doc_ref) ? (
                      <a
                        href={uploadedFileDownloadUrl(e.doc_ref)}
                        className="font-medium text-primary-600 underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View file
                      </a>
                    ) : (
                      e.doc_ref
                    )}{" "}
                    — {new Date(e.uploaded_at).toLocaleString()}
                    {e.comment ? ` — "${e.comment}"` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
