import { app, api, action, job, page, query, route } from "@wasp.sh/spec";
import { App } from "./src/App" with { type: "ref" };
import { EmailVerificationPage } from "./src/auth/email/EmailVerificationPage" with { type: "ref" };
import { LoginPage } from "./src/auth/email/LoginPage" with { type: "ref" };
import { PasswordResetPage } from "./src/auth/email/PasswordResetPage" with { type: "ref" };
import { RequestPasswordResetPage } from "./src/auth/email/RequestPasswordResetPage" with { type: "ref" };
import { SignupPage } from "./src/auth/email/SignupPage" with { type: "ref" };
import { userSignupFields } from "./src/auth/email/userSignupFields" with { type: "ref" };
import { MfaSetupPage } from "./src/auth/mfa/MfaSetupPage" with { type: "ref" };
import { MfaVerifyPage } from "./src/auth/mfa/MfaVerifyPage" with { type: "ref" };
import { PlatformSigninPage } from "./src/platform/PlatformSigninPage" with { type: "ref" };
import { HomePage } from "./src/HomePage" with { type: "ref" };
import { seedDevData, runObligationJobs } from "./src/server/seed" with { type: "ref" };
import {
  getMfaStatus,
  enrollMfa,
  confirmMfaEnrollment,
  verifyMfaLogin,
} from "./src/server/auth/operations" with { type: "ref" };
import { inviteUser } from "./src/server/admin/invites" with { type: "ref" };
import {
  platformLogin,
  platformLogout,
  platformMe,
  platformCorsMiddlewareConfigFn,
} from "./src/server/platform/platformAuth" with { type: "ref" };
import {
  updateOrganizationProfile,
  createOffice,
  bulkImportOffices,
  listOffices,
  getOffice,
  listOrgUsers,
  updateUserOffice,
} from "./src/server/organization/office" with { type: "ref" };
import { getOfficeChecklist, updateChecklistItem } from "./src/server/onboarding/checklist" with { type: "ref" };
import { activateOffice } from "./src/server/onboarding/activation" with { type: "ref" };
import { OnboardingPage } from "./src/client/onboarding/OnboardingPage" with { type: "ref" };
import { OfficeListPage } from "./src/client/offices/OfficeListPage" with { type: "ref" };
import { NewOfficePage } from "./src/client/offices/NewOfficePage" with { type: "ref" };
import { OfficeSetupPage } from "./src/client/offices/OfficeSetupPage" with { type: "ref" };
import { getSubscription, subscribeToPlan } from "./src/server/billing/subscription" with { type: "ref" };
import {
  paymentsWebhook,
  paymentsWebhookMiddlewareConfigFn,
} from "./src/server/billing/webhook" with { type: "ref" };
import { trialExpiryJob } from "./src/server/billing/trialExpiryJob" with { type: "ref" };
import {
  listOrganizationsInternal,
  setTenantStatusInternal,
  setSubscriptionInternal,
} from "./src/server/platform/console" with { type: "ref" };
import { SubscribePage } from "./src/client/billing/SubscribePage" with { type: "ref" };
import { OrgListPage } from "./src/platform/OrgListPage" with { type: "ref" };
import { OrgDetailPage } from "./src/platform/OrgDetailPage" with { type: "ref" };
import {
  createUtilityAccount,
  listUtilityAccounts,
  getUtilityAccount,
  deactivateUtilityAccount,
} from "./src/server/utility/account" with { type: "ref" };
import { waiveMissingItem } from "./src/server/obligation/waive" with { type: "ref" };
import { obligationGenerationJob } from "./src/server/obligation/generationJob" with { type: "ref" };
import { missingAlertJob } from "./src/server/obligation/missingAlertJob" with { type: "ref" };
import { UtilitiesListPage } from "./src/client/utilities/UtilitiesListPage" with { type: "ref" };
import { NewUtilityAccountPage } from "./src/client/utilities/NewUtilityAccountPage" with { type: "ref" };
import { UtilityAccountDetailPage } from "./src/client/utilities/UtilityAccountDetailPage" with { type: "ref" };
import {
  createUtilityBill,
  updateUtilityBill,
  submitUtilityBill,
  listUtilityBills,
  getUtilityBill,
} from "./src/server/utility/bill" with { type: "ref" };
import {
  approveUtilityBill,
  listApprovalQueue,
  createWorkflowDefinition,
  listWorkflowDefinitions,
  deleteWorkflowDefinition,
} from "./src/server/workflow/approval" with { type: "ref" };
import { recordPayment } from "./src/server/payment/payment" with { type: "ref" };
import { overdueBillsJob } from "./src/server/payment/overdueJob" with { type: "ref" };
import { BillsListPage } from "./src/client/bills/BillsListPage" with { type: "ref" };
import { NewBillPage } from "./src/client/bills/NewBillPage" with { type: "ref" };
import { BillDetailPage } from "./src/client/bills/BillDetailPage" with { type: "ref" };
import { ApprovalQueuePage } from "./src/client/approvals/ApprovalQueuePage" with { type: "ref" };
import { PaymentsPage } from "./src/client/payments/PaymentsPage" with { type: "ref" };
import { WorkflowAdminPage } from "./src/client/workflow/WorkflowAdminPage" with { type: "ref" };
import { UsersPage } from "./src/client/admin/UsersPage" with { type: "ref" };
import { createLandlord, listLandlords } from "./src/server/property/landlord" with { type: "ref" };
import {
  createLease,
  listLeases,
  getLease,
  terminateLease,
} from "./src/server/property/lease" with { type: "ref" };
import { recordRentPayment, listRentPayments } from "./src/server/property/rentPayment" with { type: "ref" };
import { leaseRenewalReminderJob, leaseEscalationJob } from "./src/server/property/leaseJobs" with { type: "ref" };
import { LeaseListPage } from "./src/client/property/LeaseListPage" with { type: "ref" };
import { LeaseWizard } from "./src/client/property/LeaseWizard" with { type: "ref" };
import { LeaseDetailPage } from "./src/client/property/LeaseDetailPage" with { type: "ref" };
import {
  createVendor,
  listVendors,
  getVendor,
  activateVendor,
  recordVendorPerformanceReview,
} from "./src/server/vendor/vendor" with { type: "ref" };
import { createAmcContract, listAmcContracts, closeAmcContract } from "./src/server/vendor/amc" with { type: "ref" };
import { amcRenewalJob } from "./src/server/vendor/amcJob" with { type: "ref" };
import { VendorListPage } from "./src/client/vendors/VendorListPage" with { type: "ref" };
import { VendorDetailPage } from "./src/client/vendors/VendorDetailPage" with { type: "ref" };

