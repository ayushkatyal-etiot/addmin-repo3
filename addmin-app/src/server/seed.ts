import type { DbSeedFn } from "wasp/server";
import { createPasswordHash } from "./platform/platformAuth";
import { generateMfaSecret } from "./auth/mfa";

const SEED_PLATFORM_OPERATOR_ID = "00000000-0000-0000-0000-000000000003";
const SEED_PLATFORM_OPERATOR_EMAIL = "operator@seed.addmin.test";
const SEED_PLATFORM_OPERATOR_PASSWORD = "dev-only-password-123";

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

  for (const role of SEED_ROLES) {
    const email = `${role}@seed.addmin.test`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        org_id: org.id,
        email,
        role,
      },
    });
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
