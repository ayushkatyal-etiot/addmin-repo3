import { useState } from "react";
import { useNavigate } from "react-router";
import { verifyMfaLogin } from "wasp/client/operations";
import { AuthLayout } from "../AuthLayout";
import { Button } from "../../shared/components/Button";

// Reached after a password login when authz.ts's requireMfaIfEnabled has
// blocked every operation for this session -- see mfa.ts's file comment on
// why Wasp's login itself can't withhold the session pending this step.
export function MfaVerifyPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyMfaLogin({ code });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="mb-4 text-2xl font-semibold text-neutral-900">
        Enter your authentication code
      </h1>
      <form onSubmit={submitCode}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2"
          placeholder="000000"
          autoFocus
        />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          Verify
        </Button>
      </form>
    </AuthLayout>
  );
}
