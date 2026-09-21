import { useState } from "react";
import {
  useQuery,
  listOffices,
  listOrgUsers,
  listWorkflowDefinitions,
  createWorkflowDefinition,
  deleteWorkflowDefinition,
} from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { ErrorBanner } from "../../shared/components/ErrorBanner";

const SCOPE_TYPES = ["utility", "rent", "cam", "amc", "compliance"];

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

// F-10: approval-routing thresholds, configurable per office/amount. A tier
// with no max_amount is the catch-all/top tier for that office+scope.
export function WorkflowAdminPage() {
  const { data: offices, isLoading: officesLoading } = useQuery(listOffices);
  const { data: users, isLoading: usersLoading } = useQuery(listOrgUsers);
  const { data: definitions, isLoading: definitionsLoading, error: definitionsError, refetch } = useQuery(listWorkflowDefinitions);

  const [officeId, setOfficeId] = useState("");
  const [scopeType, setScopeType] = useState(SCOPE_TYPES[0]);
  const [tier, setTier] = useState("1");
  const [maxAmount, setMaxAmount] = useState("");
  const [approverUserId, setApproverUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const officeName = (id: string | null) => offices?.find((o) => o.id === id)?.name ?? "All offices";
  const userEmail = (id: string) => users?.find((u) => u.id === id)?.email ?? id;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createWorkflowDefinition({
        office_id: officeId || undefined,
        scope_type: scopeType as never,
        tier: Number(tier),
        max_amount: maxAmount ? Number(maxAmount) : undefined,
        approver_user_id: approverUserId,
      });
      setTier("1");
      setMaxAmount("");
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create workflow definition.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (officesLoading || usersLoading || definitionsLoading) return null;

  const effectiveApprover = approverUserId || users?.[0]?.id || "";

  return (
    <div className="mx-auto w-full max-w-4xl p-12">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Approval workflow</h1>

      <ErrorBanner error={definitionsError} />

      <form onSubmit={onSubmit} className="card mb-8 flex flex-col gap-4 p-8">
        <h2 className="text-lg font-semibold text-neutral-900">Add threshold tier</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Office</label>
            <select className={inputClass} value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
              <option value="">All offices (org-wide default)</option>
              {(offices ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Scope</label>
            <select className={inputClass} value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
              {SCOPE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tier (ascending order)</label>
            <input type="number" min="1" className={inputClass} value={tier} onChange={(e) => setTier(e.target.value)} />
          </div>
          <div>
            <label className="label">Max amount (blank = uncapped)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={inputClass}
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Approver</label>
            <select className={inputClass} value={effectiveApprover} onChange={(e) => setApproverUserId(e.target.value)}>
              {(users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={isSubmitting || !effectiveApprover} className="self-start">
          Add tier
        </Button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3">Office</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Max amount</th>
              <th className="px-4 py-3">Approver</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(definitions ?? []).map((d) => (
              <tr key={d.id} className="border-t border-neutral-100">
                <td className="px-4 py-3 text-neutral-600">{officeName(d.office_id)}</td>
                <td className="px-4 py-3 text-neutral-600">{d.scope_type}</td>
                <td className="px-4 py-3 text-neutral-600">{d.tier}</td>
                <td className="px-4 py-3 text-neutral-600">{d.max_amount ?? "Uncapped"}</td>
                <td className="px-4 py-3 text-neutral-600">{userEmail(d.approver_user_id)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="text-red-600 underline"
                    onClick={() => deleteWorkflowDefinition({ id: d.id }).then(() => refetch())}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
