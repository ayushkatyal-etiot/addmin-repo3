import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { login, useAuth } from "wasp/client/auth";
import { AuthScreen } from "../../shared/components/auth/AuthScreen";
import { AuthTopToggle } from "../../shared/components/auth/AuthTopToggle";
import { AuthCard } from "../../shared/components/auth/AuthCard";
import { IconField, MailIcon, LockIcon } from "../../shared/components/auth/IconField";
import { Button } from "../../shared/components/Button";

export function LoginPage() {
  const { data: user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      navigate("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not sign in.";
      setError(
        /invalid credential/i.test(message)
          ? `${message} If you just signed up, verify your email first (link in your inbox), then try again.`
          : message,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen topRight={<AuthTopToggle active="signin" />}>
      <AuthCard
        icon={<ArrowRightIcon />}
        title="Sign in with email"
        subtitle="Sign in with your work email to reach your organization's Addmin workspace."
        footer={
          <>
            Don&apos;t have an account? <Link to="/signup" className="font-semibold underline">Go to signup</Link>.
          </>
        }
      >
        <form onSubmit={onSubmit}>
          <IconField
            icon={<MailIcon />}
            type="email"
            placeholder="Email"
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
            required
          />
          <div className="mb-4 text-right">
            <Link to="/request-password-reset" className="text-sm font-semibold text-primary-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            Sign in
          </Button>
        </form>
      </AuthCard>
    </AuthScreen>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </svg>
  );
}
