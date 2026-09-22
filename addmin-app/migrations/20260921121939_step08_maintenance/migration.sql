-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('before', 'after');

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "verification_remark" TEXT;

-- CreateTable
CREATE TABLE "WorkOrderEvidence" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "doc_ref" TEXT NOT NULL,
    "comment" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrderEvidence_org_id_idx" ON "WorkOrderEvidence"("org_id");

-- AddForeignKey
ALTER TABLE "WorkOrderEvidence" ADD CONSTRAINT "WorkOrderEvidence_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderEvidence" ADD CONSTRAINT "WorkOrderEvidence_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