// Build Step 01/02/03/04/05/06/07 (planmysaas-blueprint/08-build-playbook.md):
// repo bootstrap, data layer, auth/RBAC/Platform Operator identity,
// onboarding, billing & subscription, Obligation Engine (utility core).
// Domain query/action/job declarations for each remaining module land here
// in later steps, grouped by module in the same order as 04-architecture.md's
// API surface table.

export default app({
  name: "addminApp",
  wasp: { version: "^0.25.0" },
  title: "AddMin",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  db: {
    seeds: [seedDevData, runObligationJobs],
  },
  auth: {
    userEntity: "User",
    methods: {
      email: {
        fromField: {
          name: "AddMin",
          email: "ayush.katyal@etiot.in",
        },
        userSignupFields,
        emailVerification: {
          clientRoute: "EmailVerificationRoute",
        },
        passwordReset: {
          clientRoute: "PasswordResetRoute",
        },
      },
    },
    onAuthSucceededRedirectTo: "/",
    onAuthFailedRedirectTo: "/login",
  },
  emailSender: {
    provider: "SendGrid",
    defaultFrom: {
      name: "AddMin",
      email: "ayush.katyal@etiot.in",
    },
  },
  client: {
    rootComponent: App,
  },
  spec: [
    route("HomeRoute", "/", page(HomePage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
    route(
      "RequestPasswordResetRoute",
      "/request-password-reset",
      page(RequestPasswordResetPage),
    ),
    route("PasswordResetRoute", "/password-reset", page(PasswordResetPage)),
    route(
      "EmailVerificationRoute",
      "/email-verification",
      page(EmailVerificationPage),
    ),
    route("MfaSetupRoute", "/mfa-setup", page(MfaSetupPage, { authRequired: true })),
    route("MfaVerifyRoute", "/mfa-verify", page(MfaVerifyPage, { authRequired: true })),
    route("AdminUsersRoute", "/admin/users", page(UsersPage, { authRequired: true })),

    // Identity & Access Module (04-architecture.md) -- MFA + invites.
    query(getMfaStatus, { entities: ["User"] }),
    action(enrollMfa, { entities: ["User"] }),
    action(confirmMfaEnrollment, { entities: ["User"] }),
    action(verifyMfaLogin, { entities: ["User"] }),
    action(inviteUser, { entities: ["User", "Invite", "Office", "AuditLog"] }),

    // Platform Operations Module (04-architecture.md, F-20) -- deliberately
    // raw api routes, not typed operations: PlatformOperator never flows
    // through Wasp's auth `context.user`. See src/server/platform/platformAuth.ts.
    route("PlatformSigninRoute", "/platform/signin", page(PlatformSigninPage)),
    api("ALL", "/platform/login", platformLogin, {
      entities: ["PlatformOperator"],
      auth: false,
      middlewareConfigFn: platformCorsMiddlewareConfigFn,
    }),
    api("ALL", "/platform/logout", platformLogout, {
      auth: false,
      middlewareConfigFn: platformCorsMiddlewareConfigFn,
    }),
    api("ALL", "/platform/me", platformMe, {
      entities: ["PlatformOperator"],
      auth: false,
      middlewareConfigFn: platformCorsMiddlewareConfigFn,
    }),
    route("PlatformOrgListRoute", "/platform/organizations", page(OrgListPage)),
    route("PlatformOrgDetailRoute", "/platform/organizations/:orgId", page(OrgDetailPage)),
    api("ALL", "/platform/organizations", listOrganizationsInternal, {
      entities: ["PlatformOperator", "Organization"],
      auth: false,
      middlewareConfigFn: platformCorsMiddlewareConfigFn,
    }),
    api("ALL", "/platform/organizations/:orgId/tenant-status", setTenantStatusInternal, {
      entities: ["PlatformOperator", "Organization", "AuditLog"],
      auth: false,
      middlewareConfigFn: platformCorsMiddlewareConfigFn,
    }),
    api("ALL", "/platform/organizations/:orgId/subscription", setSubscriptionInternal, {
      entities: ["PlatformOperator", "Subscription", "AuditLog"],
      auth: false,
      middlewareConfigFn: platformCorsMiddlewareConfigFn,
    }),

    // Organization & Office Module + Onboarding Module (04-architecture.md,
    // Build Step 04) -- F-03, F-04, F-05.
    route("OnboardingRoute", "/app/onboarding", page(OnboardingPage, { authRequired: true })),
    route("OfficesRoute", "/app/offices", page(OfficeListPage, { authRequired: true })),
    route("NewOfficeRoute", "/app/offices/new", page(NewOfficePage, { authRequired: true })),
    route("OfficeSetupRoute", "/app/offices/:officeId/setup", page(OfficeSetupPage, { authRequired: true })),
    action(updateOrganizationProfile, { entities: ["Organization", "AuditLog"] }),
    action(createOffice, { entities: ["Office", "OfficeSetupProfile", "OfficeChecklistItem", "AuditLog"] }),
    action(bulkImportOffices, { entities: ["Office", "OfficeSetupProfile", "OfficeChecklistItem", "AuditLog"] }),
    query(listOffices, { entities: ["Office", "AuditLog"] }),
    query(getOffice, { entities: ["Office", "AuditLog"] }),
    query(listOrgUsers, { entities: ["User", "AuditLog"] }),
    action(updateUserOffice, { entities: ["User", "Office", "AuditLog"] }),
    query(getOfficeChecklist, {
      entities: ["Office", "OfficeSetupProfile", "OfficeChecklistItem", "AuditLog"],
    }),
    action(updateChecklistItem, {
      entities: ["OfficeChecklistItem", "OfficeSetupProfile", "User", "AuditLog"],
    }),
    action(activateOffice, { entities: ["Office", "OfficeSetupProfile", "OfficeChecklistItem", "AuditLog"] }),

    // Billing & Subscription Module (04-architecture.md, Build Step 05) -- F-19.
    route("SubscribeRoute", "/app/subscribe", page(SubscribePage, { authRequired: true })),
    query(getSubscription, { entities: ["Subscription"] }),
    action(subscribeToPlan, { entities: ["Subscription", "AuditLog"] }),
    // Raw api route, not a query/action: Stripe calls this unauthenticated,
    // and it needs the raw request body for signature verification (see
    // src/server/billing/webhook.ts's file header).
    api("POST", "/payments-webhook", paymentsWebhook, {
      entities: ["Subscription", "AuditLog"],
      auth: false,
      middlewareConfigFn: paymentsWebhookMiddlewareConfigFn,
    }),
    job(trialExpiryJob, {
      executor: "PgBoss",
      entities: ["Subscription", "NotificationLog", "AuditLog", "User"],
      schedule: { cron: "0 2 * * *" }, // nightly at 02:00
    }),

    // Utility Module + Obligation Engine (04-architecture.md, Build Step 06) -- F-06, F-07, F-08.
    route("UtilitiesRoute", "/app/utilities", page(UtilitiesListPage, { authRequired: true })),
    route("NewUtilityAccountRoute", "/app/utilities/new", page(NewUtilityAccountPage, { authRequired: true })),
    route("UtilityAccountDetailRoute", "/app/utilities/:accountId", page(UtilityAccountDetailPage, { authRequired: true })),
    action(createUtilityAccount, {
      entities: ["Office", "UtilityAccount", "RecurringObligationSchedule", "AuditLog"],
    }),
    query(listUtilityAccounts, { entities: ["UtilityAccount", "AuditLog"] }),
    query(getUtilityAccount, {
      entities: ["UtilityAccount", "RecurringObligationSchedule", "ObligationInstance", "UtilityBill", "AuditLog"],
    }),
    action(deactivateUtilityAccount, {
      entities: ["UtilityAccount", "RecurringObligationSchedule", "AuditLog"],
    }),
    action(waiveMissingItem, { entities: ["ObligationInstance", "AuditLog"] }),
    job(obligationGenerationJob, {
      executor: "PgBoss",
      entities: ["RecurringObligationSchedule", "ObligationInstance"],
      schedule: { cron: "0 3 * * *" }, // nightly at 03:00, after trial-expiry
    }),
    job(missingAlertJob, {
      executor: "PgBoss",
      entities: ["ObligationInstance", "RecurringObligationSchedule", "UtilityAccount", "NotificationLog", "User"],
      schedule: { cron: "30 3 * * *" }, // nightly at 03:30, after generation
    }),

    // Workflow & Approval Module + Bill lifecycle + Payment Module
    // (04-architecture.md, Build Step 07) -- F-09, F-10, F-11.
    route("BillsRoute", "/app/bills", page(BillsListPage, { authRequired: true })),
    route("NewBillRoute", "/app/bills/new", page(NewBillPage, { authRequired: true })),
    route("BillDetailRoute", "/app/bills/:billId", page(BillDetailPage, { authRequired: true })),
    route("ApprovalsRoute", "/app/approvals", page(ApprovalQueuePage, { authRequired: true })),
    route("PaymentsRoute", "/app/payments", page(PaymentsPage, { authRequired: true })),
    route("WorkflowAdminRoute", "/admin/workflow", page(WorkflowAdminPage, { authRequired: true })),
    action(createUtilityBill, {
      entities: ["UtilityAccount", "UtilityBill", "RecurringObligationSchedule", "ObligationInstance", "AuditLog"],
    }),
    action(updateUtilityBill, { entities: ["UtilityBill", "AuditLog"] }),
    action(submitUtilityBill, {
      entities: ["UtilityBill", "UtilityAccount", "WorkflowDefinition", "ApprovalStep", "AuditLog"],
    }),
    query(listUtilityBills, { entities: ["UtilityBill", "AuditLog"] }),
    query(getUtilityBill, { entities: ["UtilityBill", "AuditLog"] }),
    action(approveUtilityBill, { entities: ["UtilityBill", "ApprovalStep", "AuditLog"] }),
    query(listApprovalQueue, { entities: ["ApprovalStep", "AuditLog"] }),
    action(createWorkflowDefinition, { entities: ["User", "WorkflowDefinition", "AuditLog"] }),
    query(listWorkflowDefinitions, { entities: ["WorkflowDefinition", "AuditLog"] }),
    action(deleteWorkflowDefinition, { entities: ["WorkflowDefinition", "AuditLog"] }),
    action(recordPayment, {
      entities: ["UtilityBill", "Payment", "ObligationInstance", "RecurringObligationSchedule", "AuditLog"],
    }),
    job(overdueBillsJob, {
      executor: "PgBoss",
      entities: ["UtilityBill"],
      schedule: { cron: "0 4 * * *" }, // nightly at 04:00, after missing-alert
    }),

    // Property & Lease Module (04-architecture.md, Build Step 08) -- F-12, F-13.
    route("LeasesRoute", "/app/property/leases", page(LeaseListPage, { authRequired: true })),
    route("NewLeaseRoute", "/app/property/leases/new", page(LeaseWizard, { authRequired: true })),
    route("LeaseDetailRoute", "/app/property/leases/:leaseId", page(LeaseDetailPage, { authRequired: true })),
    action(createLandlord, { entities: ["Landlord", "AuditLog"] }),
    query(listLandlords, { entities: ["Landlord", "AuditLog"] }),
    action(createLease, {
      entities: ["Office", "Landlord", "Lease", "RecurringObligationSchedule", "AuditLog"],
    }),
    query(listLeases, { entities: ["Lease", "AuditLog"] }),
    query(getLease, {
      entities: ["Lease", "RecurringObligationSchedule", "ObligationInstance", "Payment", "AuditLog"],
    }),
    action(terminateLease, {
      entities: ["Lease", "RecurringObligationSchedule", "ObligationInstance", "AuditLog"],
    }),
    action(recordRentPayment, {
      entities: [
        "Lease",
        "Organization",
        "Payment",
        "AuditLog",
        "RecurringObligationSchedule",
        "ObligationInstance",
      ],
    }),
    query(listRentPayments, { entities: ["Lease", "Payment", "AuditLog"] }),
    job(leaseRenewalReminderJob, {
      executor: "PgBoss",
      entities: ["Lease", "NotificationRule", "NotificationLog", "User"],
      schedule: { cron: "0 5 * * *" }, // nightly at 05:00
    }),
    job(leaseEscalationJob, {
      executor: "PgBoss",
      entities: ["Lease"],
      schedule: { cron: "15 5 * * *" }, // nightly at 05:15, after renewal reminders
    }),

    // Vendor Module (04-architecture.md, Build Step 08) -- F-14.
    route("VendorsRoute", "/app/vendors", page(VendorListPage, { authRequired: true })),
    route("VendorDetailRoute", "/app/vendors/:vendorId", page(VendorDetailPage, { authRequired: true })),
    action(createVendor, { entities: ["Vendor", "AuditLog"] }),
    query(listVendors, { entities: ["Vendor", "AuditLog"] }),
    query(getVendor, { entities: ["Vendor", "AuditLog"] }),
    action(activateVendor, { entities: ["Vendor", "AuditLog"] }),
    action(recordVendorPerformanceReview, { entities: ["Vendor", "VendorPerformanceReview", "AuditLog"] }),
    action(createAmcContract, {
      entities: ["Vendor", "Office", "UtilityAccount", "AMCContract", "RecurringObligationSchedule", "AuditLog"],
    }),
    query(listAmcContracts, { entities: ["AMCContract", "AuditLog"] }),
    action(closeAmcContract, {
      entities: ["AMCContract", "RecurringObligationSchedule", "AuditLog"],
    }),
    job(amcRenewalJob, {
      executor: "PgBoss",
      entities: ["AMCContract", "NotificationRule", "NotificationLog", "User"],
      schedule: { cron: "30 5 * * *" }, // nightly at 05:30, after lease jobs
    }),
  ],
});
