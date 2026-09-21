-- AlterEnum
ALTER TYPE "ObligationInstanceStatus" ADD VALUE 'waived';

-- AlterTable
ALTER TABLE "ObligationInstance" ADD COLUMN     "waived_at" TIMESTAMP(3),
ADD COLUMN     "waived_by" TEXT,
ADD COLUMN     "waived_remark" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ObligationInstance_schedule_id_period_key" ON "ObligationInstance"("schedule_id", "period");

-- AddForeignKey
ALTER TABLE "ObligationInstance" ADD CONSTRAINT "ObligationInstance_waived_by_fkey" FOREIGN KEY ("waived_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

