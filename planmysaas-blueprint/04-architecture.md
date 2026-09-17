# System architecture — AddMin

Scoped to the P0 release (Onboarding, Billing & Subscription, Utility Management, Property/Lease, Facilities/Maintenance, Assets, Vendors, Compliance, Workflow/RBAC, Reports) for a single-organization tenant model. The Epic 0 multi-level Group tenancy (customer-side multi-org hierarchy, Group Super Admin, Membership abstraction) is deliberately deferred per `03-analysis.md` — the data model below reserves an `org_id` on every table so that layer can be added later without a schema rewrite. A separate, much smaller piece of Epic 0 — a lightweight, AddMin-internal Platform Operator console — *is* in scope; see the Platform Operations Module and `PlatformOperator` entity below.

## Containers (top-level)

- **Web App** — Next.js app serving the Admin/Finance/Checker/Vendor Manager/Compliance Coordinator/Office Head web experience (onboarding wizard, dashboards, approval queues). Tech: Next.js 14 App Router. External integrations: none directly — calls the API layer.
- **API Backend** — REST API enforcing RBAC/office-scope/segregation-of-duties server-side, owns all business logic and the Recurring Obligation Engine. Tech: Node.js (NestJS) + Prisma. External integrations: email provider, SMS provider (optional), object storage, payment gateway (P1 only).
- **Worker Service** — Background job runner for obligation-instance generation, reminders/escalations, and report aggregation. Tech: BullMQ + Redis. External integrations: email/SMS provider.
- **Mobile App (P1)** — Field app for Facility Staff (maintenance tasks, photo/video evidence, offline capture). Tech: React Native. External integrations: API Backend only, with offline sync queue.
- **Platform Ops Console** — Internal-only web app for AddMin's own team (Platform Operators): list every customer Organization, view its Subscription/tenant status, and manually activate/suspend one (F-20). Not reachable by any customer role, not linked from the customer Web App. Tech: same Next.js 14 app as the Web App, mounted at a separate `/platform` route tree with its own login. External integrations: none directly — calls the API layer's `/internal/*` endpoints.

## Services (10-25 microservices or modules)

Modules within the single API Backend (modular monolith, not microservices, per P0 team-size reality):

