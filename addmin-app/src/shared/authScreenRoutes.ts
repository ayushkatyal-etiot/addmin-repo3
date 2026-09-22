// Every route that renders its own full-bleed AuthScreen chrome
// (Login Flow.dc.html) -- never wrapped in the app's Sidebar, whether or not
// the visitor has a session. MFA routes are authRequired but still belong
// here: they're the pre-app auth flow, not the product itself. Same for the
// add-office form and the per-office details screen (/app/offices/:id/setup,
// matched below) -- /app/offices itself (the list page) is excluded on
// purpose, only these standalone screens are. The guided onboarding
// checklist wizard is hidden entirely (no route) per
// planmysaas-blueprint/11-without-setup-decision.md ("Option A").
//
// Logged-in wizard routes still use SelectedOfficeProvider (see App.tsx) even
// though they use this layout.
export const AUTH_SCREEN_PATHS = [
  "/login",
  "/signup",
  "/request-password-reset",
  "/password-reset",
  "/email-verification",
  "/mfa-setup",
  "/mfa-verify",
  "/platform/signin",
  "/app/offices/new",
] as const;

const AUTH_SCREEN_PATTERNS = [
  /^\/app\/offices\/[^/]+\/setup$/,
  // F-20: Platform Operator console — no tenant Sidebar/Topbar
  /^\/platform(\/|$)/,
];

export function isAuthScreenPath(pathname: string): boolean {
  return (
    AUTH_SCREEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    AUTH_SCREEN_PATTERNS.some((pattern) => pattern.test(pathname))
  );
}
