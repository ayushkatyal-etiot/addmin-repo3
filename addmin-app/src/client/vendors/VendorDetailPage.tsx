import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  useQuery,
  getVendor,
  activateVendor,
  recordVendorPerformanceReview,
  createAmcContract,
  listAmcContracts,
  listUtilityAccounts,
} from "wasp/client/operations";
import { useSelectedOffice } from "../../shared/SelectedOfficeContext";
import { Button } from "../../shared/components/Button";
import { DatePicker } from "../../shared/components/DatePicker";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { sentenceCase } from "../../shared/text";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

const AMC_STATUS_TONE: Record<string, BadgeTone> = {
  active: "success",
  due_for_renewal: "warning",
  expired: "danger",
  closed: "neutral",
};

const INSTANCE_STATUS_TONE: Record<string, BadgeTone> = {
  expected: "neutral",
  received: "success",
  missing: "danger",
  in_process: "warning",
  closed: "neutral",
  cancelled: "neutral",
  waived: "neutral",
};

const LINK_TYPES = ["office", "utility_account"];

// F-14: vendor activation, AMC contract creation (routes through Step 06's
// obligation engine server-side, same invariant as Lease), and performance
// reviews -- one page, same shape as LeaseDetailPage.tsx.
export function VendorDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { data: vendor, isLoading, error: loadError, refetch } = useQuery(
    getVendor,
    vendorId ? { id: vendorId } : undefined,
    { enabled: !!vendorId },
  );
  const { data: amcContracts, refetch: refetchAmc } = useQuery(
    listAmcContracts,
    vendorId ? { vendorId } : undefined,
    { enabled: !!vendorId },
  );
  const { officeId: selectedOfficeId } = useSelectedOffice();

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AMC form state
  const [linkType, setLinkType] = useState(LINK_TYPES[0]);
  const [linkAccountId, setLinkAccountId] = useState("");
  const [amcStart, setAmcStart] = useState("");
  const [amcEnd, setAmcEnd] = useState("");
  const { data: accountsForOffice } = useQuery(
    listUtilityAccounts,
    selectedOfficeId ? { officeId: selectedOfficeId } : undefined,
    { enabled: !!selectedOfficeId && linkType === "utility_account" },
  );

  // Performance review form state
  const [slaPct, setSlaPct] = useState("");
  const [responseHours, setResponseHours] = useState("");
  const [qualityRating, setQualityRating] = useState("5");
  const [reviewRemark, setReviewRemark] = useState("");

  if (isLoading) return null;
  if (!vendor) {
    return (
      <div className="mx-auto w-full max-w-3xl p-12">
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
      await Promise.all([refetch(), refetchAmc()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const linkedEntityId = linkType === "office" ? selectedOfficeId : linkAccountId;

  return (
    <div className="mx-auto w-full max-w-3xl p-12">
      <button className="mb-4 text-sm text-neutral-500 hover:underline" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="card mb-6 p-8">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">{vendor.name}</h1>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">
            {vendor.status.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm text-neutral-500">
          {vendor.category.replace("_", " ")} {vendor.pan_gstin ? `· ${vendor.pan_gstin}` : ""}
        </p>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {vendor.status === "pending_activation" && (
          <Button className="mt-4" disabled={isSubmitting} onClick={() => run(() => activateVendor({ id: vendor.id }))}>
            Activate vendor
          </Button>
        )}
      </div>

      <div className="card mb-6 p-8">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">AMC contracts</h2>

        {vendor.status === "pending_activation" ? (
          <p className="text-sm text-neutral-500">Activate this vendor before assigning an AMC contract.</p>
        ) : (
          <div className="mb-6 flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Linked to</label>
                <select
                  className="select-field"
                  value={linkType}
                  onChange={(e) => {
                    setLinkType(e.target.value);
                    setLinkAccountId("");
                  }}
                >
                  {LINK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {sentenceCase(t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              Office links use the office selected in the top bar.
            </p>

            {linkType === "utility_account" && selectedOfficeId && (
              <div>
                <label className="label">Utility connection</label>
                <select className="select-field" value={linkAccountId} onChange={(e) => setLinkAccountId(e.target.value)}>
                  <option value="" disabled>
                    Select a connection
                  </option>
                  {(accountsForOffice ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.provider_name} ({a.meter_account_no})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start date</label>
                <DatePicker className={inputClass} value={amcStart} onChange={setAmcStart} />
              </div>
              <div>
                <label className="label">End date</label>
                <DatePicker className={inputClass} value={amcEnd} onChange={setAmcEnd} />
              </div>
            </div>

            <Button
              className="self-start"
              disabled={isSubmitting || !linkedEntityId || !amcStart || !amcEnd}
              onClick={() =>
                run(async () => {
                  await createAmcContract({
                    vendor_id: vendor.id,
                    linked_entity_type: linkType,
                    linked_entity_id: linkedEntityId,
                    start_date: amcStart,
                    end_date: amcEnd,
                  });
                  setAmcStart("");
                  setAmcEnd("");
                  setLinkAccountId("");
                })
              }
            >
              Create AMC contract
            </Button>
          </div>
        )}

        {(amcContracts?.length ?? 0) === 0 ? (
          <p className="text-sm text-neutral-500">No AMC contracts yet.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {amcContracts!.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-md border border-neutral-200">
                <table className="table-shell">
                  <thead>
                    <tr>
                      <th className="table-head-cell">Linked to</th>
                      <th className="table-head-cell">Start</th>
                      <th className="table-head-cell">End</th>
                      <th className="table-head-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="table-row-hover">
                      <td className="table-cell text-neutral-600">{sentenceCase(c.linked_entity_type)}</td>
                      <td className="table-cell text-neutral-600">{new Date(c.start_date).toLocaleDateString()}</td>
                      <td className="table-cell text-neutral-600">{new Date(c.end_date).toLocaleDateString()}</td>
                      <td className="table-cell">
                        <Badge tone={AMC_STATUS_TONE[c.status] ?? "neutral"}>{sentenceCase(c.status)}</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="border-t border-neutral-100 bg-neutral-50/50 px-4 py-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Renewal obligation schedule
                  </h3>
                  {!c.schedule && (
                    <p className="text-sm text-neutral-500">No obligation schedule linked to this contract.</p>
                  )}
                  {c.schedule && (
                    <p className="mb-3 text-sm text-neutral-600">
                      Notice window: {c.schedule.expected_window_days} days before contract end · anchor{" "}
                      {new Date(c.schedule.active_from).toLocaleDateString()}
                    </p>
                  )}
                  {c.schedule && c.obligation_instances.length === 0 && (
                    <p className="text-sm text-neutral-500">
                      No renewal obligation instance yet — one is created when you enter the notice window (contract end
                      minus {c.schedule.expected_window_days} days). Refresh this page after that date, or adjust the
                      contract end date for testing.
                    </p>
                  )}
                  {c.obligation_instances.length > 0 && (
                    <table className="table-shell">
                      <thead>
                        <tr>
                          <th className="py-2 pr-4">Period</th>
                          <th className="py-2 pr-4">Expected by</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.obligation_instances.map((i) => (
                          <tr key={i.id} className="table-row-hover">
                            <td className="py-2 pr-4 font-medium text-neutral-900">{i.period}</td>
                            <td className="py-2 pr-4 text-neutral-600">
                              {new Date(i.expected_date).toLocaleDateString()}
                            </td>
                            <td className="py-2">
                              <Badge tone={INSTANCE_STATUS_TONE[i.status] ?? "neutral"}>{sentenceCase(i.status)}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-8">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Performance reviews</h2>

        <div className="mb-6 flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">SLA compliance %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className={inputClass}
                value={slaPct}
                onChange={(e) => setSlaPct(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Response time (hrs)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                className={inputClass}
                value={responseHours}
                onChange={(e) => setResponseHours(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Quality rating</label>
              <select className="select-field" value={qualityRating} onChange={(e) => setQualityRating(e.target.value)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Remark (optional)</label>
            <input className={inputClass} value={reviewRemark} onChange={(e) => setReviewRemark(e.target.value)} />
          </div>
          <Button
            className="self-start"
            disabled={isSubmitting || !slaPct || !responseHours}
            onClick={() =>
              run(async () => {
                await recordVendorPerformanceReview({
                  vendorId: vendor.id,
                  sla_compliance_pct: Number(slaPct),
                  response_time_hours: Number(responseHours),
                  quality_rating: Number(qualityRating),
                  remark: reviewRemark || undefined,
                });
                setSlaPct("");
                setResponseHours("");
                setReviewRemark("");
              })
            }
          >
            Record review
          </Button>
        </div>

        {vendor.performanceReviews.length === 0 ? (
          <p className="text-sm text-neutral-500">No performance reviews yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {vendor.performanceReviews.map((r) => (
              <li key={r.id} className="text-neutral-600">
                {new Date(r.created_at).toLocaleDateString()} — SLA {r.sla_compliance_pct}%, response{" "}
                {r.response_time_hours}h, quality {r.quality_rating}/5
                {r.remark ? ` — "${r.remark}"` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
