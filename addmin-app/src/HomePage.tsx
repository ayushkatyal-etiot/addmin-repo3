import { Navigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import { useQuery, getMfaStatus, getSubscription, listOffices } from "wasp/client/operations";

export function HomePage() {
  const { data: user } = useAuth();
  const { data: mfaStatus, isLoading: mfaStatusLoading } = useQuery(getMfaStatus);
  const { data: subscription, isLoading: subscriptionLoading } = useQuery(getSubscription);
  const { data: offices, isLoading: officesLoading } = useQuery(listOffices, undefined, {
    enabled: !!user,
  });

  if (mfaStatusLoading || subscriptionLoading || officesLoading) return null;

  // Every operation on the server is already blocked until these pass
  // (src/server/shared/authz.ts) -- these redirects are just so the user
  // isn't staring at a home page full of failed requests in the meantime.
  if (mfaStatus?.mfaRequired && !mfaStatus.mfaEnabled) {
    return <Navigate to="/mfa-setup" replace />;
  }
  if (mfaStatus?.mfaEnabled && !mfaStatus.mfaVerifiedThisWindow) {
    return <Navigate to="/mfa-verify" replace />;
  }
  // F-19: an org whose trial expired with no plan chosen is gated to
  // "choose a plan" on next access -- trialing/active/past_due all still
  // get in (past_due keeps access; Stripe's own dunning handles that case).
  if (subscription?.status === "expired" || subscription?.status === "canceled") {
    return <Navigate to="/app/subscribe" replace />;
  }

  const officeList = offices ?? [];
  if (officeList.length === 0) {
    return <Navigate to="/app/offices/new" replace />;
  }
  return <Navigate to="/app/dashboard" replace />;
}