- **Identity & Access Module** — service — Authenticates users, issues sessions, enforces MFA for admin roles. Owns: User, Session, Role, RoleAssignment. Talks to: Audit Module, Notification Module.
- **Organization & Office Module** — service — Manages org/office/building/floor hierarchy and office scope. Owns: Organization, Office, Building, Floor. Talks to: Identity & Access Module, Onboarding Module.
- **Onboarding Module** — service — Drives the guided setup checklist and setup-completion %. Owns: OfficeSetupProfile, OfficeChecklistTemplate, OfficeChecklistItem. Talks to: Organization & Office Module, Utility Module, Facility Module, Compliance Module.
- **Billing & Subscription Module** — service — AddMin's own SaaS billing: trial lifecycle, plan selection, and subscription status that gates continued access after trial expiry. Owns: Subscription, Plan, BillingEvent. Talks to: Identity & Access Module (post-signup trial start), Notification Module (trial reminders), external Billing Provider. Deliberately separate from the Payment Module below — this is revenue AddMin collects from the customer organization, never to be confused with the customer's own vendor/rent payments.
- **Platform Operations Module** — service — Internal-only, cross-org module behind the Platform Ops Console (F-20): lists every Organization, reads/writes `Organization.tenant_status` and `Subscription.status`/`plan` directly, for AddMin's own team. Owns no new primary data — reads Organization/Subscription across every tenant (the one deliberate exception to every other module's org-scoping) and writes only those two fields. Talks to: Organization & Office Module, Billing & Subscription Module, Audit Module (every action here is audited, since it is the one place in the system that intentionally crosses org boundaries). Explicitly does not implement Epic 0's Group hierarchy, Membership abstraction, permission catalogue, or break-glass consent flow — a single internal role is sufficient at this scope, per `03-analysis.md`.
- **Utility Module** — service — Utility master, connections, recurring bill obligations. Owns: UtilityType, UtilityAccount, UtilityBill. Talks to: Obligation Engine, Workflow Module, Vendor Module.
- **Property & Lease Module** — service — Landlord, lease, rent schedule, CAM, TDS on rent. Owns: Landlord, Lease, RentSchedule, CAMCharge. Talks to: Obligation Engine, Workflow Module.
- **Obligation Engine** — service — Central recurring-obligation and expected-instance generator shared by Utility, Lease, AMC and Compliance. Owns: RecurringObligationSchedule, ObligationInstance. Talks to: Utility Module, Property & Lease Module, Vendor Module, Compliance Module, Notification Module.
- **Facility & Maintenance Module** — service — Facility register, maintenance requests, work orders, SLA. Owns: FacilityInstance, MaintenanceRequest, WorkOrder. Talks to: Vendor Module, Workflow Module, Document Module.
- **Asset Module** — service — Asset register, custody, employee requests. Owns: Asset, AssetAssignment, AssetRequest. Talks to: Workflow Module, Organization & Office Module.
- **Vendor Module** — service — Vendor master, AMC contracts, performance. Owns: Vendor, AMCContract, VendorPerformance. Talks to: Obligation Engine, Notification Module.
- **Compliance Module** — service — Certificate/licence register and expiry tracking. Owns: ComplianceType, ComplianceItem. Talks to: Obligation Engine, Document Module, Notification Module.
- **Workflow & Approval Module** — service — Maker/Checker/Payment Authorizer routing, authorization limits, segregation-of-duties enforcement. Owns: WorkflowDefinition, ApprovalStep, ApprovalAction. Talks to: Identity & Access Module, every transactional module (Utility/Lease/Asset/Facility).
- **Payment Module** — service — Payment Tracking Mode (P0) and Payment Execution Mode (P1). Owns: Payment, TDSRecord. Talks to: Workflow & Approval Module, Utility Module, Property & Lease Module.
- **Document Module** — service — Central file/document repository for invoices, leases, certificates, media. Owns: Document. Talks to: (called by) every module needing attachments.
- **Notification Module** — service — Centralized reminder/escalation/notification dispatch and delivery log. Owns: NotificationRule, NotificationLog. Talks to: Worker Service (async), external Email/SMS providers.
- **Audit Module** — service — Immutable append-only audit log for all CUD/workflow actions. Owns: AuditLog. Talks to: (called by) every module.
- **Reporting Module** — service — Aggregates dashboards (Office Home, Executive, Utility Cost, Compliance, Vendor). Owns: no primary data — reads across modules; may maintain a read-optimized aggregation store. Talks to: all transactional modules (read-only).
- **Postgres** — store — Primary relational datastore for all modules.
- **Redis** — store — Job queue and cache backing the Worker Service.
- **Object Storage (S3-compatible)** — store — Binary storage for documents/media referenced by Document Module.
- **Email Provider** — external — Transactional email for verification, reminders, approvals.
- **SMS Provider (P1)** — external — SMS channel for notifications where configured.
- **Payment Gateway (P1)** — external — Net banking/UPI/card/wallet execution, only active in Payment Execution Mode. Pays the *customer's* utility providers/landlords — distinct from the item below.
- **Billing Provider (P0, e.g. Stripe/Razorpay Subscriptions)** — external — Charges the *customer organization* for using AddMin per its chosen plan; powers the trial-to-paid conversion described in `05-features.md`'s F-19. Live from the first release since the marketing site's "Start Free Trial" CTA depends on it, unlike the P1 Payment Gateway above.

**Node count by type:** Modules/Services: 19, Stores: 3, External: 4.

## Data models (8-15 core entities)

