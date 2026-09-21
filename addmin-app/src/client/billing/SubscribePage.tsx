import { useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery, getSubscription, subscribeToPlan } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Past due",
  expired: "Expired",
  canceled: "Canceled",
};

// F-19 (planmysaas-blueprint/05-features.md): trial banner + plan cards +
// Stripe Checkout redirect. Reads ?plan= carried from /signup (marketing
// site's "Start Free Trial" CTA per 09-marketing-website.md) and ?success=/
// ?canceled= carried back from Stripe's redirect after checkout.
export function SubscribePage() {
  const [searchParams] = useSearchParams();
  const { data: subscription, isLoading, refetch } = useQuery(getSubscription);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  async function onSubscribe() {
    setError(null);
    setIsRedirecting(true);
    try {
      const { checkoutUrl } = await subscribeToPlan({ plan: "starter" });
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setIsRedirecting(false);
    }
  }

  if (isLoading) return null;

  const daysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl p-12">
      <h1 className="mb-2 text-2xl font-semibold text-neutral-900">Subscription</h1>

      {success && (
        <div className="card mb-4 border-primary-200 bg-primary-50 p-4 text-sm text-primary-800">
          Payment received -- your plan will update within a few seconds once Stripe's webhook confirms it.{" "}
          <button className="underline" onClick={() => refetch()}>
            Refresh
          </button>
        </div>
      )}
      {canceled && (
        <div className="card mb-4 border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
          Checkout was canceled -- no charge was made.
        </div>
      )}

      {subscription && (
        <div className="card mb-6 p-6">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm text-neutral-500">Current status:</span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">
              {STATUS_LABEL[subscription.status] ?? subscription.status}
            </span>
          </div>
          {subscription.status === "trialing" && daysLeft !== null && (
            <p className="text-sm text-neutral-600">
              {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your trial.` : "Your trial has ended."}
            </p>
          )}
        </div>
      )}

      <div className="card p-6">
        <h2 className="mb-1 text-lg font-semibold text-neutral-900">Starter</h2>
        <p className="mb-4 text-2xl font-bold text-neutral-900">
          ₹100<span className="text-sm font-normal text-neutral-500">/month</span>
        </p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <Button onClick={onSubscribe} disabled={isRedirecting || subscription?.status === "active"}>
          {subscription?.status === "active" ? "Active" : isRedirecting ? "Redirecting…" : "Subscribe"}
        </Button>
      </div>

      <p className="mt-6 text-sm text-neutral-500">
        Need more than Starter?{" "}
        <a href="mailto:ayush.katyal@etiot.in" className="underline">
          Contact sales
        </a>{" "}
        for a custom plan -- a Platform Operator sets it up on your account directly.
      </p>
    </div>
  );
}
