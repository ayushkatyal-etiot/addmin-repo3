import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { resetPassword } from "wasp/client/auth";
import { AuthScreen } from "../../shared/components/auth/AuthScreen";
import { AuthCard } from "../../shared/components/auth/AuthCard";
import { IconField, LockIcon } from "../../shared/components/auth/IconField";
import { Button } from "../../shared/components/Button";

export function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("The reset link is missing its token. Please use the link from your email.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await resetPassword({ token, password });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen>
      <AuthCard
        icon={<LockIcon />}
        title="Set a new password"
        subtitle="Choose a new password for your account."
        footer={
          <>
            If everything is okay, <Link to="/login" className="font-semibold underline">go to login</Link>.
          </>
        }
      >
        {success ? (
          <p className="text-center text-sm text-neutral-700">Your password has been reset.</p>
        ) : (
          <form onSubmit={onSubmit}>
            <IconField
              icon={<LockIcon />}
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoFocus
            />
            <IconField
              icon={<LockIcon />}
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="mb-4"
            />
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              Reset password
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthScreen>
  );
}
