import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, verifyMfaLogin, getMfaStatus } from "wasp/client/operations";
import { AuthScreen } from "../../shared/components/auth/AuthScreen";
import { AuthCard } from "../../shared/components/auth/AuthCard";
import { OtpBoxes } from "../../shared/components/auth/OtpBoxes";
import { Button } from "../../shared/components/Button";

// Reached after a password login when authz.ts's requireMfaIfEnabled has
// blocked every operation for this session -- see mfa.ts's file comment on
// why Wasp's login itself can't withhold the session pending this step.
export function MfaVerifyPage() {
  const navigate = useNavigate();
  const { refetch: refetchMfaStatus } = useQuery(getMfaStatus);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyMfaLogin({ code });
      const { data: status } = await refetchMfaStatus();
      if (!status?.mfaVerifiedThisWindow) {
        setError("Code accepted but session did not refresh. Reload the page and try again.");
        return;
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen>
      <AuthCard
        icon={<ShieldIcon />}
        title="Enter your authentication code"
        subtitle="Your account requires two-factor authentication. Enter the 6-digit code from your authenticator app."
      >
        <form onSubmit={submitCode}>
          <OtpBoxes value={code} onChange={setCode} />
          {error && <p className="mb-3 text-center text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={isSubmitting || code.length !== 6} className="w-full">
            Verify
          </Button>
        </form>
      </AuthCard>
    </AuthScreen>
  );
}

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
