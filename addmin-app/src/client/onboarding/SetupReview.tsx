import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, getOfficeChecklist, activateOffice } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { CHECKLIST_CATEGORY_ORDER, CHECKLIST_CATEGORY_TITLES } from "../../server/onboarding/checklistTemplates";

// F-05 (planmysaas-blueprint/05-features.md): Office Setup Completion % &
// Review. Shared between the onboarding wizard's Review step and the
// standalone /app/offices/[officeId]/setup page -- one implementation of the
// activation gate's UI, per Build Step 04's "don't duplicate" pattern.
export function SetupReview({
  officeId,
  onActivated,
  onJumpToCategory,
  allowEditAfterActive,
}: {
  officeId: string;
  onActivated?: () => void;
  onJumpToCategory?: (category: string) => void;
  /** When true, active offices still show checklist edit actions (office setup page). */
  allowEditAfterActive?: boolean;
}) {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useQuery(getOfficeChecklist, { officeId });
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [missingItems, setMissingItems] = useState<string[] | null>(null);

  async function onActivate() {
    setActivating(true);
    setActivationError(null);
    setMissingItems(null);
    try {
      const result = await activateOffice({ officeId });
      if (!result.success) {
        setMissingItems(result.missingItems);
      } else {
        await refetch();
        onActivated?.();
        navigate("/app/subscribe");
      }
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : "Could not activate office.");
    } finally {
      setActivating(false);
    }
  }

  if (isLoading || !data) {
    return <div className="auth-panel h-48 animate-pulse" />;
  }

  const alreadyActive = data.setupStatus === "active";
  const unreviewedCount = data.items.filter((i) => !i.reviewed).length;

  return (
    <div className="auth-panel flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(#0b814d ${data.completionPct}%, #dfe3e5 0)` }}
        >
          <div className="flex h-18.5 w-18.5 items-center justify-center rounded-full bg-white text-xl font-bold text-primary-700">
            {data.completionPct}%
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{data.officeName}</h2>
          <p className="text-sm text-neutral-500">
            {alreadyActive
              ? allowEditAfterActive
                ? "Active — you can still update checklist answers below."
                : "This office is active."
              : "Setup completion"}
          </p>
          {unreviewedCount > 0 && !alreadyActive && (
            <p className="mt-1 flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangleIcon /> {unreviewedCount} item(s) not yet reviewed.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">Setup checklist by category</h3>
        {onJumpToCategory && (
          <Button type="button" variant="secondary" className="text-xs" onClick={() => onJumpToCategory("utility")}>
            Edit checklist
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CHECKLIST_CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            type="button"
            disabled={!onJumpToCategory}
            onClick={() => onJumpToCategory?.(category)}
            className="flex flex-col gap-1 rounded-md border border-neutral-100 bg-white p-4 text-left transition-colors hover:border-primary-200 hover:bg-neutral-50 disabled:cursor-default disabled:opacity-60"
          >
            <span className="text-sm font-medium text-neutral-600">{CHECKLIST_CATEGORY_TITLES[category]}</span>
            <span className="text-lg font-bold text-primary-700">{data.completionByCategory[category]}%</span>
            {onJumpToCategory && (
              <span className="mt-1 text-xs font-medium text-primary-600">Edit checklist →</span>
            )}
          </button>
        ))}
      </div>

      {missingItems && missingItems.length > 0 && (
        <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
          <p className="mb-2 font-semibold">Activation blocked -- the following items still need a status or an owner:</p>
          <ul className="list-inside list-disc">
            {missingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {activationError && <p className="text-sm text-red-600">{activationError}</p>}

      {alreadyActive ? (
        allowEditAfterActive ? (
          <p className="text-sm font-medium text-primary-700">✔ Office is active</p>
        ) : (
          <p className="text-sm font-medium text-primary-700">✔ Activated</p>
        )
      ) : (
        <Button onClick={onActivate} disabled={activating} className="w-full">
          {activating ? "Activating…" : "Activate office"}
        </Button>
      )}
    </div>
  );
}

function AlertTriangleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
