# System architecture — AddMin

Scoped to the P0 release (Onboarding, Billing & Subscription, Utility Management, Property/Lease, Facilities/Maintenance, Assets, Vendors, Compliance, Workflow/RBAC, Reports) for a single-organization tenant model. The Epic 0 multi-level Group tenancy (customer-side multi-org hierarchy, Group Super Admin, Membership abstraction) is deliberately deferred per `03-analysis.md` — the data model below reserves an `org_id` on every table so that layer can be added later without a schema rewrite. A separate, much smaller piece of Epic 0 — a lightweight, AddMin-internal Platform Operator console — *is* in scope; see the Platform Operations Module and `PlatformOperator` entity below.

## Containers (top-level)

- **AddMin App** — the single Wasp full-stack app serving the Admin/Finance/Checker/Vendor Manager/Compliance Coordinator/Office Head web experience (onboarding wizard, dashboards, approval queues) *and* owning all business logic, the Recurring Obligation Engine, and the background jobs — Wasp compiles one `main.wasp` spec into a React client, a Node.js/Express server, and a Prisma-managed Postgres schema, so there is no separate "frontend app" and "API backend" to keep in sync. Tech: Wasp (React + Node.js/Express + Prisma), TypeScript throughout, TailwindCSS + shadcn/ui for the UI. External integrations: Stripe, SendGrid, S3-compatible object storage, SMS provider (optional, P1), payment gateway (P1 only).
- **Platform Ops Console** — not a separate deployable. It is a route group (`/platform/*`) inside the same Wasp app, gated by a `PlatformOperator`-only auth check, for AddMin's own team to list every customer Organization, view its Subscription/tenant status, and manually activate/suspend one (F-20). Not reachable by any customer role, not linked from the customer-facing nav.
- **Marketing Site** — the public, pre-signup site (home, pricing, features, blog, docs) that carries the "Start Free Trial" CTA into the app's `/signup`. Deliberately built and deployed *outside* the Wasp app — it has no auth, no dynamic data, and shouldn't pay the cost of a full-stack framework. Tech: Astro (static-first, ships near-zero JS). External integrations: none directly — links out to the AddMin App's `/signup?plan=`.
- **Background jobs** — not a separate container. Wasp's `job` declarations run inside the same Node.js server process, scheduled and queued by `pg-boss`, which stores its queue state directly in the same Postgres database — no Redis, no separate worker deployment.
- **Mobile App (P1)** — Field app for Facility Staff (maintenance tasks, photo/video evidence, offline capture). Tech: React Native, calling the Wasp app's operations over its auto-generated HTTP API. External integrations: AddMin App only, with offline sync queue.

## Services (10-25 microservices or modules)

Domain modules inside the single Wasp app (modular monolith, not microservices, per P0 team-size reality). Each module is a folder of Wasp **queries** (reads) and **actions** (writes) declared in `main.wasp` and implemented in TypeScript — Wasp generates a type-safe RPC client for the frontend from these, so there's no hand-written REST layer to keep in sync with the client:

