import { useParams, useNavigate } from "react-router";
import { SetupReview } from "../onboarding/SetupReview";

// /app/offices/[officeId]/setup (06-frontend.md) -- F-05's standalone setup
// review page, reachable any time after office creation, not just during the
// wizard's Review step.
export function OfficeSetupPage() {
  const { officeId } = useParams<{ officeId: string }>();
  const navigate = useNavigate();

  if (!officeId) return null;

  return (
    <div className="mx-auto w-full max-w-2xl p-12">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Office setup</h1>
      <SetupReview
        officeId={officeId}
        onJumpToCategory={(category) =>
          navigate(`/app/onboarding?officeId=${officeId}&category=${category}`)
        }
      />
    </div>
  );
}
