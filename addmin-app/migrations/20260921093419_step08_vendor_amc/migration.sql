-- CreateTable
CREATE TABLE "VendorPerformanceReview" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "sla_compliance_pct" DECIMAL(65,30) NOT NULL,
    "response_time_hours" DECIMAL(65,30) NOT NULL,
    "quality_rating" INTEGER NOT NULL,
    "remark" TEXT,
    "reviewed_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPerformanceReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorPerformanceReview_org_id_idx" ON "VendorPerformanceReview"("org_id");

-- AddForeignKey
ALTER TABLE "VendorPerformanceReview" ADD CONSTRAINT "VendorPerformanceReview_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPerformanceReview" ADD CONSTRAINT "VendorPerformanceReview_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
