import { Navigate, useLocation } from "react-router";
import { useAuth } from "wasp/client/auth";
import { useQuery, getMfaStatus } from "wasp/client/operations";

const MFA_ROUTES = ["/mfa-setup", "/mfa-verify"];

const PUBLIC_AUTH_PATHS = [
  "/login",
  "/signup",
  "/request-password-reset",
  "/password-reset",
  "/email-verification",
  "/platform/signin",
];

function LoadingScreen() {
  return <p className="p-12 text-center text-neutral-500">Loading…</p>;
}

/** Blocks authenticated app pages until MFA-required roles enroll / verify (authz.ts). */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: user, isLoading: authLoading } = useAuth();

  const isPublicAuthPage = PUBLIC_AUTH_PATHS.some((path) => location.pathname.startsWith(path));
  const onMfaRoute = MFA_ROUTES.some((path) => location.pathname.startsWith(path));
  const shouldCheckMfa = !!user && !isPublicAuthPage && !onMfaRoute;

  const { data: mfaStatus, isLoading: mfaLoading, error: mfaError } = useQuery(getMfaStatus, undefined, {
    enabled: shouldCheckMfa,
  });

  // Logged-in users should not stay on login/signup — send them through "/" so
  // MFA-required roles hit /mfa-setup or /mfa-verify (payment authorizer, platform admin).
  if (user && isPublicAuthPage && !onMfaRoute) {
    return <Navigate to="/" replace />;
  }

  if (isPublicAuthPage || onMfaRoute) return <>{children}</>;

  if (authLoading || (shouldCheckMfa && mfaLoading && !mfaError)) return <LoadingScreen />;
  if (!user) return <>{children}</>;

  if (mfaStatus?.mfaRequired && !mfaStatus.mfaEnabled) {
    return <Navigate to="/mfa-setup" replace />;
  }
  if (mfaStatus?.mfaEnabled && !mfaStatus.mfaVerifiedThisWindow) {
    return <Navigate to="/mfa-verify" replace />;
  }

  return <>{children}</>;
}
