import { useSearchParams, useNavigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import { useQuery, listOffices, listLeases } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { Button } from "../../shared/components/Button";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { PageLoading } from "../../shared/components/PageLoading";

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  active: "bg-primary-100 text-primary-800",
  expiring: "bg-amber-100 text-amber-800",
  renewed: "bg-blue-100 text-blue-800",
  terminated: "bg-red-100 text-red-800",
};

// F-12: leases list, same office-switcher-on-page pattern as
// UtilitiesListPage.tsx (/app/property/leases isn't office-nested in the URL).
export function LeaseListPage() {
  const { data: user } = useAuth();
  const canAddLease = user?.role === "platform_admin" || user?.role === "office_admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: offices, isLoading: officesLoading, error: officesError } = useQuery(listOffices);

  const officeId = searchParams.get("officeId") ?? offices?.[0]?.id ?? "";
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

  if (!offices || offices.length === 0) {
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
          <Button onClick={() => navigate(`/app/property/leases/new?officeId=${officeId}`)}>Add lease</Button>
        )}
      </div>
      {user?.role === "payment_authorizer" && (
        <p className="mb-4 text-sm text-neutral-500">Open a lease to record rent or CAM payments.</p>
      )}

      <div className="mb-4">
        <select
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          value={officeId}
          onChange={(e) => setSearchParams({ officeId: e.target.value })}
        >
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <ErrorBanner error={leasesError} />

      {leasesLoading && <p className="text-neutral-500">Loading…</p>}

      {!leasesLoading && leases?.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">No leases for this office yet.</div>
      )}

      {!leasesLoading && leases && leases.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3">Landlord</th>
                <th className="px-4 py-3">Rent</th>
                <th className="px-4 py-3">CAM</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {leases.map((l) => (
                <tr
                  key={l.id}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                  onClick={() => navigate(`/app/property/leases/${l.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-neutral-900">{l.landlord_name}</td>
                  <td className="px-4 py-3 text-neutral-600">{l.rent_amount}</td>
                  <td className="px-4 py-3 text-neutral-600">{l.cam_amount ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">{new Date(l.start_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-neutral-600">{new Date(l.end_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[l.status]}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-primary-600 underline">View</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
