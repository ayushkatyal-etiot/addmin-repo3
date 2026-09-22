import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "wasp/client/operations";
import { enrollMfa, confirmMfaEnrollment, getMfaStatus } from "wasp/client/operations";
import { AuthScreen } from "../../shared/components/auth/AuthScreen";
import { AuthCard } from "../../shared/components/auth/AuthCard";
import { OtpBoxes } from "../../shared/components/auth/OtpBoxes";
import { Button } from "../../shared/components/Button";

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

export function MfaSetupPage() {
  const navigate = useNavigate();
  const { data: status, isLoading: statusLoading, refetch: refetchMfaStatus } = useQuery(getMfaStatus);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function startEnrollment() {
    setError(null);
    const result = await enrollMfa();
    setQrCodeDataUrl(result.qrCodeDataUrl);
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await confirmMfaEnrollment({ code });
      await refetchMfaStatus();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (statusLoading) return null;

  if (status?.mfaEnabled) {
    return (
      <AuthScreen>
        <AuthCard icon={<ShieldIcon />} title="MFA is already enabled" subtitle="Two-factor authentication is already set up on your account.">
          <div />
        </AuthCard>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <AuthCard
        icon={<ShieldIcon />}
        title="Set up two-factor authentication"
        subtitle={
          status?.mfaRequired
            ? "Your role requires MFA before you can use AddMin."
            : "Optional, but recommended for your account."
        }
      >
        {!qrCodeDataUrl ? (
          <Button onClick={startEnrollment} className="w-full">
            Generate QR code
          </Button>
        ) : (
          <form onSubmit={submitCode}>
            <img src={qrCodeDataUrl} alt="MFA enrollment QR code" className="mx-auto mb-4 h-48 w-48" />
            <p className="mb-4 text-center text-sm text-neutral-600">
              Scan this with Google Authenticator, Authy, or any TOTP app, then enter the 6-digit code it shows.
            </p>
            <OtpBoxes value={code} onChange={setCode} />
            {error && <p className="mb-3 text-center text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={isSubmitting || code.length !== 6} className="w-full">
              Confirm
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthScreen>
  );
}
