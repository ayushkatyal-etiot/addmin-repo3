import { describe, it, expect, vi } from "vitest";
import { prisma } from "wasp/server";
import type { AuthUser } from "wasp/auth";
import { assertRole } from "../src/server/shared/authz";
import { OFFICE_ADMIN_ROLES as OFFICE_ADMIN_ROLES_OFFICE, OFFICE_LIST_ROLES } from "../src/server/organization/office";
import { OFFICE_ADMIN_ROLES as OFFICE_ADMIN_ROLES_WAIVE } from "../src/server/obligation/waive";
import { OFFICE_ADMIN_ROLES as OFFICE_ADMIN_ROLES_LANDLORD } from "../src/server/property/landlord";
import { OFFICE_ADMIN_ROLES as OFFICE_ADMIN_ROLES_LEASE, LEASE_READ_ROLES } from "../src/server/property/lease";
import { PAYMENT_AUTHORIZER_ROLES as PAYMENT_AUTHORIZER_ROLES_RENT } from "../src/server/property/rentPayment";
import { PAYMENT_AUTHORIZER_ROLES } from "../src/server/payment/payment";
import { OFFICE_ADMIN_ROLES as OFFICE_ADMIN_ROLES_ACTIVATION } from "../src/server/onboarding/activation";
import { OFFICE_ADMIN_ROLES as OFFICE_ADMIN_ROLES_CHECKLIST } from "../src/server/onboarding/checklist";
import { OFFICE_ADMIN_ROLES as OFFICE_ADMIN_ROLES_UTILITY } from "../src/server/utility/account";
import { MAKER_ROLES } from "../src/server/utility/bill";
import { EXECUTIVE_ROLES } from "../src/server/reporting/executive";
import { ASSET_ADMIN_ROLES } from "../src/server/asset/asset";
import { COMPLIANCE_ADMIN_ROLES, COMPLIANCE_READ_ROLES } from "../src/server/compliance/compliance";
import { REQUEST_CREATE_ROLES, WORK_ORDER_ADMIN_ROLES, WORK_ORDER_EXECUTOR_ROLES } from "../src/server/facility/maintenance";
import { WORKFLOW_ADMIN_ROLES, CHECKER_ROLES } from "../src/server/workflow/approval";
import { VENDOR_ADMIN_ROLES as VENDOR_ADMIN_ROLES_VENDOR, VENDOR_READ_ROLES } from "../src/server/vendor/vendor";
import { VENDOR_ADMIN_ROLES as VENDOR_ADMIN_ROLES_AMC } from "../src/server/vendor/amc";
import { mfaVerifiedUntil } from "../src/server/auth/mfa";

// Build Step 11: "tests/authz.test.ts covers every role x office x action
// combination across all modules built through Step 08." authz.test.ts
// already proves assertRole enforces an arbitrary allow-list correctly (its
// it.each(ALL_ROLES) matrix). What that doesn't catch is a module quietly
// drifting to the WRONG allow-list (e.g. someone adds "employee" to
// ASSET_ADMIN_ROLES by mistake). This file closes that gap two ways per
// module: (1) pin the exact expected role set so drift fails loudly, and
// (2) run it through the real assertRole gate to prove the pinned list is
// what actually gets enforced, not just what the constant says.

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
  return { entities: { AuditLog: { create: vi.fn().mockResolvedValue({}) } as any } };
}

function mockDbUserFromSession(user: AuthUser) {
  vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
    role: user.role ?? null,
    mfa_enabled: user.mfa_enabled ?? false,
    mfa_verified_until: user.mfa_verified_until ?? null,
  } as any);
}

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

/** Confirms an operation's role list is exactly `expected`, and that assertRole enforces exactly that list. */
async function expectRoleGate(actual: readonly string[], expected: readonly string[]) {
  expect(new Set(actual)).toEqual(new Set(expected));
  for (const role of ALL_ROLES) {
    const shouldPass = expected.includes(role);
    const user = makeUser({ role, mfa_enabled: true, mfa_verified_until: mfaVerifiedUntil() });
    mockDbUserFromSession(user);
    const { entities } = makeEntities();
    const promise = assertRole(user, actual as any, entities, "coverage-test");
    if (shouldPass) {
      await expect(promise).resolves.toBeDefined();
    } else {
      await expect(promise).rejects.toMatchObject({ statusCode: 403 });
    }
  }
}

