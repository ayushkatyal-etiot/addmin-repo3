import { Navigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import { useQuery, getMfaStatus } from "wasp/client/operations";

export function HomePage() {
  const { data: user } = useAuth();
  const { data: mfaStatus, isLoading: mfaStatusLoading } = useQuery(getMfaStatus);

  if (mfaStatusLoading) return null;

  // Every operation on the server is already blocked until these pass
  // (src/server/shared/authz.ts) -- these redirects are just so the user
  // isn't staring at a home page full of failed requests in the meantime.
  if (mfaStatus?.mfaRequired && !mfaStatus.mfaEnabled) {
    return <Navigate to="/mfa-setup" replace />;
  }
  if (mfaStatus?.mfaEnabled && !mfaStatus.mfaVerifiedThisWindow) {
    return <Navigate to="/mfa-verify" replace />;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-12">
      <p className="text-neutral-600">
        AddMin — signed in{user ? ` as ${user.identities.email?.id}` : ""}.
        Build Step 03 (auth/RBAC) complete. Feature pages land in later build steps.
      </p>
    </div>
  );
}
