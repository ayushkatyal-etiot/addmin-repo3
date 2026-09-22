import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery, getOfficeChecklist } from "wasp/client/operations";
import {
  ChecklistWizardStep,
  isChecklistWizardStep,
  OfficeChecklistWizard,
} from "./OfficeChecklistWizard";
import { AuthScreen } from "../../shared/components/auth/AuthScreen";
import { WizardHeader } from "../../shared/components/auth/WizardHeader";
import { useSelectedOffice } from "../../shared/SelectedOfficeContext";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { officeId, isLoading: officesLoading, hasOffices } = useSelectedOffice();

  useEffect(() => {
    if (officesLoading) return;
    if (!hasOffices) {
      navigate("/app/offices/new", { replace: true });
    }
  }, [officesLoading, hasOffices, navigate]);

  if (officesLoading || (hasOffices && !officeId)) {
    return (
      <AuthScreen center={false}>
        <p className="relative z-10 text-neutral-500">Loading…</p>
      </AuthScreen>
    );
  }

  return <OnboardingWizard officeId={officeId} />;
}

function OnboardingWizard({ officeId }: { officeId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading } = useQuery(getOfficeChecklist, { officeId });

  const categoryParam = searchParams.get("category");
  const currentStep: ChecklistWizardStep =
    categoryParam && isChecklistWizardStep(categoryParam)
      ? categoryParam
      : ((data?.resumeCategory as ChecklistWizardStep) ?? "utility");

  useEffect(() => {
    if (!categoryParam && !isLoading && data?.resumeCategory) {
      setSearchParams({ category: currentStep }, { replace: true });
    }
  }, [officeId, categoryParam, isLoading, data?.resumeCategory, currentStep, setSearchParams]);

  function goToStep(step: ChecklistWizardStep) {
    setSearchParams({ category: step });
  }

  if (isLoading || !data) {
    return (
      <AuthScreen center={false}>
        <p className="relative z-10 text-neutral-500">Loading checklist…</p>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen center={false}>
      <div className="mx-auto w-full max-w-200">
        <WizardHeader
          icon={<ChecklistIcon />}
          title={`Onboarding — ${data.officeName}`}
          subtitle={`Setup completion: ${data.completionPct}% · switch office in the top bar`}
        />

        <OfficeChecklistWizard officeId={officeId} currentStep={currentStep} onStepChange={goToStep} />
      </div>
    </AuthScreen>
  );
}

function ChecklistIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </svg>
  );
}
