import type { DbSeedFn } from "wasp/server";
import { createPasswordHash } from "./platform/platformAuth";
import { generateMfaSecret } from "./auth/mfa";
import { obligationGenerationJob } from "./obligation/generationJob";
import { missingAlertJob } from "./obligation/missingAlertJob";
import { seedDemoOrg } from "./seed/demoOrg";
import { runNotificationJobs } from "./seed/runNotificationJobs";

export { runNotificationJobs } from "./seed/runNotificationJobs";

const SEED_PLATFORM_OPERATOR_ID = "00000000-0000-0000-0000-000000000003";
const SEED_PLATFORM_OPERATOR_EMAIL = "operator@etiot.in";
const SEED_PLATFORM_OPERATOR_PASSWORD = "12345678";

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
  await seedDemoOrg(prisma);
  await runObligationJobs(prisma);
  await runNotificationJobs(prisma);

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
};
