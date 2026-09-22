import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { signup } from "wasp/client/auth";
import { AuthScreen } from "../../shared/components/auth/AuthScreen";
import { AuthTopToggle } from "../../shared/components/auth/AuthTopToggle";
import { AuthCard } from "../../shared/components/auth/AuthCard";
import { IconField, MailIcon, LockIcon } from "../../shared/components/auth/IconField";
import { Button } from "../../shared/components/Button";

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";
  // Carried straight through to userSignupFields.ts's resolvePlan, which
  // validates it server-side and degrades to "starter" if it's missing or
  // unrecognized -- this is just passing along whatever the marketing
  // site's CTA sent, not the source of truth for what's a valid plan.
  const plan = searchParams.get("plan") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      // inviteToken/plan aren't User columns -- userSignupFields.ts reads
      // them off the untyped raw payload, so neither is in EmailSignupData's type.
      await signup({ email, password, inviteToken, plan } as unknown as Parameters<typeof signup>[0]);
      // Wasp requires email verification before login — auto-login here always
      // failed with "Invalid credentials" even though signup succeeded.
      setPendingVerificationEmail(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (pendingVerificationEmail) {
    return (
      <AuthScreen topRight={<AuthTopToggle active="signup" />}>
        <AuthCard
          icon={<UsersIcon />}
          title="Check your email"
          subtitle={`We sent a verification link to ${pendingVerificationEmail}. Open that link, then sign in with the password you just chose.`}
          footer={
            <>
              Already verified? <Link to="/login" className="font-semibold underline">Go to login</Link>.
            </>
          }
        >
          <p className="text-sm text-neutral-600">
            Invited teammates must sign up with the exact email on the invite. If no email arrives, check spam or ask
            your admin to confirm SendGrid and <code className="text-xs">WASP_WEB_CLIENT_URL</code> in{" "}
            <code className="text-xs">.env.server</code>.
          </p>
        </AuthCard>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen topRight={<AuthTopToggle active="signup" />}>
      <AuthCard
        icon={<UsersIcon />}
        title="Sign up with email"
        subtitle={
          inviteToken
            ? "You've been invited to join an organization on AddMin. Sign up with the same email address the invite was sent to."
            : "Create an account to manage utilities, compliance, and approvals in one place."
        }
        footer={
          <>
            Already have an account? <Link to="/login" className="font-semibold underline">Go to login</Link>.
          </>
        }
      >
        <form onSubmit={onSubmit}>
          <IconField
            icon={<MailIcon />}
            type="email"
            placeholder="Work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <IconField
            icon={<LockIcon />}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
            Create account
          </Button>
        </form>
      </AuthCard>
    </AuthScreen>
  );
}

function UsersIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}
