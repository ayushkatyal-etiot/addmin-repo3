import type { PrismaClient } from "@prisma/client";
import { createUser, createProviderId, sanitizeAndSerializeProviderData } from "wasp/server/auth";
import { SEEDED_COMPLIANCE_TYPES } from "../compliance/complianceTypes";

/** Primary demo login — platform_admin, full org access. */
export const DEMO_LOGIN_EMAIL = "abc@test.com";
export const DEMO_LOGIN_PASSWORD = "12345678";

export const DEMO_ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DEMO_OFFICE_HQ = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab";
const DEMO_OFFICE_BRANCH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac";

const DEMO_USER_CHECKER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001";
const DEMO_USER_OFFICE_ADMIN = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002";
const DEMO_USER_PAYMENT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003";
const DEMO_USER_VENDOR = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004";
const DEMO_USER_COMPLIANCE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005";
const DEMO_USER_FACILITY = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb006";
const DEMO_USER_OFFICE_HEAD = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb007";
const DEMO_USER_EMPLOYEE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb008";

const DEMO_VENDOR_ACTIVE = "cccccccc-cccc-cccc-cccc-cccccccccc01";
const DEMO_VENDOR_PENDING = "cccccccc-cccc-cccc-cccc-cccccccccc02";
const DEMO_VENDOR_AMC = "cccccccc-cccc-cccc-cccc-cccccccccc03";
const DEMO_LANDLORD = "dddddddd-dddd-dddd-dddd-dddddddddd01";
const DEMO_LEASE = "dddddddd-dddd-dddd-dddd-dddddddddd02";
const DEMO_UTILITY_ELEC = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01";
const DEMO_UTILITY_WATER = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02";
const DEMO_SCHED_ELEC = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee11";
const DEMO_SCHED_WATER = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12";
const DEMO_SCHED_RENT = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee13";
const DEMO_SCHED_CAM = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee14";
const DEMO_SCHED_AMC = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee15";
const DEMO_OBL_OVERDUE = "ffffffff-ffff-ffff-ffff-ffffffffff01";
const DEMO_OBL_DUE_SOON = "ffffffff-ffff-ffff-ffff-ffffffffff02";
const DEMO_BILL_DRAFT = "11111111-1111-1111-1111-111111111101";
const DEMO_BILL_PENDING = "11111111-1111-1111-1111-111111111102";
const DEMO_BILL_APPROVED = "11111111-1111-1111-1111-111111111103";
const DEMO_BILL_PAID = "11111111-1111-1111-1111-111111111104";
const DEMO_APPROVAL_STEP = "11111111-1111-1111-1111-111111111201";
const DEMO_PAYMENT = "11111111-1111-1111-1111-111111111301";
const DEMO_MAINT_OPEN = "22222222-2222-2222-2222-222222222201";
const DEMO_MAINT_ASSIGNED = "22222222-2222-2222-2222-222222222202";
const DEMO_WO_ACTIVE = "22222222-2222-2222-2222-222222222211";
const DEMO_WO_DONE = "22222222-2222-2222-2222-222222222212";
const DEMO_ASSET_LAPTOP = "33333333-3333-3333-3333-333333333301";
const DEMO_ASSET_MONITOR = "33333333-3333-3333-3333-333333333302";
const DEMO_ASSET_REQ_MGR = "33333333-3333-3333-3333-333333333401";
const DEMO_ASSET_REQ_ALLOC = "33333333-3333-3333-3333-333333333402";
const DEMO_AMC = "44444444-4444-4444-4444-444444444401";
const DEMO_COMPLIANCE_FIRE = "55555555-5555-5555-5555-555555555501";
const DEMO_COMPLIANCE_TRADE = "55555555-5555-5555-5555-555555555502";
const DEMO_COMPLIANCE_DOC = "55555555-5555-5555-5555-555555555601";

const ROLES = [
  "platform_admin",
  "office_admin",
  "checker",
  "payment_authorizer",
  "vendor_manager",
  "compliance_coordinator",
  "facility_staff",
  "office_head",
  "employee",
] as const;

function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return dateOnly(d);
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return dateOnly(d);
}

function officeScope(officeIds: string[], role: string): Record<string, string[]> {
  const scope: Record<string, string[]> = {};
  for (const id of officeIds) scope[id] = [role];
  return scope;
}

