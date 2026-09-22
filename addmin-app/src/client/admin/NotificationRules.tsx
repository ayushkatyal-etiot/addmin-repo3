import { useEffect, useState } from "react";
import {
  useQuery,
  listNotificationLogs,
  listNotificationRules,
  upsertNotificationRule,
} from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { sentenceCase } from "../../shared/text";

// Build Step 11: admin UI for reminder windows + delivery log (NotificationLog).
export function NotificationRules() {
  const { data, isLoading, error, refetch } = useQuery(listNotificationRules);
  const {
    data: deliveryLog,
    isLoading: logLoading,
    error: logError,
    refetch: refetchLog,
  } = useQuery(listNotificationLogs);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingType, setSavingType] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDrafts(Object.fromEntries(data.map((r) => [r.ruleType, r.reminderDays.join(", ")])));
  }, [data]);

  async function onSave(ruleType: string) {
    setRowError(null);
    const reminderDays = (drafts[ruleType] ?? "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (reminderDays.length === 0) {
      setRowError("Enter at least one positive whole number of days.");
      return;
    }
    setSavingType(ruleType);
    try {
      await upsertNotificationRule({ ruleType, reminderDays });
      await refetch();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingType(null);
    }
  }

  if (isLoading) return null;

  return (
    <div className="mx-auto w-full max-w-4xl p-12">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Notifications</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Configure reminder windows and review emails recorded in the delivery log (seeded and job-generated).
      </p>
      <ErrorBanner error={error ?? logError} />
      {rowError && <p className="mb-3 text-sm text-red-600">{rowError}</p>}

      <h2 className="mb-2 text-sm font-semibold text-neutral-800">Reminder rules</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Days before renewal/expiry that reminders go out. Comma-separated, e.g. &quot;180, 90, 60, 30&quot;.
      </p>
      <div className="card mb-10 flex flex-col divide-y divide-neutral-100">
        {(data ?? []).map((rule) => (
          <div key={rule.ruleType} className="flex items-center gap-4 p-5">
            <div className="w-56 shrink-0 text-sm font-medium text-neutral-900">{sentenceCase(rule.ruleType)}</div>
            <input
              className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
              value={drafts[rule.ruleType] ?? ""}
              onChange={(e) => setDrafts({ ...drafts, [rule.ruleType]: e.target.value })}
            />
            <Button type="button" disabled={savingType === rule.ruleType} onClick={() => onSave(rule.ruleType)}>
              Save
            </Button>
          </div>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-800">Delivery log</h2>
        <Button type="button" variant="ghost" className="text-xs" onClick={() => void refetchLog()}>
          Refresh
        </Button>
      </div>
      <p className="mb-3 text-xs text-neutral-500">
        Rows in <code className="text-[11px]">NotificationLog</code> — run{" "}
        <code className="text-[11px]">wasp db seed seedDevData</code> to populate demo reminders (includes{" "}
        <code className="text-[11px]">trial_reminder_3d</code> to <code className="text-[11px]">abc@test.com</code>).
      </p>

      {logLoading && <p className="text-sm text-neutral-500">Loading delivery log…</p>}

      {!logLoading && (deliveryLog?.length ?? 0) === 0 && (
        <div className="card p-6 text-center text-sm text-neutral-500">No notifications recorded for this organization yet.</div>
      )}

      {!logLoading && deliveryLog && deliveryLog.length > 0 && (
        <div className="card overflow-hidden">
          <table className="table-shell">
            <thead>
              <tr>
                <th className="table-head-cell">Sent</th>
                <th className="table-head-cell">Type</th>
                <th className="table-head-cell">Recipient</th>
              </tr>
            </thead>
            <tbody>
              {deliveryLog.map((row) => (
                <tr key={row.id} className="table-row-hover">
                  <td className="table-cell whitespace-nowrap text-xs text-neutral-600">
                    {new Date(row.sent_at).toLocaleString()}
                  </td>
                  <td className="table-cell font-mono text-xs text-neutral-800">{row.notification_type}</td>
                  <td className="table-cell text-sm text-neutral-700">{row.recipient_email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
