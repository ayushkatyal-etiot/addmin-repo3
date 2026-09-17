import { describe, it, expect, vi } from "vitest";
import { HttpError } from "wasp/server";
import type { AuthUser } from "wasp/auth";
import { assertRole, assertOfficeScope } from "../src/server/shared/authz";
import { generateBase32Secret, generateTotp, verifyTotp, getOtpAuthUri } from "../src/server/auth/totp";
import { mfaVerifiedUntil, isMfaCurrentlyVerified } from "../src/server/auth/mfa";

// Build Step 03 (planmysaas-blueprint/08-build-playbook.md): role x office x
// action matrix, extended by every later build step per 07-phases.md's
// "Authorization test coverage" initiative. Unit-level (mocked AuditLog, no
// live DB) so this runs in CI in well under the 30s quality bar -- the
// role x office x live-request smoke test this was built against was run
// manually against a real dev server (signup -> invite -> MFA -> platform
// login), not re-run here.

const ALL_ROLES = [
  "platform_admin",
  "office_admin",
  "checker",
  "payment_authorizer",
  "vendor_manager",
  "compliance_coordinator",
  "facility_staff",
  "office_head",
  "employee",
] as const;

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    org_id: "org-1",
    email: "user@test.addmin.dev",
    role: "office_admin",
    office_scope: { "office-1": [] },
    mfa_enabled: false,
    mfa_secret: null,
    mfa_verified_until: null,
    identities: { email: { id: "user@test.addmin.dev", isEmailVerified: true } },
    getFirstProviderUserId: () => "user@test.addmin.dev",
    ...overrides,
  } as unknown as AuthUser;
}

function makeEntities() {
  const create = vi.fn().mockResolvedValue({});
  return { entities: { AuditLog: { create } as any }, create };
}

describe("totp.ts (RFC 6238)", () => {
  it("a freshly generated secret's current code verifies", () => {
    const secret = generateBase32Secret();
    const code = generateTotp(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const secret = generateBase32Secret();
    expect(verifyTotp(secret, "000000")).toBe(false);
  });

  it("rejects a non-6-digit token", () => {
    const secret = generateBase32Secret();
    expect(verifyTotp(secret, "12345")).toBe(false);
    expect(verifyTotp(secret, "abcdef")).toBe(false);
  });

  it("tolerates one step (30s) of clock drift but not two", () => {
    const secret = generateBase32Secret();
    const now = Date.now();
    const oneStepAgo = now - 30_000;
    const twoStepsAgo = now - 60_000;
    const codeOneStepAgo = generateTotp(secret, oneStepAgo);
    const codeTwoStepsAgo = generateTotp(secret, twoStepsAgo);
    expect(verifyTotp(secret, codeOneStepAgo, now)).toBe(true);
    expect(verifyTotp(secret, codeTwoStepsAgo, now)).toBe(false);
  });

  it("produces a well-formed otpauth:// URI", () => {
    const uri = getOtpAuthUri("JBSWY3DPEHPK3PXP", "user@test.addmin.dev");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
  });
});

describe("mfa.ts verified-window helpers", () => {
  it("a freshly issued window is currently verified", () => {
    expect(isMfaCurrentlyVerified(mfaVerifiedUntil())).toBe(true);
  });

  it("a past timestamp is not currently verified", () => {
    expect(isMfaCurrentlyVerified(new Date(Date.now() - 1000))).toBe(false);
  });

  it("null is not currently verified", () => {
    expect(isMfaCurrentlyVerified(null)).toBe(false);
  });
});

describe("assertRole", () => {
  it("throws 401 for no user", async () => {
    const { entities } = makeEntities();
    await expect(assertRole(null, ["office_admin"], entities, "test")).rejects.toMatchObject({
      statusCode: 401,
    } satisfies Partial<HttpError>);
  });

  it("allows a role in the allow-list", async () => {
    const { entities } = makeEntities();
    const user = makeUser({ role: "office_admin" });
    await expect(assertRole(user, ["office_admin", "checker"], entities, "test")).resolves.toBe(
      user,
    );
  });

  it("rejects a role not in the allow-list and logs the denial", async () => {
    const { entities, create } = makeEntities();
    const user = makeUser({ role: "employee" });
    await expect(assertRole(user, ["platform_admin"], entities, "inviteUser")).rejects.toMatchObject(
      { statusCode: 403 },
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          org_id: "org-1",
          actor_user_id: "user-1",
          action: "denied:role_denied",
        }),
      }),
    );
  });

  it.each(ALL_ROLES)("role x action matrix: %s can only pass its own allow-list", async (role) => {
    const { entities } = makeEntities();
    // mfa fields satisfied unconditionally -- this test is isolating role
    // gating specifically; MFA gating has its own dedicated tests above.
    const user = makeUser({ role, mfa_enabled: true, mfa_verified_until: mfaVerifiedUntil() });
    await expect(assertRole(user, [role], entities, "matrix-test")).resolves.toBeDefined();
    await expect(
      assertRole(user, ALL_ROLES.filter((r) => r !== role), entities, "matrix-test"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("blocks an MFA-required role that hasn't enrolled yet", async () => {
    const { entities } = makeEntities();
    const user = makeUser({ role: "platform_admin", mfa_enabled: false });
    await expect(assertRole(user, ["platform_admin"], entities, "test")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("blocks an MFA-enabled user outside the verified window", async () => {
    const { entities } = makeEntities();
    const user = makeUser({
      role: "platform_admin",
      mfa_enabled: true,
      mfa_verified_until: new Date(Date.now() - 1000),
    });
    await expect(assertRole(user, ["platform_admin"], entities, "test")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("allows an MFA-enabled user inside the verified window", async () => {
    const { entities } = makeEntities();
    const user = makeUser({
      role: "platform_admin",
      mfa_enabled: true,
      mfa_verified_until: mfaVerifiedUntil(),
    });
    await expect(assertRole(user, ["platform_admin"], entities, "test")).resolves.toBe(user);
  });
});

describe("assertOfficeScope", () => {
  it("allows a user scoped to the target office", async () => {
    const { entities } = makeEntities();
    const user = makeUser({ office_scope: { "office-1": [] } });
    await expect(assertOfficeScope(user, "office-1", entities, "test")).resolves.toBeUndefined();
  });

  it("rejects and logs a cross-office access attempt", async () => {
    const { entities, create } = makeEntities();
    const user = makeUser({ office_scope: { "office-1": [] } });
    await expect(assertOfficeScope(user, "office-2", entities, "getOfficeChecklist")).rejects.toMatchObject(
      { statusCode: 403 },
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "denied:office_scope_denied",
          entity_id: "office-2",
        }),
      }),
    );
  });

  it("platform_admin bypasses office scope unconditionally", async () => {
    const { entities } = makeEntities();
    const user = makeUser({
      role: "platform_admin",
      office_scope: {},
      mfa_enabled: true,
      mfa_verified_until: mfaVerifiedUntil(),
    });
    await expect(assertOfficeScope(user, "any-office", entities, "test")).resolves.toBeUndefined();
  });
});
