import { useNavigate } from "react-router";
import {
  useQuery,
  getOfficeChecklist,
  updateChecklistItem,
  listOrgUsers,
} from "wasp/client/operations";
import { CHECKLIST_CATEGORY_ORDER, CHECKLIST_CATEGORY_TITLES } from "../../server/onboarding/checklistTemplates";
import { SetupReview } from "./SetupReview";
import { Button } from "../../shared/components/Button";
import { useSelectedOffice } from "../../shared/SelectedOfficeContext";

export const CHECKLIST_WIZARD_STEPS = [...CHECKLIST_CATEGORY_ORDER, "review"] as const;
export type ChecklistWizardStep = (typeof CHECKLIST_WIZARD_STEPS)[number];

export function isChecklistWizardStep(value: string | null): value is ChecklistWizardStep {
  return value != null && (CHECKLIST_WIZARD_STEPS as readonly string[]).includes(value);
}

type OfficeChecklistWizardProps = {
  officeId: string;
  currentStep: ChecklistWizardStep;
  onStepChange: (step: ChecklistWizardStep) => void;
  onBackToOverview?: () => void;
  overviewBackLabel?: string;
};

export function OfficeChecklistWizard({
  officeId,
  currentStep,
  onStepChange,
  onBackToOverview,
  overviewBackLabel = "Back to setup overview",
}: OfficeChecklistWizardProps) {
  const { data, isLoading, refetch } = useQuery(getOfficeChecklist, { officeId });
  const { data: orgUsers } = useQuery(listOrgUsers);
  const navigate = useNavigate();
  const { setOfficeId } = useSelectedOffice();

  if (isLoading || !data) {
    return <div className="auth-panel h-48 animate-pulse" />;
  }

  const stepIndex = CHECKLIST_WIZARD_STEPS.indexOf(currentStep);

  // F-04's edge case: switching a "Yes" item away after a real record
  // (linked_entity_id) is already attached must warn before discarding it,
  // never cascade-delete silently. Previously nothing set/read that link,
  // so this could never fire -- now getOfficeChecklist returns it.
  async function onToggle(
    itemId: string,
    applicability: "yes" | "no" | "not_applicable",
    hasLinkedEntity: boolean,
  ) {
    if (applicability !== "yes" && hasLinkedEntity) {
      const confirmed = window.confirm(
        "This item already has a real record linked to it (e.g. a utility account or compliance document). " +
          "Changing it here won't delete that record, but this checklist will stop tracking it as linked. Continue?",
      );
      if (!confirmed) return;
      await updateChecklistItem({ officeId, itemId, applicability, linkedEntityType: null, linkedEntityId: null });
    } else {
      await updateChecklistItem({ officeId, itemId, applicability });
    }
    await refetch();
  }

  async function onAssignOwner(itemId: string, ownerUserId: string) {
    await updateChecklistItem({ officeId, itemId, applicability: "yes", ownerUserId });
    await refetch();
  }

  function onConfigure(moduleUrl: string) {
    setOfficeId(officeId);
    navigate(moduleUrl);
  }

  return (
    <div className="flex flex-col gap-5">
      {onBackToOverview && (
        <Button type="button" variant="ghost" className="self-start" onClick={onBackToOverview}>
          ← {overviewBackLabel}
        </Button>
      )}

      <div className="relative z-10 flex flex-wrap gap-2">
        {CHECKLIST_WIZARD_STEPS.map((step, idx) => (
          <button
            key={step}
            type="button"
            onClick={() => onStepChange(step)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              step === currentStep
                ? "bg-primary-500 text-white"
                : "bg-white/75 text-neutral-600 hover:bg-white"
            }`}
          >
            {idx + 1}. {step === "review" ? "Review" : CHECKLIST_CATEGORY_TITLES[step]}
          </button>
        ))}
      </div>

      {currentStep === "review" ? (
        <SetupReview
          officeId={officeId}
          allowEditAfterActive
          onJumpToCategory={(category) => onStepChange(category as ChecklistWizardStep)}
        />
      ) : (
        <div className="auth-panel flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            {CHECKLIST_CATEGORY_TITLES[currentStep]} checklist
          </h2>
          <ul className="flex flex-col">
            {data.items
              .filter((item) => item.category === currentStep)
              .map((item, idx, arr) => (
                <li
                  key={item.id}
                  className={`flex flex-col gap-2 py-3 ${idx < arr.length - 1 ? "border-b border-neutral-100" : ""}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-neutral-900">{item.label}</span>
                    <div className="flex gap-1">
                      <ToggleButton
                        active={item.applicability === "yes"}
                        onClick={() => onToggle(item.id, "yes", !!item.linked_entity_id)}
                      >
                        {item.yesLabel}
                      </ToggleButton>
                      <ToggleButton
                        active={item.applicability === "no" && item.reviewed}
                        onClick={() => onToggle(item.id, "no", !!item.linked_entity_id)}
                      >
                        {item.noLabel}
                      </ToggleButton>
                      <ToggleButton
                        active={item.applicability === "not_applicable"}
                        onClick={() => onToggle(item.id, "not_applicable", !!item.linked_entity_id)}
                      >
                        N/A
                      </ToggleButton>
                    </div>
                  </div>
                  {item.applicability === "yes" && item.status === "pending" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-2 text-xs text-amber-600">
                        <AlertCircleIcon /> Open action — not yet configured.
                      </span>
                      {orgUsers && orgUsers.length > 0 && (
                        <select
                          className="select-field"
                          defaultValue=""
                          onChange={(e) => e.target.value && onAssignOwner(item.id, e.target.value)}
                        >
                          <option value="" disabled>
                            Assign owner…
                          </option>
                          {orgUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.email} ({u.role})
                            </option>
                          ))}
                        </select>
                      )}
                      {item.moduleUrl && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs"
                          onClick={() => onConfigure(item.moduleUrl!)}
                        >
                          Configure →
                        </Button>
                      )}
                    </div>
                  )}
                  {item.applicability === "yes" && item.status !== "pending" && (
                    <span className="flex items-center gap-2 text-xs text-primary-700">
                      <CheckIcon /> {item.linked_entity_id ? "Configured — linked to a real record" : "Configured"}
                    </span>
                  )}
                </li>
              ))}
          </ul>

          <div className="mt-2 flex justify-between">
            <Button
              variant="ghost"
              disabled={stepIndex === 0}
              onClick={() => onStepChange(CHECKLIST_WIZARD_STEPS[Math.max(0, stepIndex - 1)])}
            >
              Back
            </Button>
            <Button onClick={() => onStepChange(CHECKLIST_WIZARD_STEPS[Math.min(CHECKLIST_WIZARD_STEPS.length - 1, stepIndex + 1)])}>
              {stepIndex === CHECKLIST_WIZARD_STEPS.length - 2 ? "Go to Review" : "Next"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-semibold ${
        active ? "bg-primary-500 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

function AlertCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
