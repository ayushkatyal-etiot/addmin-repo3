// Build Step 10: "Every plan card's price and feature list is sourced from
// one src/content/pricing.ts file, cross-checked by hand against Step 05's
// actual Stripe Prices -- a mismatch here is a customer-trust bug."
//
// Figures are the business pricing decision from planmysaas-blueprint's
// 03-analysis.md ("Starter ₹15,000/month (up to 5 offices), Growth
// ₹25,000/month (up to 10 offices), Enterprise custom, 10+ offices").
//
// KNOWN GAP, check before real launch: addmin-app/src/server/billing/
// stripeClient.ts currently only has a Stripe Price wired for Starter, and
// it's a ₹100/month placeholder used to prove the Checkout integration
// works, not this real figure. Growth has no Stripe Price at all yet.
// Before going live, create real Starter (₹15,000) and Growth (₹25,000)
// Stripe Prices and update STRIPE_PRICE_ID_STARTER / add
// STRIPE_PRICE_ID_GROWTH, or this page will misquote what checkout actually
// charges.
export type Plan = {
  id: "starter" | "growth" | "enterprise";
  name: string;
  price: string;
  priceSuffix: string;
  officeRange: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted: boolean;
};

const APP_URL = import.meta.env.PUBLIC_APP_URL ?? "https://app.addmin.example";

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "₹15,000",
    priceSuffix: "/month",
    officeRange: "Up to 5 offices",
    description: "For a company getting the basics of utility and lease tracking under control.",
    features: [
      "Guided office onboarding checklist",
      "Utility bill tracking with due-date alerts",
      "Landlord & lease renewal tracking",
      "Office dashboard: what's due, overdue, or expiring",
      "14-day free trial, no card required",
    ],
    ctaLabel: "Start Free Trial",
    ctaHref: `${APP_URL}/signup?plan=starter`,
    highlighted: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "₹25,000",
    priceSuffix: "/month",
    officeRange: "Up to 10 offices",
    description: "For a company that also needs approvals and compliance tracking running properly.",
    features: [
      "Everything in Starter",
      "Maker-checker approval workflow with payment authorization limits",
      "Compliance checklist with expiry alerts and escalation",
      "Vendor & AMC contract tracking",
      "Executive dashboard across every office",
      "14-day free trial, no card required",
    ],
    ctaLabel: "Start Free Trial",
    ctaHref: `${APP_URL}/signup?plan=growth`,
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    priceSuffix: "",
    officeRange: "10+ offices",
    description: "For larger portfolios, priced by conversation since the needs get more specific at this size.",
    features: [
      "Everything in Growth",
      "Custom onboarding for your office count",
      "Dedicated support during rollout",
      "Design-partner pilot pricing available",
    ],
    ctaLabel: "Talk to us",
    ctaHref: "/contact",
    highlighted: false,
  },
];
