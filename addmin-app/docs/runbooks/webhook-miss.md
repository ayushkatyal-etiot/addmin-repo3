# Runbook: Missed or failed Stripe webhook

**Symptom:** A customer paid (or their subscription changed/cancelled in Stripe) but AddMin's `Subscription` row doesn't reflect it — e.g. `subscribeToPlan` shows `trialing` after checkout, or a cancelled plan still shows `active`.

## 1. Confirm it's actually a webhook miss

- Stripe Dashboard → Developers → Webhooks → your endpoint → check recent deliveries for `POST /payments-webhook`.
- Look for the specific event (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`) tied to the affected org. Note its `org_id` from `event.data.object.metadata.org_id`.
- If Stripe shows the delivery succeeded (2xx) but the DB still looks wrong, this isn't a delivery problem — check `src/server/billing/webhook.ts`'s `activateSubscription`/`syncSubscriptionStatus` logic instead, not this runbook.

## 2. Common causes, in order of likelihood

1. **`STRIPE_WEBHOOK_SECRET` missing or wrong in this environment.** `paymentsWebhook` (`src/server/billing/webhook.ts`) returns 400 immediately if the header or secret is missing, and rejects on signature mismatch — Stripe will show these as failed deliveries with a 400 status. Fix the env var, redeploy; Stripe does **not** need you to resend, see step 3.
2. **`metadata.org_id` missing on the Stripe object.** Every event handler here reads `org_id` off Stripe's `metadata` field — if the Checkout Session or Subscription was created without it, the webhook silently no-ops (by design: "ignore event types/objects we don't act on"). Check `src/client/billing/SubscribePage.tsx` / wherever the Checkout Session is created to confirm `metadata: { org_id }` is being set.
3. **Endpoint URL wrong in Stripe** (pointing at an old deploy, staging instead of prod, etc). Check the endpoint URL in Stripe Dashboard matches this environment's real public URL + `/payments-webhook`.

## 3. Recovery

- Stripe retries failed deliveries automatically for a while, but once you've fixed the root cause, don't wait — **Stripe Dashboard → the specific event → "Resend"** re-delivers that exact event. This is idempotent-safe: `activateSubscription`/`syncSubscriptionStatus` only set fields, they don't create duplicate rows.
- If a specific org's subscription is stuck (e.g. RCA identified but resend isn't practical for a batch of old events), you can also fix the `Subscription` row directly via Prisma using the same values you'd expect the webhook to have set (`plan`, `status`, `stripe_customer_id`, `stripe_subscription_id`) — treat this as a last resort, prefer the resend.
- After recovery, verify: `SELECT * FROM "Subscription" WHERE org_id = '<org_id>'` shows the expected `plan`/`status`.

## 4. Prevention

- The 200-regardless-of-handling response at the end of `paymentsWebhook` is intentional (avoids Stripe retry storms for event types we don't act on) — don't "fix" this into a 4xx for unhandled types, it'll make Stripe hammer the endpoint.
- If this becomes recurring, the real fix is alerting on webhook 4xx/5xx rates in Stripe's own dashboard (Developers → Webhooks → endpoint → delivery health) rather than waiting for a customer to report it.