- **Identity & Access Module** — module — Wasp's built-in full-stack auth (email/password, verification email) handles signup/login/sessions; a thin custom layer on top adds TOTP MFA enforcement for admin roles (Wasp's auth doesn't include MFA natively) and RBAC/office-scope checks in every operation's server-side handler. Owns: User (Wasp's auth `User` entity extended with role/office_scope/mfa fields), RoleAssignment. Talks to: Audit Module, Notification Module.
- **Organization & Office Module** — module — Manages org/office/building/floor hierarchy and office scope. Owns: Organization, Office, Building, Floor. Talks to: Identity & Access Module, Onboarding Module.
- **Onboarding Module** — module — Drives the guided setup checklist and setup-completion %. Owns: OfficeSetupProfile, OfficeChecklistTemplate, OfficeChecklistItem. Talks to: Organization & Office Module, Utility Module, Facility Module, Compliance Module.
- **Billing & Subscription Module** — module — AddMin's own SaaS billing: trial lifecycle, plan selection, and subscription status that gates continued access after trial expiry. Owns: Subscription, Plan, BillingEvent. Talks to: Identity & Access Module (post-signup trial start), Notification Module (trial reminders), Stripe. Deliberately separate from the Payment Module below — this is revenue AddMin collects from the customer organization, never to be confused with the customer's own vendor/rent payments. Stripe webhooks land on a custom Wasp `api` route (`POST /payments-webhook`) since webhooks need a raw, unauthenticated HTTP endpoint rather than a typed operation.
- **Platform Operations Module** — module — Internal-only, cross-org module behind the Platform Ops Console (F-20): lists every Organization, reads/writes `Organization.tenant_status` and `Subscription.status`/`plan` directly, for AddMin's own team. Owns no new primary data — reads Organization/Subscription across every tenant (the one deliberate exception to every other module's org-scoping) and writes only those two fields. Talks to: Organization & Office Module, Billing & Subscription Module, Audit Module (every action here is audited, since it is the one place in the system that intentionally crosses org boundaries). Explicitly does not implement Epic 0's Group hierarchy, Membership abstraction, permission catalogue, or break-glass consent flow — a single internal role is sufficient at this scope, per `03-analysis.md`.
- **Utility Module** — module — Utility master, connections, recurring bill obligations. Owns: UtilityType, UtilityAccount, UtilityBill. Talks to: Obligation Engine, Workflow Module, Vendor Module.
- **Property & Lease Module** — module — Landlord, lease, rent schedule, CAM, TDS on rent. Owns: Landlord, Lease, RentSchedule, CAMCharge. Talks to: Obligation Engine, Workflow Module.
- **Obligation Engine** — module — Central recurring-obligation and expected-instance generator shared by Utility, Lease, AMC and Compliance, driven by a Wasp `job` on a nightly cron schedule. Owns: RecurringObligationSchedule, ObligationInstance. Talks to: Utility Module, Property & Lease Module, Vendor Module, Compliance Module, Notification Module.
- **Facility & Maintenance Module** — module — Facility register, maintenance requests, work orders, SLA. Owns: FacilityInstance, MaintenanceRequest, WorkOrder. Talks to: Vendor Module, Workflow Module, Document Module.
- **Asset Module** — module — Asset register, custody, employee requests. Owns: Asset, AssetAssignment, AssetRequest. Talks to: Workflow Module, Organization & Office Module.
- **Vendor Module** — module — Vendor master, AMC contracts, performance. Owns: Vendor, AMCContract, VendorPerformance. Talks to: Obligation Engine, Notification Module.
- **Compliance Module** — module — Certificate/licence register and expiry tracking. Owns: ComplianceType, ComplianceItem. Talks to: Obligation Engine, Document Module, Notification Module.
- **Workflow & Approval Module** — module — Maker/Checker/Payment Authorizer routing, authorization limits, segregation-of-duties enforcement. Owns: WorkflowDefinition, ApprovalStep, ApprovalAction. Talks to: Identity & Access Module, every transactional module (Utility/Lease/Asset/Facility).
- **Payment Module** — module — Payment Tracking Mode (P0) and Payment Execution Mode (P1). Owns: Payment, TDSRecord. Talks to: Workflow & Approval Module, Utility Module, Property & Lease Module.
- **Document Module** — module — Central file/document repository for invoices, leases, certificates, media; issues pre-signed S3 upload/download URLs via a Wasp action. Owns: Document. Talks to: (called by) every module needing attachments.
- **Notification Module** — module — Centralized reminder/escalation/notification dispatch and delivery log. Owns: NotificationRule, NotificationLog. Talks to: Wasp Jobs (async), SendGrid, SMS provider.
- **Audit Module** — module — Immutable append-only audit log for all CUD/workflow actions. Owns: AuditLog. Talks to: (called by) every module.
- **Reporting Module** — module — Aggregates dashboards (Office Home, Executive, Utility Cost, Compliance, Vendor). Owns: no primary data — reads across modules; may maintain a read-optimized aggregation store. Talks to: all transactional modules (read-only).
- **Postgres** — store — Primary relational datastore for all modules, and the backing store for the `pg-boss` job queue (no separate queue infrastructure).
- **Object Storage (S3-compatible)** — store — Binary storage for documents/media referenced by Document Module.
- **SendGrid** — external — Transactional email for verification, reminders, approvals.
- **SMS Provider (P1)** — external — SMS channel for notifications where configured.
- **Payment Gateway (P1)** — external — Net banking/UPI/card/wallet execution, only active in Payment Execution Mode. Pays the *customer's* utility providers/landlords — distinct from the item below. India-first payout rails (e.g. Razorpay) are the likely P1 choice since Stripe's India payout support is limited; revisit at P1.
- **Stripe** — external — Charges the *customer organization* for using AddMin per its chosen plan; powers the trial-to-paid conversion described in `05-features.md`'s F-19, via Stripe Checkout + Billing. Live from the first release since the marketing site's "Start Free Trial" CTA depends on it, unlike the P1 Payment Gateway above.