```
Organization
  id                string  PK
  name              string
  gstin             string  NULLABLE
  default_currency  string
  timezone          string
  tenant_status     enum(active, suspended)  DEFAULT active
  created_at        timestamp
  → has one Subscription
  → has many Office
  → has many Vendor

PlatformOperator
  id                string  PK
  email             string  UNIQUE
  mfa_enabled       boolean
  created_at        timestamp
  (deliberately not a row in the customer `User` table and carries no `org_id` —
   an AddMin staff identity, authenticated on a separate /platform login,
   never a Membership of any customer Organization)

Subscription
  id                string  PK
  org_id            string  FK -> Organization UNIQUE
  plan              enum(starter, growth, enterprise)
  status            enum(trialing, active, past_due, expired, canceled)
  trial_ends_at     timestamp  NULLABLE
  billing_provider_customer_id     string  NULLABLE
  billing_provider_subscription_id string  NULLABLE
  activated_at      timestamp  NULLABLE
  → belongs to Organization

Office
  id                string  PK
  org_id            string  FK -> Organization
  name              string
  address           string
  office_type       enum(head_office, regional, branch, warehouse, other)
  ownership_type    enum(owned, rented)
  setup_status      enum(draft, setup_incomplete, active, inactive)
  created_at        timestamp
  → has one OfficeSetupProfile
  → has many UtilityAccount
  → has many Lease
  → has many Asset

OfficeSetupProfile
  id                string  PK
  office_id         string  FK -> Office UNIQUE
  completion_pct    decimal
  activated_at      timestamp NULLABLE
  activated_by      string  FK -> User NULLABLE
  → has many OfficeChecklistItem

OfficeChecklistItem
  id                string  PK
  office_id         string  FK -> Office
  template_item_code string
  category          enum(utility, facility, compliance, vendor, asset, role)
  applicability     enum(yes, no, not_applicable)
  status            enum(pending, configured, complete)
  owner_user_id     string  FK -> User NULLABLE
  linked_entity_type string  NULLABLE
  linked_entity_id  string  NULLABLE
  → belongs to Office

UtilityAccount
  id                string  PK
  office_id         string  FK -> Office
  utility_type      enum(electricity, water, internet, telephone, gas, dg, ups, solar, other)
  provider_name     string
  meter_account_no  string
  billing_cycle     enum(monthly, bimonthly, quarterly)
  vendor_id         string  FK -> Vendor NULLABLE
  status            enum(active, inactive)
  → has many UtilityBill
  → has many RecurringObligationSchedule

RecurringObligationSchedule
  id                string  PK
  scope_type        enum(utility, rent, cam, amc, compliance)
  scope_ref_id      string
  frequency         enum(monthly, bimonthly, quarterly, annual)
  expected_window_days integer
  due_rule          string
  owner_user_id     string  FK -> User
  active_from       date
  active_to         date  NULLABLE
  → has many ObligationInstance

ObligationInstance
  id                string  PK
  schedule_id       string  FK -> RecurringObligationSchedule
  period            string
  expected_date     date
  due_date          date  NULLABLE
  status            enum(expected, received, missing, in_process, closed, cancelled)
  linked_ref_type   string  NULLABLE
  linked_ref_id     string  NULLABLE
  → belongs to RecurringObligationSchedule

UtilityBill
  id                string  PK
  utility_account_id string  FK -> UtilityAccount
  obligation_instance_id string FK -> ObligationInstance NULLABLE
  billing_period    string
  amount            decimal
  due_date          date
  status            enum(draft, pending_approval, approved, rejected, partially_paid, paid, overdue)
  invoice_doc_id    string  FK -> Document NULLABLE
  → has many Payment

Lease
  id                string  PK
  office_id         string  FK -> Office
  landlord_id       string  FK -> Landlord
  start_date        date
  end_date          date
  rent_amount       decimal
  cam_amount        decimal  NULLABLE
  security_deposit  decimal  NULLABLE
  escalation_pct    decimal  NULLABLE
  status            enum(draft, active, expiring, renewed, terminated)
  → has many Payment
  → belongs to Landlord

Landlord
  id                string  PK
  org_id            string  FK -> Organization
  name              string
  pan               string  NULLABLE
  bank_details      json
  → has many Lease

Vendor
  id                string  PK
  org_id            string  FK -> Organization
  name              string
  category          enum(utility_provider, dg, ups, solar, amc, building_mgmt, other)
  pan_gstin         string  NULLABLE
  status            enum(pending_activation, active, suspended, inactive)
  → has many AMCContract
  → has many UtilityAccount

AMCContract
  id                string  PK
  vendor_id         string  FK -> Vendor
  linked_entity_type string
  linked_entity_id  string
  start_date        date
  end_date          date
  status            enum(active, due_for_renewal, expired, closed)
  → belongs to Vendor

MaintenanceRequest
  id                string  PK
  office_id         string  FK -> Office
  category          string
  priority          enum(low, medium, high, critical)
  status            enum(open, assigned, in_progress, resolved, closed)
  → has one WorkOrder

WorkOrder
  id                string  PK
  maintenance_request_id string FK -> MaintenanceRequest
  vendor_id         string  FK -> Vendor NULLABLE
  sla_due_at        timestamp
  status            enum(assigned, in_progress, completed, verified)
  → belongs to MaintenanceRequest

Asset
  id                string  PK
  office_id         string  FK -> Office
  category          string
  serial_no         string  NULLABLE
  status            enum(available, assigned, under_service, retired)
  warranty_end      date  NULLABLE
  → has many AssetAssignment

ComplianceItem
  id                string  PK
  office_id         string  FK -> Office
  compliance_type   string
  status            enum(missing, valid, expiring, expired, not_applicable)
  expiry_date       date  NULLABLE
  document_id       string  FK -> Document NULLABLE
  → belongs to Office

Payment
  id                string  PK
  payable_type      enum(utility_bill, rent, cam, vendor)
  payable_id        string
  amount            decimal
  tds_amount        decimal  NULLABLE
  net_amount        decimal
  mode              string
  status            enum(pending, approved, initiated, paid, failed, partially_paid, overdue)
  authorized_by     string  FK -> User NULLABLE

User
  id                string  PK
  org_id            string  FK -> Organization
  email             string  UNIQUE
  role              enum(platform_admin, office_admin, checker, payment_authorizer, vendor_manager, compliance_coordinator, facility_staff, office_head, employee)
  office_scope      json
  mfa_enabled       boolean
  → has many RoleAssignment
  → has many ApprovalAction

AuditLog
  id                string  PK
  actor_user_id     string  FK -> User
  entity_type       string
  entity_id         string
  action            string
  before_value      json  NULLABLE
  after_value       json  NULLABLE
  created_at        timestamp
```

