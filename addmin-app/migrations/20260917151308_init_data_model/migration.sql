-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('platform_admin', 'office_admin', 'checker', 'payment_authorizer', 'vendor_manager', 'compliance_coordinator', 'facility_staff', 'office_head', 'employee');

-- CreateEnum
CREATE TYPE "OrganizationTenantStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('starter', 'growth', 'enterprise');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'expired', 'canceled');

-- CreateEnum
CREATE TYPE "OfficeType" AS ENUM ('head_office', 'regional', 'branch', 'warehouse', 'other');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('owned', 'rented');

-- CreateEnum
CREATE TYPE "OfficeSetupStatus" AS ENUM ('draft', 'setup_incomplete', 'active', 'inactive');

-- CreateEnum
CREATE TYPE "ChecklistCategory" AS ENUM ('utility', 'facility', 'compliance', 'vendor', 'asset', 'role');

-- CreateEnum
CREATE TYPE "ChecklistApplicability" AS ENUM ('yes', 'no', 'not_applicable');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('pending', 'configured', 'complete');

-- CreateEnum
CREATE TYPE "UtilityType" AS ENUM ('electricity', 'water', 'internet', 'telephone', 'gas', 'dg', 'ups', 'solar', 'other');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'bimonthly', 'quarterly');

-- CreateEnum
CREATE TYPE "UtilityAccountStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ObligationScopeType" AS ENUM ('utility', 'rent', 'cam', 'amc', 'compliance');

-- CreateEnum
CREATE TYPE "ObligationFrequency" AS ENUM ('monthly', 'bimonthly', 'quarterly', 'annual');