async function ensureStaffUser(
  prisma: PrismaClient,
  input: {
    id: string;
    email: string;
    role: (typeof ROLES)[number];
    orgId: string;
    officeIds: string[];
    extra?: { authorization_limit?: number; manager_user_id?: string };
  },
) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      org_id: input.orgId,
      role: input.role,
      office_scope: officeScope(input.officeIds, input.role),
      ...input.extra,
    },
    create: {
      id: input.id,
      org_id: input.orgId,
      email: input.email,
      role: input.role,
      office_scope: officeScope(input.officeIds, input.role),
      ...input.extra,
    },
  });
}

async function ensureDemoLogin(prisma: PrismaClient, orgId: string, officeIds: string[]) {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_LOGIN_EMAIL } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        org_id: orgId,
        role: "platform_admin",
        office_scope: officeScope(officeIds, "platform_admin"),
      },
    });
    return existing;
  }

  const providerData = await sanitizeAndSerializeProviderData({
    hashedPassword: DEMO_LOGIN_PASSWORD,
    isEmailVerified: true,
    emailVerificationSentAt: null,
    passwordResetSentAt: null,
  });
  await createUser(createProviderId("email", DEMO_LOGIN_EMAIL), providerData, {
    email: DEMO_LOGIN_EMAIL,
    role: "platform_admin",
    organization: { connect: { id: orgId } },
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_LOGIN_EMAIL } });
  await prisma.user.update({
    where: { id: user.id },
    data: { office_scope: officeScope(officeIds, "platform_admin") },
  });
  return user;
}

/**
 * Idempotent demo org: offices, users, utilities, leases, vendors, AMC,
 * maintenance, assets, compliance, bills, payments — tuned so abc@test.com
 * sees data on every main screen after `wasp db seed`.
 */
