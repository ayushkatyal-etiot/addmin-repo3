import { useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { OfficeDetailsForm } from "./OfficeDetailsForm";
import { AuthScreen } from "../../shared/components/auth/AuthScreen";
import { WizardHeader } from "../../shared/components/auth/WizardHeader";
import { Button } from "../../shared/components/Button";
import { useSelectedOffice } from "../../shared/SelectedOfficeContext";

// /app/offices/[officeId]/setup — edit office details.
//
// The guided onboarding checklist that used to live here (categories,
// applicability answers, activation gate) is hidden per
// planmysaas-blueprint/11-without-setup-decision.md ("Option A") -- offices
// are active on creation, so this screen is just office-detail editing now.
export function OfficeSetupPage() {
  const { officeId } = useParams<{ officeId: string }>();
  const navigate = useNavigate();
  const { setOfficeId } = useSelectedOffice();

  useEffect(() => {
    if (officeId) setOfficeId(officeId);
  }, [officeId, setOfficeId]);

  if (!officeId) return null;

  return (
    <AuthScreen center={false}>
      <div className="mx-auto w-full max-w-180">
        <Button type="button" variant="ghost" className="relative z-10 mb-2" onClick={() => navigate("/app/offices")}>
          ← All offices
        </Button>
        <WizardHeader
          icon={<CheckCircleIcon />}
          title="Office details"
          subtitle="Edit this office's name, address, type, and ownership any time."
        />

        <OfficeDetailsForm officeId={officeId} />
      </div>
    </AuthScreen>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.801 10A10 10 0 1 1 17 3.335" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}
