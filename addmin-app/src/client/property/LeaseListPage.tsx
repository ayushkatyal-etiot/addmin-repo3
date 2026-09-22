import { useNavigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import { useQuery, listLeases } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { Button } from "../../shared/components/Button";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { PageLoading } from "../../shared/components/PageLoading";
import { useSelectedOffice } from "../../shared/SelectedOfficeContext";
import { sentenceCase } from "../../shared/text";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  active: "success",
  expiring: "warning",
  renewed: "info",
  terminated: "danger",
};

// F-12: leases list — office scope from the top bar.
export function LeaseListPage() {
  const { data: user } = useAuth();
  const canAddLease = user?.role === "platform_admin" || user?.role === "office_admin";
  const navigate = useNavigate();
  const { officeId, isLoading: officesLoading, error: officesError, hasOffices } = useSelectedOffice();
  const { data: leases, isLoading: leasesLoading, error: leasesError } = useQuery(
    listLeases,
    officeId ? { officeId } : undefined,
    { enabled: !!officeId },
  );

  if (officesLoading) return <PageLoading />;

  if (officesError) {
    return (
      <div className="mx-auto w-full max-w-4xl p-12">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Leases</h1>
        <ErrorBanner error={officesError} />
        <p className="mt-4 text-sm text-neutral-500">
          Leases are available to platform admins, office admins, and office heads. Use an admin account or ask for the
          right role.
        </p>
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
        <h1 className="text-2xl font-semibold text-neutral-900">Leases</h1>
        {canAddLease && (
          <Button onClick={() => navigate("/app/property/leases/new")}>Add lease</Button>
        )}
      </div>
      {user?.role === "payment_authorizer" && (
        <p className="mb-4 text-sm text-neutral-500">Open a lease to record rent or CAM payments.</p>
      )}

      <ErrorBanner error={leasesError} />

      {leasesLoading && <p className="text-neutral-500">Loading…</p>}

      {!leasesLoading && leases?.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">No leases for this office yet.</div>
      )}

      {!leasesLoading && leases && leases.length > 0 && (
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">Landlord</th>
                <th className="table-head-cell">Rent</th>
                <th className="table-head-cell">CAM</th>
                <th className="table-head-cell">Start</th>
                <th className="table-head-cell">End</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell" />
              </tr>
            </thead>
            <tbody>
              {leases.map((l) => (
                <tr
                  key={l.id}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                  onClick={() => navigate(`/app/property/leases/${l.id}`)}
                >
                  <td className="table-cell font-medium text-neutral-900">{l.landlord_name}</td>
                  <td className="table-cell text-neutral-600">{l.rent_amount}</td>
                  <td className="table-cell text-neutral-600">{l.cam_amount ?? "—"}</td>
                  <td className="table-cell text-neutral-600">{new Date(l.start_date).toLocaleDateString()}</td>
                  <td className="table-cell text-neutral-600">{new Date(l.end_date).toLocaleDateString()}</td>
                  <td className="table-cell">
                    <Badge tone={STATUS_TONE[l.status] ?? "neutral"}>{sentenceCase(l.status)}</Badge>
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