**Node count by type:** Modules: 18, Stores: 2, External: 4.

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

## API surface (top 20 operations)

Wasp apps don't hand-write REST routes for normal reads/writes — every row below is a `query` (read) or `action` (write) declared in `main.wasp`, implemented as a typed server function, and called from React via Wasp's generated RPC hooks (`useQuery`, actions imported directly). The only *raw* HTTP routes in the app are the two marked `api route` below, which exist because external services (Stripe, the signup form) need a real endpoint or because auth must happen before Wasp's normal session context is available.

```
action  signup                          Create org + first admin account (Wasp auth)     no
action  login                           Login (Wasp auth; custom MFA challenge on top)    no
action  createOrganization              Create organization                              yes
action  createOffice                    Create office                                    yes
query   getOfficeChecklist              Get onboarding checklist state                   yes
action  updateChecklistItem             Update checklist item applicability              yes
action  activateOffice                  Activate office (post setup review)              yes
query   getSubscription                 Get org's current trial/plan status              yes
action  subscribeToPlan                 Select plan + create Stripe Checkout session      yes
api route  POST /payments-webhook       Stripe billing webhook (raw route, no auth)       no
query   listOrganizationsInternal       List all orgs + status (PO-only)                  yes (PO)
action  setTenantStatusInternal         Suspend/reactivate a tenant (PO-only)              yes (PO)
action  setSubscriptionInternal         Manually set plan/status (PO-only)                yes (PO)
action  createUtilityAccount            Create utility connection                         yes
query   listUtilityAccounts             List utility connections for office               yes
action  createUtilityBill               Create/draft a utility bill                       yes
action  submitUtilityBill               Submit bill for approval                          yes
action  approveUtilityBill              Approve/reject/return bill                        yes
action  recordPayment                   Record or execute a payment                       yes
query   listObligationInstances         List obligation instances (My Actions)             yes
action  createLease                     Create lease record                               yes
query   getLease                        Get lease detail                                  yes
action  createMaintenanceRequest        Create maintenance request                        yes
action  createWorkOrder                 Create work order + assign vendor                 yes
action  createAssetRequest              Employee asset request                            yes
action  createVendor                    Register vendor                                   yes
query   getOfficeHomeDashboard          Office Home summary                               yes
query   getExecutiveDashboard           Cross-office executive dashboard                  yes
query   getAuditLog                     Audit trail for a record                          yes
```

## Background jobs (5-10)

All jobs below are Wasp `job` declarations executed by `pg-boss` on the same Postgres database as the app — no Redis, no separate worker deployment. `pg-boss` persists each scheduled/queued job as a row and survives server restarts, which is what makes the retry/failure behavior below possible without extra infrastructure.

