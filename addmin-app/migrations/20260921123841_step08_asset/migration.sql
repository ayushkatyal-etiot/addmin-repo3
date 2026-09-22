-- CreateEnum
CREATE TYPE "AssetRequestStatus" AS ENUM ('pending_manager_approval', 'rejected', 'returned', 'pending_allocation', 'procurement_pending', 'closed');

-- AlterEnum
ALTER TYPE "NotificationRuleType" ADD VALUE 'asset_warranty_expiry';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "manager_user_id" TEXT;

-- CreateTable
CREATE TABLE "AssetAssignment" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "custodian_user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(3),

    CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetRequest" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "office_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AssetRequestStatus" NOT NULL,
    "manager_remark" TEXT,
    "admin_remark" TEXT,
    "allocated_asset_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetAssignment_org_id_idx" ON "AssetAssignment"("org_id");

-- CreateIndex
CREATE INDEX "AssetRequest_org_id_idx" ON "AssetRequest"("org_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_manager_user_id_fkey" FOREIGN KEY ("manager_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_custodian_user_id_fkey" FOREIGN KEY ("custodian_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequest" ADD CONSTRAINT "AssetRequest_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequest" ADD CONSTRAINT "AssetRequest_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequest" ADD CONSTRAINT "AssetRequest_allocated_asset_id_fkey" FOREIGN KEY ("allocated_asset_id") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
