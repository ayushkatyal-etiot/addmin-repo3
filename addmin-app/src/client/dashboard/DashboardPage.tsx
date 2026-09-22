import { useQuery, getOfficeHome } from "wasp/client/operations";
import { useNavigate } from "react-router";
import { Badge } from "../../shared/components/Badge";
import { PageLoading } from "../../shared/components/PageLoading";
import { useSelectedOffice, NoOfficesInScope } from "../../shared/SelectedOfficeContext";

// Build Step 09, F-18: Office Home -- the real landing page after login
// (src/HomePage.tsx redirects here). Replaces the old generic multi-office
// KPI mock (getDashboardSummary/summary.ts, deleted) with the actual spec:
// obligations due/overdue, pending approvals, upcoming renewals, compliance
// gaps, and setup completion for the ONE office selected in the Topbar's
// OfficeSwitcher -- not an org-wide aggregate.
export function DashboardPage() {
  const navigate = useNavigate();
  const { officeId, isLoading: officesLoading, hasOffices } = useSelectedOffice();
  const { data, isLoading, error } = useQuery(getOfficeHome, officeId ? { officeId } : undefined, {
    enabled: !!officeId,
  });

  if (officesLoading) return <PageLoading />;
  if (!hasOffices) {
    return (
      <div className="p-6">
        <NoOfficesInScope />
      </div>
    );
  }
  if (isLoading || !data) return <PageLoading />;
  if (error) {
    return <div className="p-6 text-sm text-red-600">{error instanceof Error ? error.message : "Could not load Office Home."}</div>;
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <div className="mb-0.5 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-neutral-900">{data.officeName}</h1>
        </div>
        <p className="text-sm text-neutral-600">Everything due, overdue, or coming up for this office.</p>
      </div>

      {!data.hasAnyActivity ? (
        <div className="card p-8 text-center text-neutral-500">
          Nothing tracked here yet. Once utility connections, leases, vendors, or compliance items are added for this
          office, they'll show up here as they come due.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section
            title="Overdue"
            emptyLabel="Nothing overdue."
            items={data.obligationsOverdue}
            tone="danger"
            onOpen={navigate}
          />
          <Section
            title="Due soon"
            emptyLabel="Nothing due in the next two weeks."
            items={data.obligationsDueSoon}
            tone="warning"
            onOpen={navigate}
          />
          <Section
            title="Pending approvals"
            emptyLabel="Nothing awaiting approval."
            items={data.pendingApprovals}
            tone="info"
            onOpen={navigate}
          />
          <Section
            title="Upcoming renewals"
            emptyLabel="No renewals in the next 90 days."
            items={data.upcomingRenewals}
            tone="neutral"
            onOpen={navigate}
          />
        </div>
      )}

      <div
        className="card flex cursor-pointer items-center justify-between p-5"
        onClick={() => navigate(`/app/compliance?officeId=${data.officeId}`)}
      >
        <div className="text-sm font-semibold text-neutral-900">Compliance gaps</div>
        <Badge tone={data.complianceGapCount > 0 ? "danger" : "success"}>
          {data.complianceGapCount > 0 ? `${data.complianceGapCount} open` : "All clear"}
        </Badge>
      </div>
    </div>
  );
}

function Section({
  title,
  emptyLabel,
  items,
  tone,
  onOpen,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{ id: string; label: string; subtitle: string; date: string | null; url: string }>;
  tone: "danger" | "warning" | "info" | "neutral";
  onOpen: (url: string) => void;
}) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <Badge tone={tone}>{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {items.slice(0, 8).map((item) => (
            <li
              key={item.id}
              className="flex cursor-pointer items-center justify-between gap-3 py-2.5 hover:bg-neutral-50"
              onClick={() => onOpen(item.url)}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-neutral-900">{item.label}</div>
                <div className="truncate text-xs text-neutral-400">{item.subtitle}</div>
              </div>
              {item.date && (
                <div className="shrink-0 text-xs text-neutral-500">{new Date(item.date).toLocaleDateString()}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
