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
}: {
  officeId: string;
  onActivated?: () => void;
  onJumpToCategory?: (category: string) => void;
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
    return <div className="card h-48 animate-pulse p-8" />;
  }

  const alreadyActive = data.setupStatus === "active";
  const unreviewedCount = data.items.filter((i) => !i.reviewed).length;

  return (
    <div className="card flex flex-col gap-6 p-8">
      <div className="flex items-center gap-6">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-8 border-primary-500 text-xl font-bold text-primary-700"
          style={{ borderColor: `oklch(0.532 0.125 156.421 / ${Math.max(data.completionPct, 10)}%)` }}
        >
          {data.completionPct}%
        </div>
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{data.officeName}</h2>
          <p className="text-sm text-neutral-500">
            {alreadyActive ? "This office is active." : "Setup Completion"}
          </p>
          {unreviewedCount > 0 && !alreadyActive && (
            <p className="text-sm text-amber-600">{unreviewedCount} item(s) not yet reviewed.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CHECKLIST_CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onJumpToCategory?.(category)}
            className="flex flex-col rounded-md border border-neutral-200 p-3 text-left hover:bg-neutral-50"
          >
            <span className="text-sm font-medium text-neutral-800">{CHECKLIST_CATEGORY_TITLES[category]}</span>
            <span className="text-lg font-semibold text-primary-700">{data.completionByCategory[category]}%</span>
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
        <p className="text-sm font-medium text-primary-700">✔ Activated</p>
      ) : (
        <Button onClick={onActivate} disabled={activating}>
          {activating ? "Activating…" : "Activate Office"}
        </Button>
      )}
    </div>
  );
}
