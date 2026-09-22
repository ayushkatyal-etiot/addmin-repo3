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
import { useSelectedOffice } from "../../shared/SelectedOfficeContext";
import { sentenceCase } from "../../shared/text";

const SCOPE_TYPES = ["utility", "rent", "cam", "amc", "compliance"];

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

// F-10: approval-routing thresholds, configurable per office/amount. A tier
// with no max_amount is the catch-all/top tier for that office+scope.
export function WorkflowAdminPage() {
  const { data: offices, isLoading: officesLoading } = useQuery(listOffices);
  const { officeId: selectedOfficeId, selectedOffice } = useSelectedOffice();
  const { data: users, isLoading: usersLoading } = useQuery(listOrgUsers);
  const { data: definitions, isLoading: definitionsLoading, error: definitionsError, refetch } = useQuery(listWorkflowDefinitions);

  const [orgWideTier, setOrgWideTier] = useState(false);
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
        office_id: orgWideTier ? undefined : selectedOfficeId || undefined,
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
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={orgWideTier}
                onChange={(e) => setOrgWideTier(e.target.checked)}
              />
              Org-wide default (all offices)
            </label>
            {!orgWideTier && (
              <p className="mt-1 text-xs text-neutral-500">
                Otherwise applies to the office selected in the top bar
                {selectedOffice ? `: ${selectedOffice.name}` : "."}
              </p>
            )}
          </div>
          <div>
            <label className="label">Scope</label>
            <select className="select-field" value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
              {SCOPE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {sentenceCase(s)}
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
            <select className="select-field" value={effectiveApprover} onChange={(e) => setApproverUserId(e.target.value)}>
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

        <table className="table-shell">
          <thead>
            <tr>
              <th className="table-head-cell">Office</th>
              <th className="table-head-cell">Scope</th>
              <th className="table-head-cell">Tier</th>
              <th className="table-head-cell">Max amount</th>
              <th className="table-head-cell">Approver</th>
              <th className="table-head-cell" />
            </tr>
          </thead>
          <tbody>
            {(definitions ?? []).map((d) => (
              <tr key={d.id} className="table-row-hover">
                <td className="table-cell text-neutral-600">{officeName(d.office_id)}</td>
                <td className="table-cell text-neutral-600">{d.scope_type}</td>
                <td className="table-cell text-neutral-600">{d.tier}</td>
                <td className="table-cell text-neutral-600">{d.max_amount ?? "Uncapped"}</td>
                <td className="table-cell text-neutral-600">{userEmail(d.approver_user_id)}</td>
                <td className="table-cell text-right">
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
  );
}
