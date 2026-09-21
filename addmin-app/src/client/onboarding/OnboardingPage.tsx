import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  useQuery,
  listOffices,
  getOfficeChecklist,
  updateChecklistItem,
  listOrgUsers,
} from "wasp/client/operations";
import { CHECKLIST_CATEGORY_ORDER, CHECKLIST_CATEGORY_TITLES } from "../../server/onboarding/checklistTemplates";
import { SetupReview } from "./SetupReview";
import { Button } from "../../shared/components/Button";

const STEPS = [...CHECKLIST_CATEGORY_ORDER, "review"] as const;
type Step = (typeof STEPS)[number];

// /app/onboarding (06-frontend.md) -- F-04's Guided Office Onboarding wizard.
// officeId/category are carried as query params rather than path segments
// (matching 06-frontend.md's plain "/app/onboarding" route with no
// [officeId] in the path) -- see src/client/offices/NewOfficePage.tsx, which
// is what deep-links here after creating an office.
//
// Resume-where-you-left-off (F-04's edge case) is derived purely from
// server state (getOfficeChecklist's `resumeCategory`), not from any
// client-side step counter -- see src/server/onboarding/checklist.ts.
export function OnboardingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const officeId = searchParams.get("officeId");

  const { data: offices, isLoading: officesLoading } = useQuery(listOffices, undefined, {
    enabled: !officeId,
  });

  useEffect(() => {
    if (officeId || officesLoading) return;
    const target = offices?.find((o) => o.setup_status !== "active");
    if (target) {
      setSearchParams({ officeId: target.id }, { replace: true });
    } else {
      navigate("/app/offices/new", { replace: true });
    }
  }, [officeId, officesLoading, offices, navigate, setSearchParams]);

  if (!officeId) {
    return <div className="p-12 text-neutral-500">Loading…</div>;
  }

  return <Wizard officeId={officeId} />;
}

function Wizard({ officeId }: { officeId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, refetch } = useQuery(getOfficeChecklist, { officeId });
  const { data: orgUsers } = useQuery(listOrgUsers);

  const categoryParam = searchParams.get("category") as Step | null;
  const currentStep: Step = categoryParam && STEPS.includes(categoryParam) ? categoryParam : data?.resumeCategory as Step ?? "utility";

  // Ensure current step is always in URL so completion doesn't auto-jump
  useEffect(() => {
    if (!categoryParam && !isLoading && data?.resumeCategory) {
      setSearchParams({ officeId, category: currentStep });
    }
  }, [officeId, categoryParam, isLoading, data?.resumeCategory, currentStep, setSearchParams]);

  function goToStep(step: Step) {
    setSearchParams({ officeId, category: step });
  }

  if (isLoading || !data) {
    return <div className="p-12 text-neutral-500">Loading checklist…</div>;
  }

  const stepIndex = STEPS.indexOf(currentStep);

  async function onToggle(itemId: string, applicability: "yes" | "no" | "not_applicable") {
    await updateChecklistItem({ officeId, itemId, applicability });
    await refetch();
  }

  async function onAssignOwner(itemId: string, ownerUserId: string) {
    await updateChecklistItem({ officeId, itemId, applicability: "yes", ownerUserId });
    await refetch();
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-12">
      <h1 className="mb-2 text-2xl font-semibold text-neutral-900">
        Onboarding — {data.officeName}
      </h1>
      <p className="mb-6 text-sm text-neutral-500">Setup Completion: {data.completionPct}%</p>

      {/* Stepper */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((step, idx) => (
          <button
            key={step}
            type="button"
            onClick={() => goToStep(step)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              step === currentStep
                ? "bg-primary-500 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {idx + 1}. {step === "review" ? "Review" : CHECKLIST_CATEGORY_TITLES[step]}
          </button>
        ))}
      </div>

      {currentStep === "review" ? (
        <SetupReview
          officeId={officeId}
          onJumpToCategory={(category) => goToStep(category as Step)}
        />
      ) : (
        <div className="card flex flex-col gap-4 p-8">
          <h2 className="text-lg font-semibold text-neutral-900">
            {CHECKLIST_CATEGORY_TITLES[currentStep]} checklist
          </h2>
          <ul className="flex flex-col divide-y divide-neutral-100">
            {data.items
              .filter((item) => item.category === currentStep)
              .map((item) => (
                <li key={item.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-neutral-800">{item.label}</span>
                    <div className="flex gap-1">
                      <ToggleButton
                        active={item.applicability === "yes"}
                        onClick={() => onToggle(item.id, "yes")}
                      >
                        {item.yesLabel}
                      </ToggleButton>
                      <ToggleButton
                        active={item.applicability === "no" && item.reviewed}
                        onClick={() => onToggle(item.id, "no")}
                      >
                        {item.noLabel}
                      </ToggleButton>
                      <ToggleButton
                        active={item.applicability === "not_applicable"}
                        onClick={() => onToggle(item.id, "not_applicable")}
                      >
                        N/A
                      </ToggleButton>
                    </div>
                  </div>
                  {item.applicability === "yes" && item.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-600">Open action -- not yet configured.</span>
                      {orgUsers && orgUsers.length > 0 && (
                        <select
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
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
                    </div>
                  )}
                  {item.applicability === "yes" && item.status !== "pending" && (
                    <span className="text-xs text-primary-700">✔ Configured</span>
                  )}
                </li>
              ))}
          </ul>

          <div className="mt-4 flex justify-between">
            <Button
              variant="ghost"
              disabled={stepIndex === 0}
              onClick={() => goToStep(STEPS[Math.max(0, stepIndex - 1)])}
            >
              Back
            </Button>
            <Button onClick={() => goToStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)])}>
              {stepIndex === STEPS.length - 2 ? "Go to Review" : "Next"}
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