describe("authz coverage: role allow-lists across every module (Build Steps 04-08)", () => {
  it("organization/office.ts", async () => {
    await expectRoleGate(OFFICE_ADMIN_ROLES_OFFICE, ["platform_admin", "office_admin"]);
    await expectRoleGate(OFFICE_LIST_ROLES, [
      "platform_admin",
      "office_admin",
      "office_head",
      "vendor_manager",
      "checker",
      "payment_authorizer",
      "facility_staff",
      "employee",
    ]);
  });

  it("obligation/waive.ts", async () => {
    await expectRoleGate(OFFICE_ADMIN_ROLES_WAIVE, ["platform_admin", "office_admin"]);
  });

  it("property/landlord.ts", async () => {
    await expectRoleGate(OFFICE_ADMIN_ROLES_LANDLORD, ["platform_admin", "office_admin"]);
  });

  it("property/lease.ts", async () => {
    await expectRoleGate(OFFICE_ADMIN_ROLES_LEASE, ["platform_admin", "office_admin"]);
    await expectRoleGate(LEASE_READ_ROLES, ["platform_admin", "office_admin", "office_head", "payment_authorizer"]);
  });

  it("property/rentPayment.ts and payment/payment.ts", async () => {
    await expectRoleGate(PAYMENT_AUTHORIZER_ROLES_RENT, ["payment_authorizer"]);
    await expectRoleGate(PAYMENT_AUTHORIZER_ROLES, ["payment_authorizer"]);
  });

  it("onboarding/activation.ts and onboarding/checklist.ts", async () => {
    await expectRoleGate(OFFICE_ADMIN_ROLES_ACTIVATION, ["platform_admin", "office_admin"]);
    await expectRoleGate(OFFICE_ADMIN_ROLES_CHECKLIST, ["platform_admin", "office_admin"]);
  });

  it("utility/account.ts and utility/bill.ts", async () => {
    await expectRoleGate(OFFICE_ADMIN_ROLES_UTILITY, ["platform_admin", "office_admin"]);
    await expectRoleGate(MAKER_ROLES, ["platform_admin", "office_admin"]);
  });

  it("reporting/executive.ts (F-18)", async () => {
    await expectRoleGate(EXECUTIVE_ROLES, ["platform_admin", "office_head"]);
  });

  it("asset/asset.ts", async () => {
    await expectRoleGate(ASSET_ADMIN_ROLES, ["platform_admin", "office_admin"]);
  });

  it("compliance/compliance.ts", async () => {
    await expectRoleGate(COMPLIANCE_ADMIN_ROLES, ["platform_admin", "office_admin", "compliance_coordinator"]);
    await expectRoleGate(COMPLIANCE_READ_ROLES, ["platform_admin", "office_admin", "compliance_coordinator", "office_head"]);
  });

  it("facility/maintenance.ts", async () => {
    await expectRoleGate(REQUEST_CREATE_ROLES, ["platform_admin", "office_admin", "facility_staff", "employee"]);
    await expectRoleGate(WORK_ORDER_ADMIN_ROLES, ["platform_admin", "office_admin"]);
    await expectRoleGate(WORK_ORDER_EXECUTOR_ROLES, ["platform_admin", "office_admin", "facility_staff"]);
  });

  it("workflow/approval.ts", async () => {
    await expectRoleGate(WORKFLOW_ADMIN_ROLES, ["platform_admin", "office_admin"]);
    await expectRoleGate(CHECKER_ROLES, ["platform_admin", "checker"]);
  });

  it("vendor/vendor.ts and vendor/amc.ts", async () => {
    await expectRoleGate(VENDOR_ADMIN_ROLES_VENDOR, ["platform_admin", "vendor_manager"]);
    await expectRoleGate(VENDOR_READ_ROLES, ["platform_admin", "vendor_manager", "office_admin", "facility_staff"]);
    await expectRoleGate(VENDOR_ADMIN_ROLES_AMC, ["platform_admin", "vendor_manager"]);
  });
});
