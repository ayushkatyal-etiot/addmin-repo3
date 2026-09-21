-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('pending', 'approved', 'rejected', 'returned');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authorization_limit" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "UtilityBill" ADD COLUMN     "created_by" TEXT;

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "office_id" TEXT,
    "scope_type" "ObligationScopeType" NOT NULL,
    "tier" INTEGER NOT NULL,
    "max_amount" DECIMAL(65,30),
    "approver_user_id" TEXT NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "payable_type" "PayableType" NOT NULL,
    "payable_id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "approver_user_id" TEXT NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL,
    "remark" TEXT,
    "acted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utility_bill_id" TEXT,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowDefinition_org_id_idx" ON "WorkflowDefinition"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_org_id_office_id_scope_type_tier_key" ON "WorkflowDefinition"("org_id", "office_id", "scope_type", "tier");

-- CreateIndex
CREATE INDEX "ApprovalStep_org_id_idx" ON "ApprovalStep"("org_id");

-- CreateIndex
CREATE INDEX "ApprovalStep_payable_type_payable_id_idx" ON "ApprovalStep"("payable_type", "payable_id");

-- AddForeignKey
ALTER TABLE "UtilityBill" ADD CONSTRAINT "UtilityBill_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_utility_bill_id_fkey" FOREIGN KEY ("utility_bill_id") REFERENCES "UtilityBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