## API surface (top 20 endpoints)

```
POST   /api/auth/signup                        Create org + first admin account        no
POST   /api/auth/login                         Login (+ MFA challenge)                 no
POST   /api/organizations                      Create organization                     yes
POST   /api/offices                            Create office                           yes
GET    /api/offices/:id/checklist              Get onboarding checklist state          yes
PATCH  /api/offices/:id/checklist/:itemId      Update checklist item applicability     yes
POST   /api/offices/:id/activate               Activate office (post setup review)     yes
GET    /api/billing/subscription                Get org's current trial/plan status     yes
POST   /api/billing/subscribe                   Select plan + confirm payment method     yes
POST   /api/billing/webhook                     Billing provider callback (server-only) no
GET    /internal/organizations                  List all orgs + status (PO-only)        yes (PO)
PATCH  /internal/organizations/:id/tenant-status Suspend/reactivate a tenant (PO-only)   yes (PO)
PATCH  /internal/organizations/:id/subscription  Manually set plan/status (PO-only)      yes (PO)
POST   /api/utility-accounts                   Create utility connection                yes
GET    /api/utility-accounts/:officeId         List utility connections for office     yes
POST   /api/utility-bills                      Create/draft a utility bill              yes
POST   /api/utility-bills/:id/submit           Submit bill for approval                yes
POST   /api/utility-bills/:id/approve          Approve/reject/return bill              yes
POST   /api/payments                           Record or execute a payment              yes
GET    /api/obligations/instances              List obligation instances (My Actions)   yes
POST   /api/leases                             Create lease record                     yes
GET    /api/leases/:id                         Get lease detail                        yes
POST   /api/maintenance-requests                Create maintenance request              yes
POST   /api/maintenance-requests/:id/work-order Create work order + assign vendor       yes
POST   /api/assets/requests                     Employee asset request                  yes
POST   /api/vendors                             Register vendor                         yes
GET    /api/dashboards/office-home/:officeId    Office Home summary                     yes
GET    /api/dashboards/executive                Cross-office executive dashboard        yes
GET    /api/audit-logs/:entityType/:entityId    Audit trail for a record                yes
```