-- CreateEnum
CREATE TYPE "ObligationInstanceStatus" AS ENUM ('expected', 'received', 'missing', 'in_process', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "UtilityBillStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'partially_paid', 'paid', 'overdue');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('draft', 'active', 'expiring', 'renewed', 'terminated');

-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('utility_provider', 'dg', 'ups', 'solar', 'amc', 'building_mgmt', 'other');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('pending_activation', 'active', 'suspended', 'inactive');

-- CreateEnum
CREATE TYPE "AMCContractStatus" AS ENUM ('active', 'due_for_renewal', 'expired', 'closed');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "MaintenanceRequestStatus" AS ENUM ('open', 'assigned', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('assigned', 'in_progress', 'completed', 'verified');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('available', 'assigned', 'under_service', 'retired');

-- CreateEnum
CREATE TYPE "ComplianceItemStatus" AS ENUM ('missing', 'valid', 'expiring', 'expired', 'not_applicable');

-- CreateEnum
CREATE TYPE "PayableType" AS ENUM ('utility_bill', 'rent', 'cam', 'vendor');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'initiated', 'paid', 'failed', 'partially_paid', 'overdue');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT,
ADD COLUMN     "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "office_scope" JSONB,
ADD COLUMN     "org_id" TEXT,
ADD COLUMN     "role" "UserRole";

-- CreateTable
CREATE TABLE "PlatformOperator" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformOperator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "default_currency" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "tenant_status" "OrganizationTenantStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "billing_provider_customer_id" TEXT,
    "billing_provider_subscription_id" TEXT,
    "activated_at" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "office_type" "OfficeType" NOT NULL,
    "ownership_type" "OwnershipType" NOT NULL,
    "setup_status" "OfficeSetupStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeSetupProfile" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "office_id" TEXT NOT NULL,
    "completion_pct" DECIMAL(65,30) NOT NULL,
    "activated_at" TIMESTAMP(3),
    "activated_by" TEXT,

    CONSTRAINT "OfficeSetupProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeChecklistItem" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "office_id" TEXT NOT NULL,
    "office_setup_profile_id" TEXT,
    "template_item_code" TEXT NOT NULL,
    "category" "ChecklistCategory" NOT NULL,
    "applicability" "ChecklistApplicability" NOT NULL,
    "status" "ChecklistItemStatus" NOT NULL,
    "owner_user_id" TEXT,
    "linked_entity_type" TEXT,
    "linked_entity_id" TEXT,

    CONSTRAINT "OfficeChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityAccount" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "office_id" TEXT NOT NULL,
    "utility_type" "UtilityType" NOT NULL,
    "provider_name" TEXT NOT NULL,
    "meter_account_no" TEXT NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL,
    "vendor_id" TEXT,
    "status" "UtilityAccountStatus" NOT NULL,

    CONSTRAINT "UtilityAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringObligationSchedule" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "scope_type" "ObligationScopeType" NOT NULL,
    "scope_ref_id" TEXT NOT NULL,
    "frequency" "ObligationFrequency" NOT NULL,
    "expected_window_days" INTEGER NOT NULL,
    "due_rule" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "active_from" DATE NOT NULL,
    "active_to" DATE,

    CONSTRAINT "RecurringObligationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObligationInstance" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "expected_date" DATE NOT NULL,
    "due_date" DATE,
    "status" "ObligationInstanceStatus" NOT NULL,
    "linked_ref_type" TEXT,
    "linked_ref_id" TEXT,

    CONSTRAINT "ObligationInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityBill" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "utility_account_id" TEXT NOT NULL,
    "obligation_instance_id" TEXT,
    "billing_period" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "UtilityBillStatus" NOT NULL,
    "invoice_doc_id" TEXT,

    CONSTRAINT "UtilityBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "office_id" TEXT NOT NULL,
    "landlord_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "rent_amount" DECIMAL(65,30) NOT NULL,
    "cam_amount" DECIMAL(65,30),
    "security_deposit" DECIMAL(65,30),
    "escalation_pct" DECIMAL(65,30),
    "status" "LeaseStatus" NOT NULL,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Landlord" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pan" TEXT,
    "bank_details" JSONB NOT NULL,

    CONSTRAINT "Landlord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "pan_gstin" TEXT,
    "status" "VendorStatus" NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AMCContract" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "linked_entity_type" TEXT NOT NULL,
    "linked_entity_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "AMCContractStatus" NOT NULL,

    CONSTRAINT "AMCContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "office_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" "MaintenancePriority" NOT NULL,
    "status" "MaintenanceRequestStatus" NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "maintenance_request_id" TEXT NOT NULL,
    "vendor_id" TEXT,
    "sla_due_at" TIMESTAMP(3) NOT NULL,
    "status" "WorkOrderStatus" NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "office_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "serial_no" TEXT,
    "status" "AssetStatus" NOT NULL,
    "warranty_end" DATE,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceItem" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "office_id" TEXT NOT NULL,
    "compliance_type" TEXT NOT NULL,
    "status" "ComplianceItemStatus" NOT NULL,
    "expiry_date" DATE,
    "document_id" TEXT,

    CONSTRAINT "ComplianceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "payable_type" "PayableType" NOT NULL,
    "payable_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "tds_amount" DECIMAL(65,30),
    "net_amount" DECIMAL(65,30) NOT NULL,
    "mode" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "authorized_by" TEXT,
    "utility_bill_id" TEXT,
    "lease_id" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_value" JSONB,
    "after_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformOperator_email_key" ON "PlatformOperator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_org_id_key" ON "Subscription"("org_id");

-- CreateIndex
CREATE INDEX "Subscription_org_id_idx" ON "Subscription"("org_id");

-- CreateIndex
CREATE INDEX "Office_org_id_idx" ON "Office"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeSetupProfile_office_id_key" ON "OfficeSetupProfile"("office_id");

-- CreateIndex
CREATE INDEX "OfficeSetupProfile_org_id_idx" ON "OfficeSetupProfile"("org_id");

-- CreateIndex
CREATE INDEX "OfficeChecklistItem_org_id_idx" ON "OfficeChecklistItem"("org_id");

-- CreateIndex
CREATE INDEX "UtilityAccount_org_id_idx" ON "UtilityAccount"("org_id");

-- CreateIndex
CREATE INDEX "RecurringObligationSchedule_org_id_idx" ON "RecurringObligationSchedule"("org_id");

-- CreateIndex
CREATE INDEX "RecurringObligationSchedule_scope_type_scope_ref_id_idx" ON "RecurringObligationSchedule"("scope_type", "scope_ref_id");

-- CreateIndex
CREATE INDEX "ObligationInstance_org_id_idx" ON "ObligationInstance"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "UtilityBill_obligation_instance_id_key" ON "UtilityBill"("obligation_instance_id");

-- CreateIndex
CREATE INDEX "UtilityBill_org_id_idx" ON "UtilityBill"("org_id");

-- CreateIndex
CREATE INDEX "Lease_org_id_idx" ON "Lease"("org_id");

-- CreateIndex
CREATE INDEX "Landlord_org_id_idx" ON "Landlord"("org_id");

-- CreateIndex
CREATE INDEX "Vendor_org_id_idx" ON "Vendor"("org_id");

-- CreateIndex
CREATE INDEX "AMCContract_org_id_idx" ON "AMCContract"("org_id");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_org_id_idx" ON "MaintenanceRequest"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_maintenance_request_id_key" ON "WorkOrder"("maintenance_request_id");

-- CreateIndex
CREATE INDEX "WorkOrder_org_id_idx" ON "WorkOrder"("org_id");

-- CreateIndex
CREATE INDEX "Asset_org_id_idx" ON "Asset"("org_id");

-- CreateIndex
CREATE INDEX "ComplianceItem_org_id_idx" ON "ComplianceItem"("org_id");

-- CreateIndex
CREATE INDEX "Payment_org_id_idx" ON "Payment"("org_id");

-- CreateIndex
CREATE INDEX "AuditLog_org_id_idx" ON "AuditLog"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_org_id_idx" ON "User"("org_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSetupProfile" ADD CONSTRAINT "OfficeSetupProfile_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSetupProfile" ADD CONSTRAINT "OfficeSetupProfile_activated_by_fkey" FOREIGN KEY ("activated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeChecklistItem" ADD CONSTRAINT "OfficeChecklistItem_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeChecklistItem" ADD CONSTRAINT "OfficeChecklistItem_office_setup_profile_id_fkey" FOREIGN KEY ("office_setup_profile_id") REFERENCES "OfficeSetupProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeChecklistItem" ADD CONSTRAINT "OfficeChecklistItem_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityAccount" ADD CONSTRAINT "UtilityAccount_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityAccount" ADD CONSTRAINT "UtilityAccount_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringObligationSchedule" ADD CONSTRAINT "RecurringObligationSchedule_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationInstance" ADD CONSTRAINT "ObligationInstance_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "RecurringObligationSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityBill" ADD CONSTRAINT "UtilityBill_utility_account_id_fkey" FOREIGN KEY ("utility_account_id") REFERENCES "UtilityAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityBill" ADD CONSTRAINT "UtilityBill_obligation_instance_id_fkey" FOREIGN KEY ("obligation_instance_id") REFERENCES "ObligationInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "Landlord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Landlord" ADD CONSTRAINT "Landlord_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMCContract" ADD CONSTRAINT "AMCContract_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_maintenance_request_id_fkey" FOREIGN KEY ("maintenance_request_id") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItem" ADD CONSTRAINT "ComplianceItem_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_utility_bill_id_fkey" FOREIGN KEY ("utility_bill_id") REFERENCES "UtilityBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

