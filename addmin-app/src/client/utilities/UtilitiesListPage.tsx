import { useSearchParams, useNavigate } from "react-router";
import { useQuery, listOffices, listUtilityAccounts } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { Button } from "../../shared/components/Button";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { PageLoading } from "../../shared/components/PageLoading";

const STATUS_CLASS: Record<string, string> = {
  active: "bg-primary-100 text-primary-800",
  inactive: "bg-neutral-100 text-neutral-600",
};

// F-06 (planmysaas-blueprint/05-features.md): utility connections list. Not
// office-nested in the URL (06-frontend.md has this as /app/utilities, not
// /app/offices/:id/utilities), so an office switcher lives on the page
// itself instead of coming from the route.
export function UtilitiesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: offices, isLoading: officesLoading, error: officesError } = useQuery(listOffices);

  const officeId = searchParams.get("officeId") ?? offices?.[0]?.id ?? "";
  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useQuery(
    listUtilityAccounts,
    officeId ? { officeId } : undefined,
    { enabled: !!officeId },
  );

  if (officesLoading) return <PageLoading />;

  if (officesError) {
    return (
      <div className="mx-auto w-full max-w-4xl p-12">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Utility connections</h1>
        <ErrorBanner error={officesError} />
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
        <h1 className="text-2xl font-semibold text-neutral-900">Utility connections</h1>
        <Button onClick={() => navigate(`/app/utilities/new?officeId=${officeId}`)}>Add connection</Button>
      </div>

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

      <ErrorBanner error={accountsError} />

      {accountsLoading && <p className="text-neutral-500">Loading…</p>}

      {!accountsLoading && accounts?.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">
          No utility connections for this office yet.
        </div>
      )}

      {!accountsLoading && accounts && accounts.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Account / meter no.</th>
                <th className="px-4 py-3">Billing cycle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                  onClick={() => navigate(`/app/utilities/${a.id}`)}
                >
                  <td className="px-4 py-3 text-neutral-600">{a.utility_type.replace("_", " ")}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{a.provider_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{a.meter_account_no}</td>
                  <td className="px-4 py-3 text-neutral-600">{a.billing_cycle}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[a.status]}`}>
                      {a.status}
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