## Background jobs (5-10)

- **Trigger:** nightly cron. **Does:** generates the next period's `ObligationInstance` for every active `RecurringObligationSchedule` (utility, rent, AMC, compliance). **Failure mode:** retries with backoff; if a schedule repeatedly fails, flags it in an internal error queue rather than silently skipping.
- **Trigger:** nightly cron. **Does:** scans `ObligationInstance` past `expected_date` with no linked bill/payment and raises Missing Bill Alert notifications. **Failure mode:** idempotent re-run safe; duplicate alerts suppressed by a last-notified timestamp.
- **Trigger:** hourly cron. **Does:** evaluates due-date reminder windows (7/3/1 day) and lease/AMC/compliance renewal windows (180/90/60/30 or 60/30 day) and enqueues notifications. **Failure mode:** notification failures logged to NotificationLog with retry; does not block obligation state.
- **Trigger:** nightly cron. **Does:** marks unpaid `UtilityBill`/`Payment` past due date as `overdue`. **Failure mode:** re-run safe (idempotent status transition).
- **Trigger:** event (bill/lease/asset/compliance state change). **Does:** writes an `AuditLog` entry. **Failure mode:** must be synchronous/transactional with the state change, not best-effort async — an audit write failure rolls back the action.
- **Trigger:** event (approval task assigned). **Does:** sends immediate notification to assigned Checker/Payment Authorizer. **Failure mode:** queued retry via BullMQ; escalation cron independently catches anything unnotified after threshold.
- **Trigger:** hourly cron. **Does:** evaluates SLA breach on open `MaintenanceRequest`/`WorkOrder` and triggers escalation notifications. **Failure mode:** idempotent; re-evaluates state each run rather than tracking a fragile "already escalated" flag alone (also stores last-escalated timestamp to avoid spam).
- **Trigger:** nightly cron. **Does:** refreshes the Reporting Module's aggregation tables (spend, compliance status, AMC pipeline) for fast dashboard reads. **Failure mode:** stale-but-safe — dashboards show a "last updated" timestamp rather than blocking on refresh failure.
- **Trigger:** nightly cron. **Does:** flags `Subscription` records nearing `trial_ends_at` (3-day, 1-day reminders) and transitions those past it with no active plan to `expired`. **Failure mode:** idempotent per org per day (last-notified timestamp); reconciled against the Billing Provider's own records on each run so a missed webhook never leaves status stale.

## External integrations