- **Trigger:** nightly Wasp job (`schedule: cron`). **Does:** generates the next period's `ObligationInstance` for every active `RecurringObligationSchedule` (utility, rent, AMC, compliance). **Failure mode:** `pg-boss` retries with backoff (configured `retryLimit`/`retryBackoff`); if a schedule repeatedly fails, flags it in an internal error queue rather than silently skipping.
- **Trigger:** nightly Wasp job. **Does:** scans `ObligationInstance` past `expected_date` with no linked bill/payment and raises Missing Bill Alert notifications. **Failure mode:** idempotent re-run safe; duplicate alerts suppressed by a last-notified timestamp.
- **Trigger:** hourly Wasp job. **Does:** evaluates due-date reminder windows (7/3/1 day) and lease/AMC/compliance renewal windows (180/90/60/30 or 60/30 day) and enqueues notifications. **Failure mode:** notification failures logged to NotificationLog with `pg-boss` retry; does not block obligation state.
- **Trigger:** nightly Wasp job. **Does:** marks unpaid `UtilityBill`/`Payment` past due date as `overdue`. **Failure mode:** re-run safe (idempotent status transition).
- **Trigger:** event, in the same request (bill/lease/asset/compliance state change). **Does:** writes an `AuditLog` entry inside the same Prisma transaction as the triggering action. **Failure mode:** must be synchronous/transactional with the state change, not a queued job — an audit write failure rolls back the action.
- **Trigger:** event (approval task assigned) → submits a one-off Wasp job. **Does:** sends immediate notification to assigned Checker/Payment Authorizer via SendGrid. **Failure mode:** `pg-boss` retries the one-off job; the hourly escalation job independently catches anything unnotified after threshold.
- **Trigger:** hourly Wasp job. **Does:** evaluates SLA breach on open `MaintenanceRequest`/`WorkOrder` and triggers escalation notifications. **Failure mode:** idempotent; re-evaluates state each run rather than tracking a fragile "already escalated" flag alone (also stores last-escalated timestamp to avoid spam).
- **Trigger:** nightly Wasp job. **Does:** refreshes the Reporting Module's aggregation tables (spend, compliance status, AMC pipeline) for fast dashboard reads. **Failure mode:** stale-but-safe — dashboards show a "last updated" timestamp rather than blocking on refresh failure.
- **Trigger:** nightly Wasp job. **Does:** flags `Subscription` records nearing `trial_ends_at` (3-day, 1-day reminders) and transitions those past it with no active plan to `expired`. **Failure mode:** idempotent per org per day (last-notified timestamp); reconciled against Stripe's own subscription records on each run so a missed webhook never leaves status stale.

## External integrations

- **Vendor:** SendGrid. **Purpose:** verification, reminders, approval notifications — sent via Wasp's `email` sender config, which wraps SendGrid's API. **Pricing tier:** pay-per-email, low volume tier. **Failover plan:** `pg-boss` retries failed sends; swap-in an alternate provider (Wasp also supports Mailgun/SMTP) behind the same Notification Module interface if SendGrid has a sustained outage.
- **Vendor:** SMS provider (P1, e.g., MSG91/Twilio). **Purpose:** SMS notifications where organization configures it. **Pricing tier:** pay-per-SMS. **Failover plan:** optional channel — failure degrades to email-only, never blocks core workflow.
- **Vendor:** S3-compatible object storage (AWS S3). **Purpose:** documents (invoices, leases, certificates, media), uploaded via pre-signed URLs issued by a Wasp action. **Pricing tier:** usage-based storage + egress. **Failover plan:** versioned bucket with lifecycle policy; document uploads validated for format/size before commit.
- **Vendor:** Payment gateway (P1 only, likely Razorpay for India payout rails). **Purpose:** Payment Execution Mode (net banking/UPI/card/wallet) for the *customer's* utility/rent payments. **Pricing tier:** transaction-fee based. **Failover plan:** not integrated until P1; Payment Tracking Mode (P0) has no gateway dependency at all.
- **Vendor:** Stripe. **Purpose:** charges the customer organization for AddMin's own subscription (F-19) — trial tracking, plan billing, invoicing, via Stripe Checkout + Customer Portal. **Pricing tier:** transaction-fee based (2.9% + fee, standard Stripe pricing). **Failover plan:** webhook processing (`POST /payments-webhook`) is idempotent and reconciled by the nightly trial/subscription job above, so a missed webhook self-heals on the next run rather than requiring manual intervention.

