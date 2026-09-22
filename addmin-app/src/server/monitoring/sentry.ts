import type { ServerSetupFn } from "wasp/server";
import * as Sentry from "@sentry/node";

// Build Step 11: production hardening. No live Sentry account exists in
// this dev/build environment, so this is entirely inert unless SENTRY_DSN
// is set -- init() with no dsn is a documented Sentry no-op, but the env
// check makes that explicit rather than relying on library behavior.
// runbooks/job-failure.md and every api/webhook handler assume this is
// wired up once a real DSN is configured.
export const setupSentry: ServerSetupFn = async () => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log("SENTRY_DSN not set -- error tracking disabled.");
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
  });
  console.log("Sentry initialized.");
};
