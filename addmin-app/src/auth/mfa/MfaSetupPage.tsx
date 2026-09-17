import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "wasp/client/operations";
import { enrollMfa, confirmMfaEnrollment, getMfaStatus } from "wasp/client/operations";
import { AuthLayout } from "../AuthLayout";
import { Button } from "../../shared/components/Button";

export function MfaSetupPage() {
  const navigate = useNavigate();
  const { data: status, isLoading: statusLoading } = useQuery(getMfaStatus);
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
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (statusLoading) return null;

  if (status?.mfaEnabled) {
    return (
      <AuthLayout>
        <h1 className="mb-4 text-2xl font-semibold text-neutral-900">
          MFA is already enabled
        </h1>
        <p className="text-sm text-neutral-600">
          Two-factor authentication is already set up on your account.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="mb-2 text-2xl font-semibold text-neutral-900">
        Set up two-factor authentication
      </h1>
      <p className="mb-4 text-sm text-neutral-600">
        {status?.mfaRequired
          ? "Your role requires MFA before you can use AddMin."
          : "Optional, but recommended for your account."}
      </p>

      {!qrCodeDataUrl ? (
        <Button onClick={startEnrollment}>Generate QR code</Button>
      ) : (
        <form onSubmit={submitCode}>
          <img
            src={qrCodeDataUrl}
            alt="MFA enrollment QR code"
            className="mb-4 h-48 w-48"
          />
          <p className="mb-2 text-sm text-neutral-600">
            Scan this with Google Authenticator, Authy, or any TOTP app, then
            enter the 6-digit code it shows.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2"
            placeholder="000000"
          />
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>
            Confirm
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
