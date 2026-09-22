import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { verifyEmail } from "wasp/client/auth";
import { AuthScreen } from "../../shared/components/auth/AuthScreen";
import { AuthCard } from "../../shared/components/auth/AuthCard";

export function EmailVerificationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"verifying" | "verified" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("The verification link is missing its token. Please use the link from your email.");
      return;
    }
    verifyEmail({ token })
      .then(() => setStatus("verified"))
      .catch((err) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not verify your email.");
      });
  }, [token]);

  return (
    <AuthScreen>
      <AuthCard
        icon={status === "error" ? <MailXIcon /> : <MailCheckIcon />}
        title={
          status === "verifying"
            ? "Verifying your email..."
            : status === "verified"
              ? "Your email is verified"
              : "We couldn't verify your email"
        }
        subtitle={
          status === "verified"
            ? "You can now sign in to Addmin with your email and password."
            : status === "error"
              ? error ?? undefined
              : undefined
        }
        footer={
          <>
            If everything is okay, <Link to="/login" className="font-semibold underline">go to login</Link>.
          </>
        }
      >
        <div />
      </AuthCard>
    </AuthScreen>
  );
}

function MailCheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      <path d="m16 19 2 2 4-4" />
    </svg>
  );
}

function MailXIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      <path d="m17 17 4 4" />
      <path d="m21 17-4 4" />
    </svg>
  );
}
