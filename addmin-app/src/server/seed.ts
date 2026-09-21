import type { DbSeedFn } from "wasp/server";
import { createUser, createProviderId, sanitizeAndSerializeProviderData } from "wasp/server/auth";
import { createPasswordHash } from "./platform/platformAuth";
import { generateMfaSecret } from "./auth/mfa";
import { obligationGenerationJob } from "./obligation/generationJob";
import { missingAlertJob } from "./obligation/missingAlertJob";

const SEED_PLATFORM_OPERATOR_ID = "00000000-0000-0000-0000-000000000003";
const SEED_PLATFORM_OPERATOR_EMAIL = "operator@etiot.in";
const SEED_PLATFORM_OPERATOR_PASSWORD = "12345678";

// Dev-only, login-capable test account (unlike SEED_ROLES below, which are
// plain User rows with no Auth/AuthIdentity -- fine for being picked as an
// approver, useless for actually signing in). Uses Wasp's own createUser
// helper, the same one real signup goes through, so this is a real email+
// password identity, pre-verified so there's no inbox to check locally.
const SEED_TEST_LOGIN_EMAIL = "admin@seed.addmin.test";
const SEED_TEST_LOGIN_PASSWORD = "password123";

// Fixed ids so this seed is idempotent -- `wasp db seed` upserts by id/email
// instead of creating a new random row every run (Build Step 02 rubric).
const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";
const SEED_OFFICE_ID = "00000000-0000-0000-0000-000000000002";

const SEED_ROLES = [
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

// Dev-only: `wasp db seed runObligationJobs` runs the same two nightly
// PgBoss jobs (main.wasp.ts) on demand, against real data, instead of
// waiting for the 03:00/03:30 cron or the expected_window_days gate to line
// up naturally.
export const runObligationJobs: DbSeedFn = async (prisma) => {
  await obligationGenerationJob(undefined, {
    entities: {
      RecurringObligationSchedule: prisma.recurringObligationSchedule,
      ObligationInstance: prisma.obligationInstance,
    },
  });
  await missingAlertJob(undefined, {
    entities: {
      ObligationInstance: prisma.obligationInstance,
      RecurringObligationSchedule: prisma.recurringObligationSchedule,
      UtilityAccount: prisma.utilityAccount,
      NotificationLog: prisma.notificationLog,
      User: prisma.user,
    },
  });
};

export const seedDevData: DbSeedFn = async (prisma) => {
  const org = await prisma.organization.upsert({
    where: { id: SEED_ORG_ID },
    update: {},
    create: {
      id: SEED_ORG_ID,
      name: "AddMin Seed Org",
      default_currency: "INR",
      timezone: "Asia/Kolkata",
      tenant_status: "active",
    },
  });

  // Build Step 05: real signups get a Subscription created for them
  // (src/auth/email/userSignupFields.ts) -- this seed predates that and
  // never did, which is exactly the gap that made the Platform Ops console's
  // "Save" 404 for this org. Upsert here so a fresh seed always matches.
  await prisma.subscription.upsert({
    where: { org_id: org.id },
    update: {},
    create: {
      org_id: org.id,
      plan: "starter",
      status: "trialing",
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.office.upsert({
    where: { id: SEED_OFFICE_ID },
    update: {},
    create: {
      id: SEED_OFFICE_ID,
      org_id: org.id,
      code: "SEED-HQ",
      name: "Seed HQ",
      address: "1 Seed Street",
      office_type: "head_office",
      ownership_type: "owned",
      setup_status: "draft",
    },
  });

  const usersByRole: Record<string, { id: string }> = {};
  for (const role of SEED_ROLES) {
    const email = `${role}@seed.addmin.test`;
    usersByRole[role] = await prisma.user.upsert({
      where: { email },
      update: {
        // Keep dev role users scoped to Seed HQ so listOffices / assertOfficeScope work.
        office_scope: { [SEED_OFFICE_ID]: [role] },
      },
      create: {
        org_id: org.id,
        email,
        role,
        office_scope: { [SEED_OFFICE_ID]: [role] },
        // Build Step 07 (F-11): a real limit so the "exceeds authorization
        // limit" rejection path is exercisable against seed data.
        authorization_limit: role === "payment_authorizer" ? 100000 : null,
      },
    });
  }

  // Build Step 07: an org-wide, uncapped catch-all tier so a freshly seeded
  // org can submit a bill for approval without first visiting
  // /admin/workflow -- same "at least one test instance available" spirit as
  // Step 06's obligation-instance precondition for this step.
  const existingWorkflowTier = await prisma.workflowDefinition.findFirst({
    where: { org_id: org.id, office_id: null, scope_type: "utility", tier: 1 },
  });
  if (!existingWorkflowTier) {
    await prisma.workflowDefinition.create({
      data: {
        org_id: org.id,
        office_id: null,
        scope_type: "utility",
        tier: 1,
        max_amount: null,
        approver_user_id: usersByRole["checker"].id,
      },
    });
  }

  const existingLoginUser = await prisma.user.findUnique({ where: { email: SEED_TEST_LOGIN_EMAIL } });
  if (!existingLoginUser) {
    const providerData = await sanitizeAndSerializeProviderData({
      hashedPassword: SEED_TEST_LOGIN_PASSWORD,
      isEmailVerified: true,
      emailVerificationSentAt: null,
      passwordResetSentAt: null,
    });
    await createUser(createProviderId("email", SEED_TEST_LOGIN_EMAIL), providerData, {
      email: SEED_TEST_LOGIN_EMAIL,
      role: "platform_admin",
      organization: { connect: { id: org.id } },
    });
    console.log(`Seeded login-capable test user ${SEED_TEST_LOGIN_EMAIL} / ${SEED_TEST_LOGIN_PASSWORD}`);
  }

  // Dev-only: PlatformOperator has no self-serve signup by design (F-20), so
  // there's no other way to get a working account for local testing than
  // seeding one directly. Real provisioning is a manual, out-of-band process.
  const existingOperator = await prisma.platformOperator.findUnique({
    where: { id: SEED_PLATFORM_OPERATOR_ID },
  });
  if (!existingOperator) {
    const mfaSecret = generateMfaSecret();
    await prisma.platformOperator.create({
      data: {
        id: SEED_PLATFORM_OPERATOR_ID,
        email: SEED_PLATFORM_OPERATOR_EMAIL,
        password_hash: await createPasswordHash(SEED_PLATFORM_OPERATOR_PASSWORD),
        mfa_enabled: true,
        mfa_secret: mfaSecret,
      },
    });
    console.log(
      `Seeded Platform Operator ${SEED_PLATFORM_OPERATOR_EMAIL} / ${SEED_PLATFORM_OPERATOR_PASSWORD}\n` +
        `MFA secret (add to an authenticator app manually, dev only): ${mfaSecret}`,
    );
  }

  console.log(
    `Seeded 1 organization, 1 office, ${SEED_ROLES.length} users (one per role).`,
  );
};
