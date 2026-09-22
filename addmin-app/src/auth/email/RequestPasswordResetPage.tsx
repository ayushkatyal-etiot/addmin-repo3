import { useState } from "react";
import { Link } from "react-router";
import { requestPasswordReset } from "wasp/client/auth";
import { AuthScreen } from "../../shared/components/auth/AuthScreen";
import { AuthCard } from "../../shared/components/auth/AuthCard";
import { IconField, MailIcon } from "../../shared/components/auth/IconField";
import { Button } from "../../shared/components/Button";

export function RequestPasswordResetPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestPasswordReset({ email });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen>
      <AuthCard
        icon={<KeyIcon />}
        title="Reset your password"
        subtitle="Enter your work email and we'll send you a link to reset your password."
        footer={
          <>
            Remembered it? <Link to="/login" className="font-semibold underline">Go to login</Link>.
          </>
        }
      >
        {success ? (
          <p className="text-center text-sm text-neutral-700">
            If an account exists for <strong>{email}</strong>, a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={onSubmit}>
            <IconField
              icon={<MailIcon />}
              type="email"
              placeholder="Work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="mb-4"
            />
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              Send reset link
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthScreen>
  );
}

function KeyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}
