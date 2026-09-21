-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actor_user_id_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actor_platform_operator_id" TEXT,
ALTER COLUMN "actor_user_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "recipient_user_id" TEXT,
    "recipient_email" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationLog_org_id_idx" ON "NotificationLog"("org_id");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_platform_operator_id_fkey" FOREIGN KEY ("actor_platform_operator_id") REFERENCES "PlatformOperator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