## Tech stack (one row per layer)

| Layer        | Choice                        | Why |
|--------------|--------------------------------|-----|
| Full-stack framework | Wasp (React + Node.js/Express + Prisma) | Compiles one spec into a type-safe client + server + schema — no REST layer to hand-maintain, matches OpenSaaS's reference stack |
| Frontend     | React (generated by Wasp)     | Wasp's client; component/page code is ordinary React + TypeScript |
| Styling / UI | TailwindCSS + shadcn/ui       | Utility-first CSS + accessible unstyled primitives, the OpenSaaS-recommended pairing |
| Backend      | Node.js/Express (generated by Wasp) | Wasp compiles `query`/`action` declarations into this — domain modules stay as plain TypeScript folders |
| Database     | PostgreSQL + Prisma            | ACID for financial/audit data, strong typing; Prisma is Wasp's native ORM |
| Background   | Wasp Jobs (`pg-boss`, Postgres-backed) | Reliable scheduled jobs and retries with zero extra infrastructure — no Redis |
| Storage      | AWS S3 (S3-compatible)         | Cheap, standard for document/media repository |
| Hosting (app)| Fly.io via `wasp deploy fly launch` | One command deploys client + server + Postgres together; no separate CI/CD to hand-build |
| Marketing site | Astro, deployed separately to Fly.io | Static-first — near-zero JS, fast Lighthouse scores, no reason to run inside the full-stack app |
| Auth         | Wasp full-stack auth (email/password) + custom MFA (TOTP) | Signup/login/verification is built into Wasp; MFA for admin roles is layered on top since Wasp doesn't ship MFA natively |
| Notifications| SendGrid (email) + SMS (P1)    | Wasp's built-in email sender wraps SendGrid; SMS optional per org config |
| Payments     | None in P0; Razorpay in P1     | Avoid PCI-DSS/gateway scope until Execution Mode is validated; India payout rails favor Razorpay over Stripe here |
| SaaS Billing | Stripe                          | Powers the self-serve trial/subscribe flow (F-19) from day one via Stripe Checkout — separate concern and separate provider from the P1 payments row above |

## Connections diagram (textual)

```
Marketing Site (Astro) --(link only, no API call)--> AddMin App's /signup?plan=

React Client (Wasp-generated) --(typed RPC over HTTPS, sync)--> Wasp Server (Node/Express)
Mobile App (P1) --(HTTPS, sync + offline queue)--> Wasp Server's auto-generated HTTP API

Wasp Server --(sync, via Prisma)--> Postgres
Wasp Server --(sync, pre-signed URLs)--> Object Storage (S3)
Wasp Server --(submits job)--> pg-boss (queue table in same Postgres)

pg-boss --(cron: obligation generation, missing-bill, reminders,
            overdue flagging, SLA escalation, aggregation refresh)--> Wasp Server job handlers --> Postgres
Wasp Server job handlers --(async)--> SendGrid
Wasp Server job handlers --(async)--> SMS Provider (P1)

Workflow & Approval Module --(sync, in-process)--> Identity & Access Module
Every transactional module --(sync, in-process)--> Audit Module
Every transactional module --(sync, in-process)--> Document Module (for attachments)

Payment Module --(P1 only, sync)--> Payment Gateway

Identity & Access Module --(sync, on signup)--> Billing & Subscription Module
Billing & Subscription Module --(sync, Stripe Checkout)--> Stripe
Stripe --(async, api route POST /payments-webhook)--> Billing & Subscription Module
pg-boss --(cron: trial reminders + expiry)--> Billing & Subscription Module

Platform Ops Console (/platform/* routes) --(HTTPS, sync, separate login)--> Wasp Server (same app, role-gated)
Platform Operations Module --(sync, in-process, cross-org read/write)--> Organization & Office Module
Platform Operations Module --(sync, in-process, cross-org read/write)--> Billing & Subscription Module
Platform Operations Module --(sync, in-process)--> Audit Module
```
