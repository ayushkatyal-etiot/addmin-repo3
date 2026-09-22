-- AlterTable
ALTER TABLE "ComplianceItem" ADD COLUMN     "escalated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ComplianceDocument" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "compliance_item_id" TEXT NOT NULL,
    "doc_ref" TEXT NOT NULL,
    "expiry_date" DATE NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceDocument_org_id_idx" ON "ComplianceDocument"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceItem_office_id_compliance_type_key" ON "ComplianceItem"("office_id", "compliance_type");

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_compliance_item_id_fkey" FOREIGN KEY ("compliance_item_id") REFERENCES "ComplianceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

