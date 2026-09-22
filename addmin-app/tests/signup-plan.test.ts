import { describe, it, expect } from "vitest";
import { resolvePlan } from "../src/auth/email/userSignupFields";

// The marketing site's "Start Free Trial" CTA sends ?plan= through to
// /signup, which this resolves server-side at Subscription-creation time --
// see userSignupFields.ts's file header for why (survives a verification
// link opened in a different tab/browser, which sessionStorage wouldn't).
describe("resolvePlan", () => {
  it("passes through a valid self-serve plan", () => {
    expect(resolvePlan({ plan: "starter" })).toBe("starter");
    expect(resolvePlan({ plan: "growth" })).toBe("growth");
  });

  it("defaults to starter when plan is missing", () => {
    expect(resolvePlan({})).toBe("starter");
  });

  it("defaults to starter for enterprise -- never self-serve-settable", () => {
    expect(resolvePlan({ plan: "enterprise" })).toBe("starter");
  });

  it("defaults to starter for an unrecognized or malformed value, never errors", () => {
    expect(resolvePlan({ plan: "growth; DROP TABLE users;" })).toBe("starter");
    expect(resolvePlan({ plan: 123 })).toBe("starter");
    expect(resolvePlan({ plan: null })).toBe("starter");
  });
});
