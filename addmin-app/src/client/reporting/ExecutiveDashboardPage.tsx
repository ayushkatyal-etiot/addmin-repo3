import { useNavigate, useSearchParams } from "react-router";
import { useQuery, listOffices, getExecutiveDashboard } from "wasp/client/operations";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { DatePicker } from "../../shared/components/DatePicker";
import { PageLoading } from "../../shared/components/PageLoading";
import { sentenceCase } from "../../shared/text";

const MODULES = ["utility", "rent", "cam", "amc", "compliance"];
const STATUSES = ["overdue", "due_soon", "renewal", "compliance_gap"];

const STATUS_TONE: Record<string, BadgeTone> = {
  overdue: "danger",
  due_soon: "warning",
  renewal: "info",
  compliance_gap: "danger",
};

// F-18: Executive Dashboard -- office/module/period/status filters persist
// in the URL (useSearchParams, not component state) so a filtered view is
// shareable, per the acceptance criteria. Every KPI card and every row in
// the items table below carries the underlying record's real url -- that's
// the "drill-down," there's no separate report just for counts.
//
// Export to PDF/Excel (also in the acceptance criteria) is intentionally
// not implemented in this pass -- no PDF/spreadsheet library exists in this
// project yet, and every report table here can be a real dependency
// (jsPDF/exceljs or similar) added as a follow-up rather than guessed at.
export function ExecutiveDashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: offices } = useQuery(listOffices);

  const officeId = searchParams.get("officeId") ?? "";
  const module = searchParams.get("module") ?? "";
  const status = searchParams.get("status") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const { data, isLoading, error } = useQuery(getExecutiveDashboard, {
    officeId: officeId || undefined,
    module: module || undefined,
    status: status || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-12">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Executive dashboard</h1>
      <p className="mb-6 text-sm text-neutral-600">Cross-office spend, overdue items, renewals, and compliance gaps.</p>

      <div className="card mb-6 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="exec-filter-office" className="label block">
              Office
            </label>
            <select
              id="exec-filter-office"
              className="select-field text-sm"
              value={officeId}
              onChange={(e) => setFilter("officeId", e.target.value)}
            >
              <option value="">All offices</option>
              {(offices ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="exec-filter-module" className="label block">
              Module
            </label>
            <select
              id="exec-filter-module"
              className="select-field text-sm"
              value={module}
              onChange={(e) => setFilter("module", e.target.value)}
            >
              <option value="">All modules</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {sentenceCase(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="exec-filter-status" className="label block">
              Status
            </label>
            <select
              id="exec-filter-status"
              className="select-field text-sm"
              value={status}
              onChange={(e) => setFilter("status", e.target.value)}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {sentenceCase(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="exec-filter-from" className="label block">
              From
            </label>
            <DatePicker
              id="exec-filter-from"
              value={from}
              onChange={(v) => setFilter("from", v)}
              max={to || undefined}
              placeholder="Any date"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="exec-filter-to" className="label block">
              To
            </label>
            <DatePicker
              id="exec-filter-to"
              value={to}
              onChange={(v) => setFilter("to", v)}
              min={from || undefined}
              placeholder="Any date"
            />
          </div>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error instanceof Error ? error.message : "Could not load."}</p>}

      {isLoading && <PageLoading />}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KpiCard label="Overdue" value={data.kpis.overdue} onClick={() => setFilter("status", "overdue")} />
            <KpiCard label="Due soon" value={data.kpis.dueSoon} onClick={() => setFilter("status", "due_soon")} />
            <KpiCard label="Renewals" value={data.kpis.upcomingRenewals} onClick={() => setFilter("status", "renewal")} />
            <KpiCard
              label="Compliance gaps"
              value={data.kpis.complianceGaps}
              onClick={() => setFilter("status", "compliance_gap")}
            />
            <KpiCard label="Total spend" value={data.kpis.totalSpend} isCurrency />
          </div>

          {data.spendByOffice.length > 0 && (
            <div className="card mb-6 p-5">
              <div className="mb-3 text-sm font-semibold text-neutral-900">Spend by office</div>
              <div className="flex flex-col gap-2">
                {data.spendByOffice.map((o) => {
                  const max = Math.max(...data.spendByOffice.map((x) => x.amount), 1);
                  return (
                    <div key={o.officeId} className="flex items-center gap-3">
                      <div className="w-32 shrink-0 truncate text-sm text-neutral-700">{o.officeName}</div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full bg-primary-500" style={{ width: `${(o.amount / max) * 100}%` }} />
                      </div>
                      <div className="w-24 shrink-0 text-right text-sm text-neutral-600">{o.amount.toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.items.length === 0 ? (
            <div className="card p-8 text-center text-neutral-500">No records match these filters.</div>
          ) : (
            <table className="table-shell">
              <thead>
                <tr>
                  <th className="table-head-cell">Office</th>
                  <th className="table-head-cell">Module</th>
                  <th className="table-head-cell">Item</th>
                  <th className="table-head-cell">Status</th>
                  <th className="table-head-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                    onClick={() => navigate(item.url)}
                  >
                    <td className="table-cell text-neutral-600">{item.office}</td>
                    <td className="table-cell text-neutral-600">{sentenceCase(item.module)}</td>
                    <td className="table-cell font-medium">
                      {item.label}
                      <div className="text-xs font-normal text-neutral-400">{item.subtitle}</div>
                    </td>
                    <td className="table-cell">
                      <Badge tone={STATUS_TONE[item.status] ?? "neutral"}>{sentenceCase(item.status)}</Badge>
                    </td>
                    <td className="table-cell text-neutral-600">
                      {item.date ? new Date(item.date).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  isCurrency,
  onClick,
}: {
  label: string;
  value: number;
  isCurrency?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className={`card p-4 ${onClick ? "cursor-pointer hover:bg-neutral-50" : ""}`} onClick={onClick}>
      <div className="text-xs font-semibold text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-neutral-900">
        {isCurrency ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value}
      </div>
    </div>
  );
}
