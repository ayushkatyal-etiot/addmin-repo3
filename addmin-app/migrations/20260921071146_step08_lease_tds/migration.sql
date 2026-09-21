-- CreateEnum
CREATE TYPE "NotificationRuleType" AS ENUM ('lease_renewal', 'amc_renewal', 'compliance_expiry');

-- AlterTable
ALTER TABLE "Landlord" ADD COLUMN     "tds_applicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tds_rate_pct" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "escalation_applied_at" TIMESTAMP(3),
ADD COLUMN     "escalation_effective_date" DATE,
ADD COLUMN     "security_deposit_refunded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "default_tds_rate_pct" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "period" TEXT;

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "rule_type" "NotificationRuleType" NOT NULL,
    "reminder_days" JSONB NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationRule_org_id_idx" ON "NotificationRule"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRule_org_id_rule_type_key" ON "NotificationRule"("org_id", "rule_type");
