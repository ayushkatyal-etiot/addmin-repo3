import { useNavigate } from "react-router";
import { useQuery, listMyActions } from "wasp/client/operations";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { PageLoading } from "../../shared/components/PageLoading";
import { sentenceCase } from "../../shared/text";

const SEVERITY_TONE: Record<string, BadgeTone> = {
  overdue: "danger",
  due_soon: "warning",
  normal: "neutral",
};

const MODULE_LABEL: Record<string, string> = {
  utility: "Utility",
  lease: "Lease",
  maintenance: "Maintenance",
  asset: "Asset",
  vendor: "Vendor",
  compliance: "Compliance",
};

// F-18: "My Actions queue aggregates pending items across Utility, Lease,
// Maintenance, Asset, Vendor, and Compliance modules into one list per
// user" -- listMyActions (src/server/reporting/myActions.ts) does the
// aggregation; this page is just the rendering, one click per item straight
// to its real source record (no intermediate module menu).
export function MyActionsPage() {
  const navigate = useNavigate();
  const { data: items, isLoading, error } = useQuery(listMyActions);

  if (isLoading) return <PageLoading />;

  return (
    <div className="mx-auto w-full max-w-4xl p-12">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">My actions</h1>
      <p className="mb-6 text-sm text-neutral-600">Everything across every module waiting on you, in one place.</p>

      {error && <p className="mb-4 text-sm text-red-600">{error instanceof Error ? error.message : "Could not load."}</p>}

      {!error && (items?.length ?? 0) === 0 && (
        <div className="card p-8 text-center text-neutral-500">Nothing pending. You're all caught up.</div>
      )}

      {items && items.length > 0 && (
        <ul className="card flex flex-col divide-y divide-neutral-100 overflow-hidden">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex cursor-pointer items-center justify-between gap-4 p-4 hover:bg-neutral-50"
              onClick={() => navigate(item.url)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-400">{MODULE_LABEL[item.module]}</span>
                  <Badge tone={SEVERITY_TONE[item.severity]}>{sentenceCase(item.severity)}</Badge>
                </div>
                <div className="mt-1 truncate text-sm font-medium text-neutral-900">{item.title}</div>
                <div className="truncate text-xs text-neutral-500">{item.subtitle}</div>
              </div>
              {item.dueDate && (
                <div className="shrink-0 text-xs text-neutral-500">{new Date(item.dueDate).toLocaleDateString()}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
