import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, getUtilityAccount, deactivateUtilityAccount, waiveMissingItem } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { Badge, type BadgeTone } from "../../shared/components/Badge";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { sentenceCase } from "../../shared/text";

const INSTANCE_STATUS_TONE: Record<string, BadgeTone> = {
  expected: "neutral",
  received: "success",
  missing: "danger",
  in_process: "warning",
  closed: "neutral",
  cancelled: "neutral",
  waived: "neutral",
};

// F-06/F-07/F-08: connection detail + obligation instance history. Bill
// entry/approval itself is Build Step 07 -- this step only proves the
// engine (schedule -> instance -> missing -> waive), so instances show as a
// read-only timeline with a Waive action for anything Missing.
export function UtilityAccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { data: account, isLoading, error: loadError, refetch } = useQuery(getUtilityAccount, { accountId: accountId! });
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onWaive(instanceId: string) {
    if (!remark.trim()) {
      setError("A remark is required to waive this item.");
      return;
    }
    setError(null);
    try {
      await waiveMissingItem({ instanceId, remark });
      setWaivingId(null);
      setRemark("");
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not waive item.");
    }
  }

  async function onDeactivate() {
    if (!accountId) return;
    if (!confirm("Deactivate this connection? Historical records are kept; no new bills will be expected.")) return;
    await deactivateUtilityAccount({ accountId });
    await refetch();
  }

  if (isLoading) return null;
  if (!account) {
    return (
      <div className="p-6">
        <ErrorBanner error={loadError} />
        {!loadError && "Not found."}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{account.provider_name}</h1>
          <p className="text-sm text-neutral-500">
            {account.utility_type.replace("_", " ")} · {account.meter_account_no} · {account.billing_cycle}
          </p>
        </div>
        {account.status === "active" && (
          <Button variant="ghost" onClick={onDeactivate}>
            Deactivate
          </Button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <h2 className="mb-3 text-sm font-semibold text-neutral-700">Obligation history</h2>

      {account.instances.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">
          No obligation instances yet -- the nightly job generates the first one as it enters the connection's
          notice window.
        </div>
      )}

      {account.instances.length > 0 && (
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">Period</th>
                <th className="table-head-cell">Expected date</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell" />
              </tr>
            </thead>
            <tbody>
              {account.instances.map((i) => (
                <tr key={i.id} className="table-row-hover">
                  <td className="table-cell font-medium text-neutral-900">{i.period}</td>
                  <td className="table-cell text-neutral-600">
                    {new Date(i.expected_date).toLocaleDateString()}
                  </td>
                  <td className="table-cell">
                    <Badge tone={INSTANCE_STATUS_TONE[i.status] ?? "neutral"}>{sentenceCase(i.status)}</Badge>
                  </td>
                  <td className="table-cell text-right">
                    {i.status === "missing" && waivingId !== i.id && (
                      <button
                        className="font-semibold text-primary-600 underline"
                        onClick={() => setWaivingId(i.id)}
                      >
                        Waive
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      )}

      {waivingId && (
        <div className="card mt-4 p-4">
          <label className="label">Remark (required)</label>
          <textarea
            className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={() => onWaive(waivingId)}>Confirm waive</Button>
            <Button variant="ghost" onClick={() => { setWaivingId(null); setRemark(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
