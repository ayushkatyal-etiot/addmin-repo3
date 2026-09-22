import type { PrismaClient } from "@prisma/client";
import { sendNotificationEmail } from "../notification/sender";

// Build Step 08, F-16: "Warranty expiry generates a reminder at a
// configured advance period." Same NotificationRule-driven window pattern
// as leaseJobs.ts/amcJob.ts -- rule_type "asset_warranty_expiry"
// (schema.prisma), defaulting to a single 30-day heads-up when an org
// hasn't configured one.
const DEFAULT_REMINDER_DAYS = [30];

type JobContext = {
  entities: {
    Asset: PrismaClient["asset"];
    NotificationRule: PrismaClient["notificationRule"];
    NotificationLog: PrismaClient["notificationLog"];
    User: PrismaClient["user"];
  };
};

// Date-only diff (both sides floored to UTC midnight) so the result is a
// precise whole-day count regardless of what time the nightly job happens
// to run at -- warranty_end itself is a @db.Date column with no time
// component, so comparing it against a wall-clock timestamp without
// flooring can round the wrong way depending on the hour.
function daysBetween(a: Date, b: Date): number {
  const floor = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((floor(a) - floor(b)) / (24 * 60 * 60 * 1000));
}

// Nightly. Retired/under_service assets are excluded -- a warranty on
// equipment already pulled from service isn't actionable.
export async function assetWarrantyReminderJob(_args: unknown, context: JobContext): Promise<void> {
  const today = new Date();

  const assets = await context.entities.Asset.findMany({
    where: { status: { in: ["available", "assigned"] }, warranty_end: { not: null } },
  });

  const ruleCache = new Map<string, number[]>();

  for (const asset of assets) {
    const daysToExpiry = daysBetween(asset.warranty_end!, today);

    let reminderDays = ruleCache.get(asset.org_id);
    if (!reminderDays) {
      const rule = await context.entities.NotificationRule.findUnique({
        where: { org_id_rule_type: { org_id: asset.org_id, rule_type: "asset_warranty_expiry" } },
      });
      reminderDays = (rule?.reminder_days as number[] | undefined) ?? DEFAULT_REMINDER_DAYS;
      ruleCache.set(asset.org_id, reminderDays);
    }

    if (!reminderDays.includes(daysToExpiry)) continue;

    const notificationType = `asset_warranty_reminder_${daysToExpiry}d`;
    const alreadySent = await context.entities.NotificationLog.findFirst({
      where: { org_id: asset.org_id, notification_type: notificationType, metadata: { path: ["assetId"], equals: asset.id } },
    });
    if (alreadySent) continue;

    const officeAdmin = await context.entities.User.findFirst({
      where: { org_id: asset.org_id, role: "office_admin" },
    });
    if (officeAdmin?.email) {
      try {
        await sendNotificationEmail({
          to: officeAdmin.email,
          subject: `AddMin: asset warranty expiring in ${daysToExpiry} days`,
          text: `Asset ${asset.id} (${asset.category}) warranty expires in ${daysToExpiry} days.`,
          html: `<p>Asset <code>${asset.id}</code> (${asset.category}) warranty expires in ${daysToExpiry} days.</p>`,
        });
      } catch {
        // A send failure must never block the log record below.
      }
    }

    await context.entities.NotificationLog.create({
      data: {
        org_id: asset.org_id,
        notification_type: notificationType,
        recipient_user_id: officeAdmin?.id ?? null,
        recipient_email: officeAdmin?.email ?? "unknown",
        metadata: { assetId: asset.id },
      },
    });
  }
}