export async function seedDemoOrg(prisma: PrismaClient): Promise<void> {
  const officeIds = [DEMO_OFFICE_HQ, DEMO_OFFICE_BRANCH];

  await prisma.organization.upsert({
    where: { id: DEMO_ORG_ID },
    update: { name: "Demo Organization", default_tds_rate_pct: 10 },
    create: {
      id: DEMO_ORG_ID,
      name: "Demo Organization",
      gstin: "29AABCD1234E1Z5",
      default_currency: "INR",
      timezone: "Asia/Kolkata",
      tenant_status: "active",
      default_tds_rate_pct: 10,
    },
  });

  await prisma.subscription.upsert({
    where: { org_id: DEMO_ORG_ID },
    // trialExpiryJob fires trial_reminder_3d when ≤3 days remain (see runNotificationJobs seed).
    update: { status: "trialing", trial_ends_at: daysFromNow(2) },
    create: {
      org_id: DEMO_ORG_ID,
      plan: "starter",
      status: "trialing",
      trial_ends_at: daysFromNow(2),
    },
  });

  for (const [id, code, name, type, ownership] of [
    [DEMO_OFFICE_HQ, "DEMO-HQ", "Demo HQ — Mumbai", "head_office", "owned"],
    [DEMO_OFFICE_BRANCH, "DEMO-BLR", "Demo Branch — Bengaluru", "branch", "rented"],
  ] as const) {
    await prisma.office.upsert({
      where: { id },
      update: {},
      create: {
        id,
        org_id: DEMO_ORG_ID,
        code,
        name,
        address: `${name} address line`,
        office_type: type,
        ownership_type: ownership,
        setup_status: "active",
      },
    });
    await prisma.officeSetupProfile.upsert({
      where: { office_id: id },
      update: { completion_pct: 100 },
      create: { org_id: DEMO_ORG_ID, office_id: id, completion_pct: 100 },
    });
  }

  await ensureStaffUser(prisma, {
    id: DEMO_USER_CHECKER,
    email: "checker@test.com",
    role: "checker",
    orgId: DEMO_ORG_ID,
    officeIds,
  });
  await ensureStaffUser(prisma, {
    id: DEMO_USER_OFFICE_ADMIN,
    email: "office_admin@test.com",
    role: "office_admin",
    orgId: DEMO_ORG_ID,
    officeIds,
  });
  await ensureStaffUser(prisma, {
    id: DEMO_USER_PAYMENT,
    email: "payment_authorizer@test.com",
    role: "payment_authorizer",
    orgId: DEMO_ORG_ID,
    officeIds,
    extra: { authorization_limit: 500000 },
  });
  await ensureStaffUser(prisma, {
    id: DEMO_USER_VENDOR,
    email: "vendor_manager@test.com",
    role: "vendor_manager",
    orgId: DEMO_ORG_ID,
    officeIds,
  });
  await ensureStaffUser(prisma, {
    id: DEMO_USER_COMPLIANCE,
    email: "compliance_coordinator@test.com",
    role: "compliance_coordinator",
    orgId: DEMO_ORG_ID,
    officeIds,
  });
  await ensureStaffUser(prisma, {
    id: DEMO_USER_FACILITY,
    email: "facility_staff@test.com",
    role: "facility_staff",
    orgId: DEMO_ORG_ID,
    officeIds,
  });
  await ensureStaffUser(prisma, {
    id: DEMO_USER_OFFICE_HEAD,
    email: "office_head@test.com",
    role: "office_head",
    orgId: DEMO_ORG_ID,
    officeIds,
  });
  await ensureStaffUser(prisma, {
    id: DEMO_USER_EMPLOYEE,
    email: "employee@test.com",
    role: "employee",
    orgId: DEMO_ORG_ID,
    officeIds: [DEMO_OFFICE_HQ],
    extra: { manager_user_id: DEMO_USER_OFFICE_ADMIN },
  });

  const demoLogin = await ensureDemoLogin(prisma, DEMO_ORG_ID, officeIds);

  const existingWorkflow = await prisma.workflowDefinition.findFirst({
    where: { org_id: DEMO_ORG_ID, office_id: null, scope_type: "utility", tier: 1 },
  });
  if (!existingWorkflow) {
    await prisma.workflowDefinition.create({
      data: {
        org_id: DEMO_ORG_ID,
        office_id: null,
        scope_type: "utility",
        tier: 1,
        max_amount: null,
        approver_user_id: DEMO_USER_CHECKER,
      },
    });
  } else {
    await prisma.workflowDefinition.update({
      where: { id: existingWorkflow.id },
      data: { approver_user_id: DEMO_USER_CHECKER },
    });
  }

  await prisma.vendor.upsert({
    where: { id: DEMO_VENDOR_ACTIVE },
    update: {},
    create: {
      id: DEMO_VENDOR_ACTIVE,
      org_id: DEMO_ORG_ID,
      name: "Demo Power & Grid Ltd",
      category: "utility_provider",
      pan_gstin: "29AABCU9603R1ZX",
      status: "active",
    },
  });
  await prisma.vendor.upsert({
    where: { id: DEMO_VENDOR_PENDING },
    update: {},
    create: {
      id: DEMO_VENDOR_PENDING,
      org_id: DEMO_ORG_ID,
      name: "Demo DG Maintenance Co",
      category: "dg",
      status: "pending_activation",
    },
  });
  await prisma.vendor.upsert({
    where: { id: DEMO_VENDOR_AMC },
    update: {},
    create: {
      id: DEMO_VENDOR_AMC,
      org_id: DEMO_ORG_ID,
      name: "Demo HVAC AMC Services",
      category: "amc",
      status: "active",
    },
  });

  await prisma.vendorPerformanceReview.upsert({
    where: { id: "cccccccc-cccc-cccc-cccc-cccccccccc99" },
    update: {},
    create: {
      id: "cccccccc-cccc-cccc-cccc-cccccccccc99",
      org_id: DEMO_ORG_ID,
      vendor_id: DEMO_VENDOR_ACTIVE,
      sla_compliance_pct: 92,
      response_time_hours: 4,
      quality_rating: 4,
      remark: "Seed demo review",
      reviewed_by: DEMO_USER_VENDOR,
    },
  });

  await prisma.landlord.upsert({
    where: { id: DEMO_LANDLORD },
    update: {},
    create: {
      id: DEMO_LANDLORD,
      org_id: DEMO_ORG_ID,
      name: "Demo Property Holdings",
      pan: "AABCD1234E",
      bank_details: { account: "1234567890", ifsc: "HDFC0001234" },
      tds_applicable: true,
      tds_rate_pct: 10,
    },
  });

  await prisma.utilityAccount.upsert({
    where: { id: DEMO_UTILITY_ELEC },
    update: {},
    create: {
      id: DEMO_UTILITY_ELEC,
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_HQ,
      utility_type: "electricity",
      provider_name: "Demo Electricity Board",
      meter_account_no: "ELEC-DEMO-001",
      billing_cycle: "monthly",
      vendor_id: DEMO_VENDOR_ACTIVE,
      status: "active",
    },
  });
  await prisma.utilityAccount.upsert({
    where: { id: DEMO_UTILITY_WATER },
    update: {},
    create: {
      id: DEMO_UTILITY_WATER,
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_HQ,
      utility_type: "water",
      provider_name: "Demo Water Corp",
      meter_account_no: "WATER-DEMO-001",
      billing_cycle: "bimonthly",
      status: "active",
    },
  });

  const scheduleStart = monthsAgo(8);
  await prisma.recurringObligationSchedule.upsert({
    where: { id: DEMO_SCHED_ELEC },
    update: { owner_user_id: DEMO_USER_OFFICE_ADMIN },
    create: {
      id: DEMO_SCHED_ELEC,
      org_id: DEMO_ORG_ID,
      scope_type: "utility",
      scope_ref_id: DEMO_UTILITY_ELEC,
      frequency: "monthly",
      expected_window_days: 7,
      due_rule: "Expected by end of billing period.",
      owner_user_id: DEMO_USER_OFFICE_ADMIN,
      active_from: scheduleStart,
    },
  });
  await prisma.recurringObligationSchedule.upsert({
    where: { id: DEMO_SCHED_WATER },
    update: {},
    create: {
      id: DEMO_SCHED_WATER,
      org_id: DEMO_ORG_ID,
      scope_type: "utility",
      scope_ref_id: DEMO_UTILITY_WATER,
      frequency: "bimonthly",
      expected_window_days: 7,
      due_rule: "Expected by end of billing period.",
      owner_user_id: DEMO_USER_OFFICE_ADMIN,
      active_from: scheduleStart,
    },
  });

  await prisma.obligationInstance.upsert({
    where: { schedule_id_period: { schedule_id: DEMO_SCHED_ELEC, period: "2026-07" } },
    update: { status: "missing" },
    create: {
      id: DEMO_OBL_OVERDUE,
      org_id: DEMO_ORG_ID,
      schedule_id: DEMO_SCHED_ELEC,
      period: "2026-07",
      expected_date: daysFromNow(-14),
      status: "missing",
    },
  });
  await prisma.obligationInstance.upsert({
    where: { schedule_id_period: { schedule_id: DEMO_SCHED_ELEC, period: "2026-09" } },
    update: {},
    create: {
      id: DEMO_OBL_DUE_SOON,
      org_id: DEMO_ORG_ID,
      schedule_id: DEMO_SCHED_ELEC,
      period: "2026-09",
      expected_date: daysFromNow(5),
      status: "expected",
    },
  });
  // Triggers missing_bill_alert when runNotificationJobs / missingAlertJob runs.
  await prisma.obligationInstance.upsert({
    where: { schedule_id_period: { schedule_id: DEMO_SCHED_ELEC, period: "2026-08" } },
    update: { status: "expected", expected_date: daysFromNow(-2), linked_ref_id: null, linked_ref_type: null },
    create: {
      id: "ffffffff-ffff-ffff-ffff-ffffffffff03",
      org_id: DEMO_ORG_ID,
      schedule_id: DEMO_SCHED_ELEC,
      period: "2026-08",
      expected_date: daysFromNow(-2),
      status: "expected",
    },
  });

  await prisma.utilityBill.upsert({
    where: { id: DEMO_BILL_DRAFT },
    update: {},
    create: {
      id: DEMO_BILL_DRAFT,
      org_id: DEMO_ORG_ID,
      utility_account_id: DEMO_UTILITY_ELEC,
      billing_period: "2026-08",
      amount: 18500,
      due_date: daysFromNow(20),
      status: "draft",
      created_by: demoLogin.id,
    },
  });
  await prisma.utilityBill.upsert({
    where: { id: DEMO_BILL_PENDING },
    update: {},
    create: {
      id: DEMO_BILL_PENDING,
      org_id: DEMO_ORG_ID,
      utility_account_id: DEMO_UTILITY_ELEC,
      billing_period: "2026-09",
      amount: 19200,
      due_date: daysFromNow(12),
      status: "pending_approval",
      created_by: demoLogin.id,
    },
  });
  await prisma.approvalStep.upsert({
    where: { id: DEMO_APPROVAL_STEP },
    update: { status: "pending" },
    create: {
      id: DEMO_APPROVAL_STEP,
      org_id: DEMO_ORG_ID,
      payable_type: "utility_bill",
      payable_id: DEMO_BILL_PENDING,
      tier: 1,
      approver_user_id: DEMO_USER_CHECKER,
      status: "pending",
      utility_bill_id: DEMO_BILL_PENDING,
    },
  });
  await prisma.utilityBill.upsert({
    where: { id: DEMO_BILL_APPROVED },
    update: { status: "approved" },
    create: {
      id: DEMO_BILL_APPROVED,
      org_id: DEMO_ORG_ID,
      utility_account_id: DEMO_UTILITY_WATER,
      billing_period: "2026-H1",
      amount: 8400,
      due_date: daysFromNow(8),
      status: "approved",
      created_by: demoLogin.id,
    },
  });
  await prisma.utilityBill.upsert({
    where: { id: DEMO_BILL_PAID },
    update: { status: "paid" },
    create: {
      id: DEMO_BILL_PAID,
      org_id: DEMO_ORG_ID,
      utility_account_id: DEMO_UTILITY_ELEC,
      billing_period: "2026-06",
      amount: 17800,
      due_date: daysFromNow(-5),
      status: "paid",
      created_by: demoLogin.id,
    },
  });
  await prisma.payment.upsert({
    where: { id: DEMO_PAYMENT },
    update: {},
    create: {
      id: DEMO_PAYMENT,
      org_id: DEMO_ORG_ID,
      payable_type: "utility_bill",
      payable_id: DEMO_BILL_PAID,
      amount: 17800,
      net_amount: 17800,
      mode: "NEFT",
      status: "paid",
      authorized_by: DEMO_USER_PAYMENT,
      utility_bill_id: DEMO_BILL_PAID,
    },
  });

  const leaseStart = monthsAgo(10);
  const leaseEnd = daysFromNow(30);
  await prisma.lease.upsert({
    where: { id: DEMO_LEASE },
    update: { end_date: leaseEnd, status: "active" },
    create: {
      id: DEMO_LEASE,
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_BRANCH,
      landlord_id: DEMO_LANDLORD,
      start_date: leaseStart,
      end_date: leaseEnd,
      rent_due_anchor_date: leaseStart,
      rent_amount: 250000,
      cam_amount: 15000,
      security_deposit: 500000,
      status: "active",
    },
  });
  await prisma.recurringObligationSchedule.upsert({
    where: { id: DEMO_SCHED_RENT },
    update: {},
    create: {
      id: DEMO_SCHED_RENT,
      org_id: DEMO_ORG_ID,
      scope_type: "rent",
      scope_ref_id: DEMO_LEASE,
      frequency: "monthly",
      expected_window_days: 7,
      due_rule: "Rent due on anchor date.",
      owner_user_id: DEMO_USER_OFFICE_ADMIN,
      active_from: leaseStart,
    },
  });
  await prisma.recurringObligationSchedule.upsert({
    where: { id: DEMO_SCHED_CAM },
    update: {},
    create: {
      id: DEMO_SCHED_CAM,
      org_id: DEMO_ORG_ID,
      scope_type: "cam",
      scope_ref_id: DEMO_LEASE,
      frequency: "monthly",
      expected_window_days: 7,
      due_rule: "CAM due on anchor date.",
      owner_user_id: DEMO_USER_OFFICE_ADMIN,
      active_from: leaseStart,
    },
  });

  await prisma.aMCContract.upsert({
    where: { id: DEMO_AMC },
    update: { end_date: daysFromNow(30), status: "active" },
    create: {
      id: DEMO_AMC,
      org_id: DEMO_ORG_ID,
      vendor_id: DEMO_VENDOR_AMC,
      linked_entity_type: "utility_account",
      linked_entity_id: DEMO_UTILITY_ELEC,
      start_date: monthsAgo(6),
      end_date: daysFromNow(30),
      status: "active",
    },
  });
  await prisma.recurringObligationSchedule.upsert({
    where: { id: DEMO_SCHED_AMC },
    update: {},
    create: {
      id: DEMO_SCHED_AMC,
      org_id: DEMO_ORG_ID,
      scope_type: "amc",
      scope_ref_id: DEMO_AMC,
      frequency: "quarterly",
      expected_window_days: 14,
      due_rule: "AMC service visit each quarter.",
      owner_user_id: DEMO_USER_VENDOR,
      active_from: monthsAgo(6),
    },
  });

  await prisma.maintenanceRequest.upsert({
    where: { id: DEMO_MAINT_OPEN },
    update: {},
    create: {
      id: DEMO_MAINT_OPEN,
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_HQ,
      category: "HVAC",
      priority: "high",
      status: "open",
    },
  });
  await prisma.maintenanceRequest.upsert({
    where: { id: DEMO_MAINT_ASSIGNED },
    update: {},
    create: {
      id: DEMO_MAINT_ASSIGNED,
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_HQ,
      category: "Electrical",
      priority: "medium",
      status: "in_progress",
    },
  });
  await prisma.workOrder.upsert({
    where: { id: DEMO_WO_ACTIVE },
    update: { sla_due_at: daysFromNow(-1) },
    create: {
      id: DEMO_WO_ACTIVE,
      org_id: DEMO_ORG_ID,
      maintenance_request_id: DEMO_MAINT_ASSIGNED,
      vendor_id: DEMO_VENDOR_AMC,
      sla_due_at: daysFromNow(-1),
      status: "in_progress",
    },
  });
  await prisma.maintenanceRequest.upsert({
    where: { id: "22222222-2222-2222-2222-222222222203" },
    update: {},
    create: {
      id: "22222222-2222-2222-2222-222222222203",
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_BRANCH,
      category: "Plumbing",
      priority: "low",
      status: "closed",
    },
  });
  await prisma.workOrder.upsert({
    where: { id: DEMO_WO_DONE },
    update: {},
    create: {
      id: DEMO_WO_DONE,
      org_id: DEMO_ORG_ID,
      maintenance_request_id: "22222222-2222-2222-2222-222222222203",
      vendor_id: DEMO_VENDOR_AMC,
      sla_due_at: daysFromNow(-3),
      status: "verified",
    },
  });
  await prisma.workOrderEvidence.upsert({
    where: { id: "22222222-2222-2222-2222-222222222221" },
    update: {},
    create: {
      id: "22222222-2222-2222-2222-222222222221",
      org_id: DEMO_ORG_ID,
      work_order_id: DEMO_WO_DONE,
      kind: "after",
      doc_ref: "uploads/demo/plumbing-after.jpg",
      comment: "Demo evidence",
      uploaded_by: DEMO_USER_FACILITY,
    },
  });

  await prisma.asset.upsert({
    where: { id: DEMO_ASSET_LAPTOP },
    update: {},
    create: {
      id: DEMO_ASSET_LAPTOP,
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_HQ,
      category: "Laptop",
      serial_no: "DEMO-LAP-100",
      status: "assigned",
      warranty_end: daysFromNow(200),
    },
  });
  await prisma.asset.upsert({
    where: { id: DEMO_ASSET_MONITOR },
    update: { warranty_end: daysFromNow(30) },
    create: {
      id: DEMO_ASSET_MONITOR,
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_HQ,
      category: "Monitor",
      serial_no: "DEMO-MON-200",
      status: "available",
      warranty_end: daysFromNow(30),
    },
  });
  await prisma.assetAssignment.upsert({
    where: { id: "33333333-3333-3333-3333-333333333501" },
    update: {},
    create: {
      id: "33333333-3333-3333-3333-333333333501",
      org_id: DEMO_ORG_ID,
      asset_id: DEMO_ASSET_LAPTOP,
      custodian_user_id: DEMO_USER_EMPLOYEE,
    },
  });

  await prisma.assetRequest.upsert({
    where: { id: DEMO_ASSET_REQ_MGR },
    update: {},
    create: {
      id: DEMO_ASSET_REQ_MGR,
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_HQ,
      requested_by: DEMO_USER_EMPLOYEE,
      category: "Headset",
      reason: "Need for daily calls",
      status: "pending_manager_approval",
    },
  });
  await prisma.assetRequest.upsert({
    where: { id: DEMO_ASSET_REQ_ALLOC },
    update: {},
    create: {
      id: DEMO_ASSET_REQ_ALLOC,
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_HQ,
      requested_by: DEMO_USER_EMPLOYEE,
      category: "Docking station",
      reason: "Hybrid desk setup",
      status: "pending_allocation",
    },
  });

  await prisma.complianceItem.upsert({
    where: { office_id_compliance_type: { office_id: DEMO_OFFICE_HQ, compliance_type: "fire_noc" } },
    update: {},
    create: {
      id: DEMO_COMPLIANCE_FIRE,
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_HQ,
      compliance_type: "fire_noc",
      status: "valid",
      expiry_date: daysFromNow(180),
    },
  });
  await prisma.complianceItem.upsert({
    where: { office_id_compliance_type: { office_id: DEMO_OFFICE_HQ, compliance_type: "trade_license" } },
    update: { status: "expiring", expiry_date: daysFromNow(7) },
    create: {
      id: DEMO_COMPLIANCE_TRADE,
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_HQ,
      compliance_type: "trade_license",
      status: "expiring",
      expiry_date: daysFromNow(7),
    },
  });
  for (const type of SEEDED_COMPLIANCE_TYPES) {
    if (type === "fire_noc" || type === "trade_license") continue;
    await prisma.complianceItem.upsert({
      where: { office_id_compliance_type: { office_id: DEMO_OFFICE_HQ, compliance_type: type } },
      update: {},
      create: {
        org_id: DEMO_ORG_ID,
        office_id: DEMO_OFFICE_HQ,
        compliance_type: type,
        status: type === "pollution_control" ? "missing" : "valid",
        expiry_date: type === "shops_establishment" ? daysFromNow(90) : null,
      },
    });
  }
  await prisma.complianceItem.upsert({
    where: { office_id_compliance_type: { office_id: DEMO_OFFICE_BRANCH, compliance_type: "fire_noc" } },
    update: {},
    create: {
      org_id: DEMO_ORG_ID,
      office_id: DEMO_OFFICE_BRANCH,
      compliance_type: "fire_noc",
      status: "expired",
      expiry_date: daysFromNow(-10),
    },
  });
  await prisma.complianceDocument.upsert({
    where: { id: DEMO_COMPLIANCE_DOC },
    update: {},
    create: {
      id: DEMO_COMPLIANCE_DOC,
      org_id: DEMO_ORG_ID,
      compliance_item_id: DEMO_COMPLIANCE_FIRE,
      doc_ref: "uploads/demo/fire-noc.pdf",
      expiry_date: daysFromNow(180),
      uploaded_by: DEMO_USER_COMPLIANCE,
    },
  });

  for (const [rule_type, reminder_days] of [
    ["lease_renewal", [180, 90, 60, 30]],
    ["amc_renewal", [60, 30]],
    ["compliance_expiry", [30, 7]],
    ["asset_warranty_expiry", [30]],
  ] as const) {
    await prisma.notificationRule.upsert({
      where: { org_id_rule_type: { org_id: DEMO_ORG_ID, rule_type } },
      update: { reminder_days: [...reminder_days] },
      create: { org_id: DEMO_ORG_ID, rule_type, reminder_days: [...reminder_days] },
    });
  }

  for (const row of [
    {
      id: "66666666-6666-6666-6666-666666666601",
      entity_type: "Office",
      entity_id: DEMO_OFFICE_HQ,
      action: "seeded",
      after_value: { note: "Demo HQ sample data" },
    },
    {
      id: "66666666-6666-6666-6666-666666666602",
      entity_type: "UtilityBill",
      entity_id: DEMO_BILL_PENDING,
      action: "submitted_for_approval",
      after_value: { billing_period: "2026-09" },
    },
  ]) {
    await prisma.auditLog.upsert({
      where: { id: row.id },
      update: {},
      create: {
        id: row.id,
        org_id: DEMO_ORG_ID,
        actor_user_id: demoLogin.id,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        action: row.action,
        after_value: row.after_value,
      },
    });
  }

  console.log(
    `\nDemo org seeded (2 offices, full module sample data).\n` +
      `  Login: ${DEMO_LOGIN_EMAIL} / ${DEMO_LOGIN_PASSWORD}\n` +
      `  Office codes: DEMO-HQ, DEMO-BLR\n`,
  );
}