- **Vendor:** Email provider (e.g., Postmark/SES). **Purpose:** verification, reminders, approval notifications. **Pricing tier:** pay-per-email, low volume tier. **Failover plan:** queue and retry via Worker Service; secondary provider swap-in behind the Notification Module interface if primary has sustained outage.
- **Vendor:** SMS provider (P1, e.g., MSG91/Twilio). **Purpose:** SMS notifications where organization configures it. **Pricing tier:** pay-per-SMS. **Failover plan:** optional channel — failure degrades to email-only, never blocks core workflow.
- **Vendor:** S3-compatible object storage. **Purpose:** documents (invoices, leases, certificates, media). **Pricing tier:** usage-based storage + egress. **Failover plan:** versioned bucket with lifecycle policy; document uploads validated for format/size before commit.
- **Vendor:** Payment gateway (P1 only, e.g., Razorpay). **Purpose:** Payment Execution Mode (net banking/UPI/card/wallet) for the *customer's* utility/rent payments. **Pricing tier:** transaction-fee based. **Failover plan:** not integrated until P1; Payment Tracking Mode (P0) has no gateway dependency at all.
- **Vendor:** Billing provider (P0, e.g., Stripe Billing or Razorpay Subscriptions). **Purpose:** charges the customer organization for AddMin's own subscription (F-19) — trial tracking, plan billing, invoicing. **Pricing tier:** transaction-fee based. **Failover plan:** webhook processing is idempotent and reconciled by the nightly trial/subscription job above, so a missed webhook self-heals on the next run rather than requiring manual intervention.

## Tech stack (one row per layer)

| Layer        | Choice                       | Why |
|--------------|-------------------------------|-----|
| Frontend     | Next.js 14 (App Router)       | Server components fit dashboard-heavy UI |
| Backend      | NestJS (Node.js)              | Modular structure matches domain-module boundaries |
| Database     | PostgreSQL + Prisma           | ACID for financial/audit data, strong typing |
| Background   | BullMQ + Redis                | Reliable scheduled jobs and retries |
| Storage      | S3-compatible object storage  | Cheap, standard for document/media repository |
| Hosting      | AWS (ECS/RDS) or Render       | Predictable ops for a multi-tenant B2B SaaS |
| Auth         | Custom + MFA (TOTP)           | RBAC/office-scope logic is domain-specific, not off-the-shelf |
| Notifications| Email (Postmark) + SMS (P1)   | Split channel, SMS optional per org config |
| Payments     | None in P0; Razorpay in P1    | Avoid PCI-DSS/gateway scope until Execution Mode is validated |
| SaaS Billing | Stripe Billing (or Razorpay Subscriptions) | Powers the self-serve trial/subscribe flow (F-19) from day one — separate concern and separate provider account from the P1 payments row above |

## Connections diagram (textual)

```
Web App --(HTTPS, sync)--> API Backend
Mobile App (P1) --(HTTPS, sync + offline queue)--> API Backend

API Backend --(sync)--> Postgres
API Backend --(sync)--> Object Storage
API Backend --(async, enqueue)--> Redis --> Worker Service

Worker Service --(cron: obligation generation, missing-bill, reminders,
                  overdue flagging, SLA escalation, aggregation refresh)--> Postgres
Worker Service --(async)--> Email Provider
Worker Service --(async)--> SMS Provider (P1)

Workflow & Approval Module --(sync, in-process)--> Identity & Access Module
Every transactional module --(sync, in-process)--> Audit Module
Every transactional module --(sync, in-process)--> Document Module (for attachments)

Payment Module --(P1 only, sync)--> Payment Gateway

Identity & Access Module --(sync, on signup)--> Billing & Subscription Module
Billing & Subscription Module --(sync)--> Billing Provider
Billing Provider --(async webhook)--> Billing & Subscription Module
Worker Service --(cron: trial reminders + expiry)--> Billing & Subscription Module

Platform Ops Console --(HTTPS, sync, separate login)--> API Backend (/internal/* routes only)
Platform Operations Module --(sync, in-process, cross-org read/write)--> Organization & Office Module
Platform Operations Module --(sync, in-process, cross-org read/write)--> Billing & Subscription Module
Platform Operations Module --(sync, in-process)--> Audit Module
```
