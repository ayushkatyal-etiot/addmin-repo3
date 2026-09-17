# Build playbook — AddMin

> Decision-grade build instructions for the AddMin SaaS.
> Follow steps in order. Do not skip rubric items. Stop and review at the gate after every step.

## How to use this playbook

This is a build sequence, not a wishlist. Each step depends on the previous one working — Step 05's trial/subscription gate assumes Step 04's onboarding already produces an activatable office, Step 06's Platform Operator console assumes Step 05's `Subscription` entity already exists, Step 07's Recurring Obligation Engine assumes Step 03's authorization layer already rejects cross-office access, and Step 08's approval workflow assumes Step 04's office hierarchy and role assignment already exist. Building out of order means debugging a feature against a foundation that isn't actually solid yet.

After every step there is a "stop and review" gate. Do not advance until every rubric item checks. The next step assumes everything before it works — if you skip a rubric item because it "probably works," you are borrowing time against a much larger debugging session three steps from now, at which point you won't know which of three unverified layers actually broke.

## Build sequence — at a glance

```
01 Repo bootstrap + deploy pipeline                              (no deps — leaf)
   └─ 02 Data layer (Prisma schema, all core entities)
        └─ 03 Auth + RBAC/office-scope enforcement (F-01, F-02)
             └─ 04 Org/Office hierarchy + Guided Onboarding (F-03, F-04, F-05)
                  └─ 05 Free Trial & Subscription Activation (F-19)
                       └─ 06 Platform Operator Console (F-20)
                            └─ 07 Utility Connection + Recurring Obligation Engine (F-06, F-07, F-08)
                                 └─ 08 Bill Entry + Approval Workflow + Payment Tracking (F-09, F-10, F-11)
                                      └─ 09 Property & Lease + TDS (F-12, F-13)
                                           └─ 10 Vendor, Maintenance, Asset, Compliance (F-14, F-15, F-16, F-17)
                                                └─ 11 Reporting: Office Home, My Actions, Executive Dashboard (F-18)
                                                     └─ 12 Frontend polish (loading/empty/error states, design system)
                                                          └─ 13 Production deploy + observability
                                                               └─ 14 Post-launch ops & runbooks (root)
```

The marketing site (`addmin-site/`) now sends every "Start Free Trial" click into Step 03's signup flow, which chains into Step 04's onboarding and Step 05's subscription activation — this is the register → onboard → subscribe order the marketing site's CTA promises, and Step 05 exists specifically to make that promise true in the product, not just in copy. Step 05's subscription billing is AddMin's own SaaS billing (charging the customer for using AddMin) — do not confuse it with the Payment module in Step 08, which tracks the *customer's* utility/rent payments to their own vendors and landlords. Payment Execution Mode for that customer-facing payment flow remains deferred to Phase 4 per `07-phases.md`.

**If you've already completed Step 02** (this repo has — see `d992408 Build Step 02: Prisma data layer (all 19 core entities)`): Step 06 below adds `tenant_status` to `Organization` and a new `PlatformOperator` entity via an **additive migration**, not a redo of Step 02. Do not edit or revert the existing Step 02 migration file — create a new one on top of it, exactly as any schema change after initial launch would work in production.

---

## Build Step 01 — Repo bootstrap & deploy pipeline

### 🎯 Goal
A blank Next.js + NestJS monorepo deploys to staging on every push to `main`, with a health-check endpoint returning 200.

### 📍 Why this is the leaf
Every later step assumes a working deploy pipeline exists to verify against. Without it, "does this work" means "does it work on my laptop," which is not the same question you'll be answering once a design partner is using this.

### 📥 Inputs (preconditions before you start)
- Node.js 20+, pnpm installed
- A staging hosting account (AWS or Render, per `04-architecture.md`'s tech stack)
- A Postgres instance provisioned (staging tier is fine)
- A GitHub repo with CI access configured

### 📤 Outputs (what exists after this step passes)
- A monorepo with `apps/web` (Next.js 14) and `apps/api` (NestJS) packages
- A `GET /health` endpoint on the API returning `{ status: "ok" }`
- A CI pipeline (GitHub Actions) running lint + typecheck + build on every PR
- A staging deploy that updates automatically on merge to `main`

### 🛠 Implementation details

**Files to create:**
```
apps/web/                 Next.js 14 App Router frontend
apps/api/                 NestJS backend
  src/main.ts             App bootstrap
  src/health/health.controller.ts   GET /health
packages/db/              Prisma schema + generated client (shared package)
.github/workflows/ci.yml  Lint, typecheck, build on PR
.github/workflows/deploy.yml  Deploy to staging on merge to main
```

**Tech decisions** (locked from blueprint stage 04 — do not re-litigate):
- Next.js 14 App Router for `apps/web` — server components fit the dashboard-heavy UI from `06-frontend.md`.
- NestJS for `apps/api` — module boundaries map directly to the 17 modules in `04-architecture.md`.
- PostgreSQL + Prisma — ACID guarantees for financial/audit data.
- pnpm workspaces for the monorepo — shared `packages/db` types between web and api.

**Patterns (mandatory across the codebase):**
- Every API module lives under `apps/api/src/<module-name>/`, matching a module name from `04-architecture.md` exactly (e.g., `utility`, `obligation-engine`, `workflow`).
- No business logic in controllers — controllers call a service; services contain logic.
- Environment variables are never committed. `.env.example` documents every required variable with a one-line comment.

### ✅ Acceptance rubric
- [ ] `pnpm install && pnpm dev` starts both `apps/web` and `apps/api` locally without error.
- [ ] `curl localhost:3001/health` returns `{ "status": "ok" }` with a 200 status code.
- [ ] A PR opened against `main` triggers CI and shows a pass/fail status check.
- [ ] Merging to `main` triggers an automatic staging deploy visible in the hosting provider's dashboard.
- [ ] The staging URL's `/health` endpoint returns 200 within 60 seconds of deploy completing.
- [ ] `.env.example` exists and lists every environment variable the API needs, with no real secrets present.
- [ ] `packages/db` exports a typed Prisma client importable from both `apps/web` and `apps/api`.

### ⚠️ Edge cases to handle
- CI runs on a fork PR with no access to staging secrets — build/lint/typecheck must still pass without requiring secret access.
- A failed deploy must not take down the previous working staging deployment — use a rolling or blue-green deploy strategy, not a delete-then-create.

### ❌ Common pitfalls (do NOT do these)
- Don't commit a `.env` file with real staging credentials — this leaks into git history permanently even if deleted later.
- Don't put business logic directly in NestJS controllers "just for now" — this pattern spreads and by Step 08 you'll have authorization checks scattered across a dozen controllers instead of centralized in Step 03's guard.
- Don't skip the CI typecheck step to "move faster" — Prisma schema changes silently break consumers without it, and you won't find out until Step 07's Obligation Engine throws a runtime error.

### 📊 Quality bar
- CI pipeline completes in under 5 minutes.
- Staging deploy completes in under 10 minutes from merge.
- Zero secrets present in git history (verify with a secret-scanning tool before first push).

### 🛑 Stop and review (gate before next step)
1. Push a trivial change (e.g., a comment) to a feature branch, open a PR, confirm CI passes.
2. Merge to `main`, watch the deploy pipeline run to completion.
3. Curl the staging `/health` endpoint from your terminal — confirm 200 response.
4. Delete your local `node_modules` and re-run `pnpm install && pnpm dev` — confirm it still works from a clean state.

If any of these fail, do not proceed to Step 02 — a broken deploy pipeline means every later step's "is this deployed" question is unanswerable.

---

## Build Step 02 — Data layer (Prisma schema)

### 🎯 Goal
Every core entity from `04-architecture.md`'s data model section exists as a Prisma model, migrated into the staging database, with seed data for one test Organization.

### 📍 Why this is the leaf
Every feature from Step 04 onward reads and writes these tables. Getting the relations and enums wrong here (e.g., `ObligationInstance.status` missing the `missing` state) means every later step either can't be built correctly or gets built against a schema that has to be migrated again mid-project.

### 📥 Inputs (preconditions before you start)
- Step 01 complete: `packages/db` package exists with Prisma configured
- Staging Postgres instance is reachable from CI and local dev

### 📤 Outputs (what exists after this step passes)
- A `schema.prisma` file containing all entities listed in `04-architecture.md`'s "Data models" section: Organization, Office, OfficeSetupProfile, OfficeChecklistItem, UtilityAccount, RecurringObligationSchedule, ObligationInstance, UtilityBill, Lease, Landlord, Vendor, AMCContract, MaintenanceRequest, WorkOrder, Asset, ComplianceItem, Payment, User, AuditLog
- A migration applied to staging
- A seed script creating one test Organization, one Office, one User per role type

### 🛠 Implementation details

**Files to create:**
```
packages/db/prisma/schema.prisma      All entity models + enums
packages/db/prisma/migrations/        Generated migration history
packages/db/prisma/seed.ts            Test org/office/users seed script
```

**Tech decisions** (locked from blueprint stage 04):
- Every organization-scoped table carries `org_id`; every office-scoped table carries `office_id` — this is what Step 03's authorization guard filters on.
- Enums are Prisma-native enums (not string columns with app-level validation) for `UtilityBill.status`, `ObligationInstance.status`, `Payment.status`, etc. — exact values are specified in `04-architecture.md`.
- `AuditLog` has no foreign key `onDelete: Cascade` from any entity — audit records must survive even if the record they describe is later hard-deleted (which itself should be rare; prefer soft status changes).

**Patterns (mandatory across the codebase):**
- Every model that needs office-scoping includes `officeId String` with an index, never a nullable office reference for operational data.
- Money fields (`amount`, `tds_amount`, `net_amount`) are `Decimal`, never `Float` — floating point rounding errors are unacceptable in a payment/TDS calculation path per F-13's acceptance criteria.
- Every model has `createdAt`/`updatedAt` timestamps by convention, even if not explicitly listed in `04-architecture.md`'s compact entity view.

### ✅ Acceptance rubric
- [ ] `schema.prisma` contains all 19 entities listed in `04-architecture.md`'s data model section.
- [ ] `ObligationInstance.status` enum matches exactly: `expected, received, missing, in_process, closed, cancelled`.
- [ ] `UtilityBill.status` enum matches exactly: `draft, pending_approval, approved, rejected, partially_paid, paid, overdue`.
- [ ] All money fields (`UtilityBill.amount`, `Payment.amount`, `Payment.tds_amount`, `Payment.net_amount`, `Lease.rent_amount`) use `Decimal` type.
- [ ] `pnpm prisma migrate dev` runs cleanly against a fresh local database with zero errors.
- [ ] `pnpm prisma db seed` creates one Organization, one Office, and nine Users (one per role in the `User.role` enum from `04-architecture.md`).
- [ ] Every table that should be office-scoped (UtilityAccount, Lease, MaintenanceRequest, Asset, ComplianceItem, OfficeChecklistItem) has an `officeId` foreign key with a database index.
- [ ] Running the migration twice in a row (idempotency check) does not error or duplicate data.

### ⚠️ Edge cases to handle
- A migration that renames a column must be a two-step migration (add new, backfill, drop old) once real data exists — but at this stage, document this pattern now so it's followed later, not retrofitted.
- `Landlord.bank_details` and similar `Json` fields must have an application-level shape validated at the service layer (Step 04+), since Postgres `Json` columns don't enforce structure.

### ❌ Common pitfalls (do NOT do these)
- Don't use `Float` for any money field — this WILL cause a TDS calculation mismatch in Step 09 that's painful to trace back to its root cause.
- Don't add a Group/Organization-of-Organizations table now "to be ready for later" — `03-analysis.md` explicitly says defer the Epic 0 multi-tenant Group layer; adding it here is exactly the scope creep that analysis warns against.
- Don't skip the seed script — Step 03's authorization tests and Step 04's onboarding flow both need realistic seed data to test against, and writing it later means retrofitting tests that should have existed from day one.

### 📊 Quality bar
- Migration applies in under 30 seconds against an empty database.
- Seed script completes in under 10 seconds.
- Zero `Float` fields used for money anywhere in the schema (grep-verifiable).

### 🛑 Stop and review (gate before next step)
1. Run `pnpm prisma migrate reset` against local dev — confirm it drops, recreates, migrates, and seeds without manual intervention.
2. Open Prisma Studio (`pnpm prisma studio`) and confirm all 19 entities are visible with correct relations.
3. Query the seeded data for the test Organization and confirm exactly one User exists per role.
4. Grep the schema file for `Float` — confirm zero matches on any money-related field.

---

## Build Step 03 — Auth + RBAC/office-scope enforcement (F-01, F-02)

### 🎯 Goal
A user can sign up, verify email, enable MFA, and log in (F-01); every subsequent API call is checked against that user's role and office scope before any handler logic runs (F-02), and a cross-office access attempt is rejected with a 403 and logged to `AuditLog`.

### 📍 Why this is the leaf
This is the PRD's single loudest non-negotiable requirement, repeated in `03-analysis.md`'s risk matrix as the highest-impact tech risk. Every feature built in Steps 04-09 calls into this layer. If authorization is bolted on after features exist (the common failure mode `04-architecture.md` warns against with "no god services"), you end up with inconsistent checks scattered across a dozen controllers — exactly the trap Step 01's pitfalls section names.

### 📥 Inputs (preconditions before you start)
- Step 02 complete: `User`, `Organization`, `Office` tables exist and are seeded
- An email-sending provider configured (even a staging/sandbox one) for verification emails
- A TOTP library selected (e.g., `otplib`) for MFA

### 📤 Outputs (what exists after this step passes)
- Working signup → email verification → MFA enrollment → login flow (F-01)
- A NestJS guard (`AuthzGuard`) applied globally that resolves the caller's role + office scope and rejects unauthorized requests before the route handler executes (F-02)
- Every rejected unauthorized attempt writes an `AuditLog` entry

### 🛠 Implementation details

**Files to create:**
```
apps/api/src/auth/auth.controller.ts       signup, login, verify-email, mfa endpoints
apps/api/src/auth/auth.service.ts          business logic, password hashing, session issuance
apps/api/src/auth/mfa.service.ts           TOTP enrollment + verification
apps/api/src/authz/authz.guard.ts          global guard: resolves role + office scope per request
apps/api/src/authz/authz.decorator.ts      @RequiresRole(), @RequiresOfficeScope() decorators
apps/web/app/signup/page.tsx               F-01 signup UI
apps/web/app/mfa-setup/page.tsx            F-01 MFA enrollment UI
apps/web/app/login/page.tsx                F-01 login UI
```

**Tech decisions** (locked from blueprint stage 04):
- Sessions, not stateless JWTs alone, for the web app — server-side session revocation is required by F-02's acceptance criteria ("revoking a user's role takes effect on their next API call, not just their next login").
- Password hashing via a modern adaptive algorithm (argon2 or bcrypt with a sufficient cost factor) — never a fast hash like plain SHA-256.

**Patterns (mandatory across the codebase):**
- `AuthzGuard` is registered globally in `apps/api/src/main.ts` — no controller opts out silently. New endpoints require an explicit `@Public()` decorator to bypass it, so the default is always "protected."
- No route handler queries `officeId` from the request body/params without also checking it against the caller's granted office scope from `AuthzGuard` — the scope check happens in the guard, not re-implemented per-controller.
- All authorization decisions (allow AND deny) that touch sensitive data are logged; reads emit lightweight access telemetry, writes emit full `AuditLog` entries (per the pattern noted in the source Epic 0 document).

### ✅ Acceptance rubric
- [ ] User can sign up with org name, email, password; receives a verification email within 30 seconds (staging email provider).
- [ ] Unverified accounts cannot access any `/app` route beyond the "verify your email" screen.
- [ ] A user with an admin-tier role cannot complete signup without enrolling MFA — enforced server-side, not just hidden in the UI.
- [ ] Login with a valid password but missing/incorrect MFA code does not issue a session.
- [ ] A user scoped to Office A receives a 403 when calling any endpoint with an `officeId` param for Office B.
- [ ] Each 403 from a scope mismatch produces exactly one `AuditLog` entry with `action: "unauthorized_access_attempt"`.
- [ ] Revoking a user's role assignment (via a direct DB update in this test) causes their very next API call to fail authorization, without requiring them to log out and back in.
- [ ] A Maker who created a bill cannot call the approve endpoint for that same bill unless the organization has an explicit override configured (test both the default-blocked and override-allowed paths).
- [ ] Password reset invalidates all previously issued sessions for that user.

### ⚠️ Edge cases to handle
- User's last office scope is removed while they hold an active session — their next request must re-evaluate scope from the database, not from a cached session claim.
- Two roles granted to one user with conflicting segregation-of-duties rules — the guard must enforce the stricter rule, never the more permissive one.
- MFA device lost — do not build a silent bypass; require an explicit admin-assisted recovery action that itself is audit-logged.

### ❌ Common pitfalls (do NOT do these)
- Don't check role/office scope only in the frontend and trust the API to "probably be fine" — this is the exact failure the 16 September demo correction and the entire PRD's Section 27 (Security NFRs) exist to prevent.
- Don't cache a user's permissions in the session/JWT for the lifetime of the token — F-02's acceptance criteria requires revocation to take effect on the next request, which means re-checking against current DB state, not a stale cached claim.
- Don't store the MFA secret unencrypted in the database — encrypt it at rest, same as any other credential material.
- Don't let a single missing `@RequiresOfficeScope()` decorator on one endpoint silently fall back to "allow" — the guard's default behavior for an unannotated protected route should be to deny and log a configuration warning, not to pass through.

### 📊 Quality bar
- 100% of API endpoints (excluding explicitly `@Public()` ones) are covered by an automated authorization test asserting both an allowed and a denied case.
- Login flow (password + MFA) completes in under 2 seconds end-to-end.
- Zero plaintext secrets (passwords, MFA seeds) in the database — verified by inspecting the schema and a sample row.

### 🛑 Stop and review (gate before next step)
1. Sign up three different test users with different roles and office scopes. Log out. Log in as each. Confirm each sees only their own office's (still-empty) data.
2. Attempt to call an Office B endpoint while logged in as the Office A user via a raw HTTP client (not the UI) — confirm 403 and confirm an `AuditLog` row was created.
3. Revoke one test user's role directly in the database. Immediately retry their last successful API call — confirm it now fails.
4. Run the full authorization test suite — confirm 100% pass, zero skipped tests.

If any of these fail, do not proceed — Step 04 onward assumes this layer is airtight, and every subsequent feature's "is this secure" question depends on this gate actually holding.

---

## Build Step 04 — Org/Office hierarchy + Guided Onboarding (F-03, F-04, F-05)

### 🎯 Goal
An Admin can create an office and complete the full guided onboarding wizard (Owned/Rented → Utilities → Facilities → Compliance → Vendors → Assets → Roles → Review) and activate the office, without ever seeing a generic expense form.

### 📍 Why this is the leaf
This is the product's core differentiator per `02-research.md` and `03-analysis.md` — it's what makes AddMin "obligation-first, not expense-first." Steps 05-08 all attach their setup flows into this checklist (e.g., marking a utility "Yes" in Step 04 must create the actual `UtilityAccount` record built in Step 07).

### 📥 Inputs (preconditions before you start)
- Step 03 complete: a logged-in, MFA-verified Admin session exists
- `OfficeChecklistTemplate` seed data defined for Utilities, Facilities, Compliance categories (per the PRD's Section 5 checklist content: Electricity/Water/Internet/Telephone/Gas/DG/UPS/Solar for utilities; Trade Licence/Fire NOC/Electrical Safety/Shop & Establishment/Lift Licence/Pollution Certificate for compliance)

### 📤 Outputs (what exists after this step passes)
- `POST /api/organizations`, `POST /api/offices` working end-to-end (F-03)
- Full onboarding wizard UI at `/app/onboarding` per the route/wireframe in `06-frontend.md` (F-04)
- Setup Completion % calculation and Activate Office action at `/app/offices/[officeId]/setup` (F-05)

### 🛠 Implementation details

**Files to create:**
```
apps/api/src/organization/organization.service.ts
apps/api/src/office/office.service.ts               office CRUD + setup_status transitions
apps/api/src/onboarding/onboarding.service.ts        checklist state, completion % calc
apps/api/src/onboarding/checklist-template.seed.ts   seeded checklist items
apps/web/app/onboarding/page.tsx                     wizard shell (<WizardStepper>)
apps/web/app/onboarding/steps/*.tsx                  one file per step
apps/web/app/offices/[officeId]/setup/page.tsx        completion % + activate
```

**Tech decisions:**
- Checklist template is seeded data (`OfficeChecklistTemplate`), not hard-coded in frontend components — per F-04's acceptance criteria, this must be configurable, and the PRD explicitly flags jurisdiction-specific compliance applicability as requiring future configuration.
- Setup Completion % is calculated server-side on every checklist mutation, never computed client-side from potentially stale data.

**Patterns (mandatory across the codebase):**
- Every wizard step component receives `officeId` and reads/writes exactly one category of `OfficeChecklistItem` — no step reaches across category boundaries.
- Marking a checklist item "Yes"/"Available" without completing its linked configuration must create a visible open task, per F-04 — implement this as a computed `status` derivation, not a separate manually-maintained flag.

### ✅ Acceptance rubric
- [ ] User can create an office and complete guided setup without creating any generic expense category or payee (F-04 core acceptance criterion from the PRD).
- [ ] Every checklist item supports exactly the applicability values specified (Yes/No/Not Applicable, or Available/Missing/Not Applicable for compliance).
- [ ] Marking a utility "Yes" without completing connection details shows it as an open item on the Review step.
- [ ] Setup Completion % = completed applicable items ÷ total applicable items; marking an item Not Applicable removes it from both numerator and denominator, verified by a direct calculation test with mixed applicability states.
- [ ] Saving the wizard mid-flow and returning later resumes at the exact step and field state where the user left off.
- [ ] "Activate Office" is disabled while any applicable item lacks a configured status or assigned owner, and the disabled state names which items are blocking.
- [ ] Activating an office sets `setup_status = active`, records `activated_at`/`activated_by`, and is a single explicit user action, never automatic.

### ⚠️ Edge cases to handle
- Admin changes a utility from "Yes" (with data already entered) to "Not Applicable" — show a confirmation before discarding the linked `UtilityAccount` draft, don't silently delete it.
- Admin abandons the wizard entirely and returns days later — checklist state must be exactly as they left it, not reset or partially expired.
- All items marked Not Applicable — completion is mathematically 100%, but activation is still a required explicit click, not automatic.

### ❌ Common pitfalls (do NOT do these)
- Don't hard-code the checklist item list in a frontend array — this contradicts F-04's configurability requirement and means every new customer's jurisdiction-specific compliance needs requires a code deploy instead of a data change.
- Don't compute Setup Completion % on the frontend from data that might be stale after a concurrent update — always fetch the authoritative percentage from the API after any mutation.
- Don't let "Activate Office" succeed silently when dependencies are missing — the PRD is explicit that a workflow must not be able to execute if its mandatory dependency (e.g., no approver) is absent; catch this at activation time, not only at first use.

### 📊 Quality bar
- Wizard step transitions render in under 300ms (no full-page reload between steps).
- Onboarding completion (11 steps) is achievable by a test user in under 10 minutes of active interaction.

### 🛑 Stop and review (gate before next step)
1. Create a new office as a test Admin. Walk through the entire wizard, marking a mix of Yes/No/Not Applicable across categories. Save and log out mid-way through.
2. Log back in, confirm the wizard resumes exactly where you left off.
3. Complete the remaining steps, attempt to activate with one utility left unconfigured — confirm activation is blocked and the specific item is named.
4. Fix the blocking item, activate — confirm `setup_status` is `active` and the activation timestamp/user is recorded correctly in the database.

---

## Build Step 05 — Free Trial & Subscription Activation (F-19)

### 🎯 Goal
A visitor who clicks "Start Free Trial" on the marketing site lands in a 14-day trial the moment their account is created (Step 03), completes Guided Onboarding (Step 04) with no payment method required, and can activate a paid subscription from `/app/subscribe` at any point — with the org's access correctly gated once the trial ends without a chosen plan.

### 📍 Why this is the leaf
This step exists because the marketing site's primary conversion path (`addmin-site/content/_index.md`, `pricing.md`, `hugo.toml`) now sends every "Start Free Trial" click straight into the product, not into a sales form. That marketing promise — register → onboard → subscribe — has to be a real, gated sequence in the product, not just landing-page copy. Step 07 onward assumes an `Organization` has a resolved subscription/trial state; without this step, there is no server-side answer to "is this org allowed to keep using AddMin," which becomes a real question the moment a trial expires.

### 📥 Inputs (preconditions before you start)
- Step 03 complete: signup creates an `Organization` + first `User` and issues a session
- Step 04 complete: an office can be onboarded and activated
- A billing provider account for AddMin's own SaaS billing (e.g., Stripe or Razorpay) — separate account and integration from the customer-facing Payment Gateway referenced in `04-architecture.md`, which is P1 and pays *the customer's* vendors/landlords, not AddMin's own subscription revenue
- The three plans and prices from `addmin-site/content/pricing.md` (Starter ₹15,000, Growth ₹25,000, Enterprise custom) as the source of truth for plan definitions

### 📤 Outputs (what exists after this step passes)
- `Organization` gets a `Subscription` record the instant signup completes, in `trialing` status, with `trial_ends_at` set to 14 days out
- `/app/subscribe` page where an Org Admin selects a plan and enters a payment method to transition `Subscription.status` from `trialing`/`past_due` to `active`
- A nightly job that flags trials nearing expiry, flags expired unconverted trials, and restricts access accordingly
- The marketing site's `?plan=starter` / `?plan=growth` query param (from `pricing.md`'s CTA buttons) pre-selects that plan on `/app/subscribe`, without forcing payment before trial start

### 🛠 Implementation details

**Files to create:**
```
apps/api/src/billing/subscription.service.ts         plan/trial/subscription state machine
apps/api/src/billing/billing-provider.adapter.ts      wraps Stripe/Razorpay SDK behind one interface
apps/api/src/billing/jobs/trial-expiry.job.ts         nightly: flag expiring/expired trials
apps/web/app/signup/page.tsx                          reads ?plan= param, passes through to onboarding then subscribe
apps/web/app/subscribe/page.tsx                       plan selection + payment method capture
```

**Tech decisions** (locked from blueprint stage 04 — extend, do not re-litigate the core stack):
- `Subscription` is a new entity, org-scoped, independent of the `Payment` entity from `04-architecture.md` — the two must never share a table or service, since one is AddMin's revenue and the other is the customer's own vendor/rent payments.
- Billing provider access goes through `BillingProviderAdapter`, never called directly from `SubscriptionService` — this mirrors the "no god services" rule from `04-architecture.md` and keeps a Stripe-to-Razorpay swap (or vice versa) contained to one file.
- No card/payment credential data is ever stored in AddMin's own database — only the billing provider's customer/subscription reference IDs, consistent with the PCI-DSS constraint already stated in `04-architecture.md`'s NFRs.

**Patterns (mandatory across the codebase):**
- Every `@RequiresRole()`-protected route added in this step additionally checks `Subscription.status` via a `SubscriptionGuard` layered on top of Step 03's `AuthzGuard` — role/office authorization and billing-status authorization are two separate concerns, never merged into one check.
- Trial and subscription state transitions go through a single `SubscriptionService.transitionStatus()` method (`trialing → active`, `trialing → expired`, `active → past_due → active`, `active → canceled`) — no controller sets `Subscription.status` directly, mirroring the pattern already established for `ObligationInstance` and `UtilityBill` status.
- Onboarding (Step 04) and office activation are never blocked by subscription status — a trialing org has full functional access; only continued access *after* trial expiry without a plan is gated.

### ✅ Acceptance rubric
- [ ] Completing signup (Step 03) creates exactly one `Subscription` in `trialing` status with `trial_ends_at` = signup time + 14 days, with no payment method required.
- [ ] A user can complete the entire Guided Onboarding wizard (Step 04) and activate an office while `Subscription.status` is `trialing`, with zero billing prompts interrupting that flow.
- [ ] Visiting `/signup?plan=growth` (matching the marketing site's pricing-page CTA) pre-selects the Growth plan on `/app/subscribe` without charging the card until the user explicitly confirms.
- [ ] Submitting valid payment details on `/app/subscribe` transitions `Subscription.status` to `active` and is reflected within 5 seconds, verified against the billing provider's own dashboard/webhook.
- [ ] The nightly trial-expiry job sends a reminder notification at 3 days and 1 day before `trial_ends_at`.
- [ ] An org whose trial expires with `Subscription.status` still `trialing` (no plan chosen) transitions to `expired`, and subsequent API calls for that org are blocked by `SubscriptionGuard` with a clear "trial expired — choose a plan" response, distinct from a 403 authorization failure.
- [ ] A failed payment method on `/app/subscribe` shows a specific billing-provider error message and does not leave `Subscription.status` in an ambiguous intermediate state.
- [ ] Every subscription status transition produces an `AuditLog` entry, consistent with every other state-changing action in the product.

### ⚠️ Edge cases to handle
- Billing provider webhook for a successful payment arrives before the user's browser redirect back from `/app/subscribe` completes — `SubscriptionService` must be idempotent on webhook receipt, not dependent on the browser-side confirmation as the source of truth.
- An org's card is charged successfully but the webhook delivery fails/is delayed — reconcile via a periodic poll against the billing provider, don't leave the org incorrectly gated as `expired` due to a missed webhook.
- A user starts a trial, completes onboarding, and never returns until after `trial_ends_at` — on their next login, they land on `/app/subscribe` immediately, not on a broken or blank Office Home.
- Enterprise-tier prospects (from `pricing.md`'s "Contact Sales" path) don't go through this self-serve flow at all — an org created via a sales-assisted process can have its `Subscription` set directly to `active` with a manually agreed plan, bypassing the trial state entirely.

### ❌ Common pitfalls (do NOT do these)
- Don't gate onboarding (Step 04) behind requiring a payment method — this directly contradicts the marketing site's stated promise ("no card required" on `pricing.md`'s FAQ) and will show up as a broken funnel the first time a real prospect clicks "Start Free Trial."
- Don't store raw card numbers or CVV anywhere in AddMin's own database "temporarily" — this is a PCI-DSS violation from the first commit, not just a later cleanup item.
- Don't conflate this subscription/billing gate with Step 03's `AuthzGuard` role/office checks — a user can be perfectly authorized by role and office scope and still be correctly blocked because their org's trial expired; these are independent gates that must both pass.
- Don't trust the billing provider's client-side SDK confirmation alone to mark a subscription active — always confirm via the authoritative server-to-server webhook or API callback, since client-side confirmation can be spoofed or can fail silently after actually succeeding on the provider's side.

### 📊 Quality bar
- Trial-to-active conversion completes end-to-end (`/app/subscribe` submit → `Subscription.status = active`) in under 5 seconds under normal billing-provider latency.
- Zero raw payment credential fields present anywhere in AddMin's own schema (grep-verifiable, same standard as Step 02's `Float`-for-money check).
- Trial-expiry job correctly classifies 100% of trialing orgs against their exact `trial_ends_at` timestamp in a seeded test set spanning past, today, and future expiry dates.

### 🛑 Stop and review (gate before next step)
1. Sign up as a new test org via the marketing site's actual "Start Free Trial" link (or its `/signup?plan=starter` equivalent). Confirm a `trialing` `Subscription` exists with no payment method captured.
2. Complete the full onboarding wizard from Step 04 and activate an office — confirm nothing in that flow prompted for billing.
3. Go to `/app/subscribe`, confirm the plan pre-selected from the signup URL matches, submit a test payment method, and confirm `Subscription.status` flips to `active` and an `AuditLog` entry is recorded.
4. Manually backdate a second test org's `trial_ends_at` into the past and run the trial-expiry job — confirm that org's subsequent API calls are blocked with the specific "trial expired" response, not a generic 403 or a silent pass-through.

---

## Build Step 06 — Platform Operator Console (F-20)

### 🎯 Goal
A Platform Operator — an AddMin-internal identity, never a customer role — can log into a separate `/platform` login, see every customer Organization with its plan/Subscription/tenant status, and manually activate a Subscription or suspend/reactivate a tenant; no customer-scoped session can reach any of it.

### 📍 Why this is the leaf
F-19's own alternate flow (the sales-assisted Enterprise/design-partner path) already assumes someone inside AddMin can set a `Subscription` to `active` outside the self-serve flow — Step 05 built the state machine but nothing that lets a human actually drive it for that case. This step is intentionally small: per `03-analysis.md`'s scoping decision, it implements a single internal role with cross-org read/write on two fields, not Epic 0's full Group hierarchy, Membership abstraction, permission catalogue, or break-glass consent flow. Steps 07 onward don't depend on this one technically, but it must exist before Phase 2's first sales-assisted pilot organization is onboarded (per `07-phases.md`).

### 📥 Inputs (preconditions before you start)
- Step 02 complete: the 19 core entities are already migrated and seeded (per this repo's own history — `d992408`)
- Step 05 complete: `Subscription` exists and its state machine (`trialing → active → past_due → expired → canceled`) works
- Step 03 complete: `AuthzGuard` and the audit-logging pattern are established — this step reuses both patterns for a new, deliberately separate identity type

### 📤 Outputs (what exists after this step passes)
- An **additive** migration adding `tenant_status` (enum: `active`, `suspended`, default `active`) to `Organization`, and a new `PlatformOperator` table — entirely separate from the customer `User` table, per `04-architecture.md`'s data model
- `/platform/signin`, `/platform/organizations`, `/platform/organizations/[orgId]` frontend routes, reachable only by a `PlatformOperator` session
- `GET /internal/organizations`, `PATCH /internal/organizations/:id/tenant-status`, `PATCH /internal/organizations/:id/subscription` API endpoints, gated by a new `PlatformOperatorGuard` distinct from Step 03's `AuthzGuard`
- A `TenantStatusGuard` check layered into the existing request pipeline: a `suspended` org's API calls are rejected regardless of role, office scope, or subscription status

### 🛠 Implementation details

**Files to create:**
```
packages/db/prisma/migrations/<timestamp>_add_platform_operator/   additive migration — do not touch the Step 02 migration
apps/api/src/platform-ops/platform-operator-auth.service.ts        separate login/session issuance for PlatformOperator
apps/api/src/platform-ops/platform-operator.guard.ts                rejects any request without a valid PlatformOperator session
apps/api/src/platform-ops/tenant-status.guard.ts                    rejects any request where Organization.tenant_status = suspended
apps/api/src/platform-ops/platform-organizations.service.ts         cross-org list/read/write on Organization + Subscription
apps/web/app/platform/signin/page.tsx
apps/web/app/platform/organizations/page.tsx
apps/web/app/platform/organizations/[orgId]/page.tsx
```

**Tech decisions** (locked from blueprint stage 04 — extend, do not re-litigate the core stack):
- `PlatformOperator` is its own table with its own session/login flow, never a row in `User` with a special role flag — this mirrors Epic 0's actual design (a platform-level identity is not a Membership of any org) and, more practically, makes it structurally impossible for a customer-side privilege escalation bug to ever grant Platform Operator access, since the two tables share no schema.
- `TenantStatusGuard` runs independently of and in addition to Step 03's `AuthzGuard` and Step 05's `SubscriptionGuard` — three separate gates (authorization, billing, tenant status), each with its own single responsibility, none merged into a combined mega-check.
- The `/platform` route tree is never linked from the customer `Web App` — no shared layout, no shared nav component, so there is no accidental code path from a customer session into a Platform Operator page.

**Patterns (mandatory across the codebase):**
- Every `/internal/*` endpoint requires `PlatformOperatorGuard` explicitly — there is no global default that could accidentally expose one, mirroring Step 03's "protected by default" rule but for a completely separate identity space.
- Every write from `platform-organizations.service.ts` produces an `AuditLog` entry tagged with the acting `PlatformOperator`'s id, using the exact same Audit Module as every other write in the system — there is no separate, weaker audit path for internal tooling.
- `Organization.tenant_status` is changed only through `PlatformOperationsModule` — no other module ever writes this field, so `grep`ing for writes to `tenant_status` should return exactly one call site.

### ✅ Acceptance rubric
- [ ] The additive migration runs cleanly on top of the existing Step 02 migration history with zero changes to already-applied migration files.
- [ ] A valid customer `User` session (any role, including the org-scoped "Platform Administrator") receives a 403 when calling any `/internal/*` endpoint or loading `/platform/*` — verified with a direct test using a real customer session token.
- [ ] `/platform/organizations` lists every seeded Organization with correct plan, Subscription status, and tenant_status.
- [ ] Setting a Subscription to `active` with a chosen plan through `/platform/organizations/[orgId]` produces the identical state as F-19's self-serve `/app/subscribe` path — verified by checking the customer's next `/app` load sees no special-casing.
- [ ] Suspending an org's `tenant_status` causes every subsequent API call from that org's users to fail, even for an org whose `Subscription.status` is `active` — tested by suspending a test org with an active subscription and confirming access is still blocked.
- [ ] Reactivating a suspended org restores access on its very next API call, with no re-login required by the affected customer users.
- [ ] Every tenant-status or subscription change made via `/platform` produces an `AuditLog` entry identifying the acting `PlatformOperator`, distinguishable from customer-side audit entries.
- [ ] `PlatformOperator` accounts require MFA before they can access `/platform/organizations`.

### ⚠️ Edge cases to handle
- A Platform Operator suspends an org mid-trial — `trial_ends_at` and `Subscription.status` are untouched; suspension is orthogonal, so reactivating returns the org to exactly the trial/subscription state it had before suspension.
- Two Platform Operators edit the same org concurrently — the later write wins and is fully audited, but the UI should surface a "this record changed since you loaded it" warning rather than silently overwriting.
- A suspended org's user attempts to log in — they see a specific "your organization's access has been suspended, contact support" message, not a generic authentication failure or a confusing blank state.

### ❌ Common pitfalls (do NOT do these)
- Don't add a `platform_operator: boolean` flag to the existing `User` table "to save a migration" — this collapses the deliberate separation between customer identities and AddMin-internal identities that makes cross-tenant privilege escalation structurally impossible; a shared table makes it merely a bug away.
- Don't let `TenantStatusGuard` and Step 05's `SubscriptionGuard` become one combined check "since they're related" — an org can be suspended with an active subscription (e.g., abuse) or active with an expired trial; conflating them produces incorrect access decisions in exactly the cases this feature exists to handle correctly.
- Don't edit the Step 02 migration file to add `tenant_status` retroactively — this repository already ran that migration in production/staging (commit `d992408`); editing history instead of adding a new migration will desync any environment that already applied it.
- Don't skip MFA for `PlatformOperator` accounts because "it's just internal" — this is the single account type in the entire system with cross-org access; it is the highest-value target in the product, not the lowest.

### 📊 Quality bar
- `/internal/*` endpoints reject an unauthenticated or customer-scoped request in under 100ms (fail fast, no unnecessary work before the guard check).
- Zero shared code path between `PlatformOperatorGuard` and `AuthzGuard` beyond the underlying session-verification primitive — confirmed by code review, not just testing.

### 🛑 Stop and review (gate before next step)
1. Apply the new migration on a copy of the current (already-Step-02-migrated) database — confirm it applies cleanly and existing seeded data is untouched.
2. Attempt to load `/platform/organizations` using a valid customer session token (any role) — confirm 403.
3. Log in as a seeded `PlatformOperator`, view the org list, set a test org's Subscription to `active` on a chosen plan, then suspend a different test org.
4. Attempt an API call as a user belonging to the suspended org — confirm it is blocked, then reactivate the org and confirm the same call succeeds immediately without that user logging out and back in.
5. Check the audit log for both actions — confirm each is attributed to the acting Platform Operator, not to any customer identity.

---

## Build Step 07 — Utility Connection + Recurring Obligation Engine (F-06, F-07, F-08)

### 🎯 Goal
Creating a utility connection automatically generates a recurring obligation schedule; the nightly job generates the next expected bill instance ahead of time; an instance that passes its expected window without a linked bill is automatically flagged Missing and notified.

### 📍 Why this is the leaf
This is the structural moat identified in `03-analysis.md` — the feature no competitor in `02-research.md`'s research has. Step 08's entire bill-approval-payment flow operates on the `ObligationInstance` records this engine produces; without this step working correctly first, Step 08 has nothing real to attach bills to.

### 📥 Inputs (preconditions before you start)
- Step 04 complete: an active office exists with utilities marked "Yes" in onboarding
- A background job runner configured (BullMQ + Redis per `04-architecture.md`)

### 📤 Outputs (what exists after this step passes)
- `POST /api/utility-accounts` creates a connection and a linked `RecurringObligationSchedule` (F-06)
- A nightly job generates `ObligationInstance` records ahead of `expected_date` for every active schedule (F-07)
- A nightly job flags overdue-expected instances as `missing` and triggers a notification (F-08)

### 🛠 Implementation details

**Files to create:**
```
apps/api/src/utility/utility-account.service.ts
apps/api/src/obligation-engine/obligation-schedule.service.ts
apps/api/src/obligation-engine/obligation-instance.service.ts
apps/api/src/obligation-engine/jobs/generate-instances.job.ts      nightly cron
apps/api/src/obligation-engine/jobs/flag-missing.job.ts            nightly cron
apps/web/app/utilities/new/page.tsx
apps/web/app/utilities/[id]/page.tsx
```

**Tech decisions:**
- Jobs are idempotent by construction: `generate-instances.job.ts` checks for an existing instance for `(schedule_id, period)` before creating one, so a re-run (e.g., after a crash) never duplicates.
- Job scheduling via BullMQ repeatable jobs, not a naive `setInterval` — survives process restarts.

**Patterns:**
- `RecurringObligationSchedule` creation is never exposed as a direct user-facing endpoint — it is always created as a side effect of creating a `UtilityAccount`, `Lease`, `AMCContract`, or applicable `ComplianceItem`, enforced inside each of those services, not left to the frontend to remember to call separately.
- All obligation status transitions go through a single `ObligationInstanceService.transitionStatus()` method that validates the transition is legal (per the state diagram in the PRD's Section 19) — no controller sets `status` directly.

### ✅ Acceptance rubric
- [ ] Creating a utility connection with a billing cycle immediately creates exactly one active `RecurringObligationSchedule`.
- [ ] Running the nightly generation job creates an `ObligationInstance` with status `expected` for every active schedule whose next period is within the configured lead window.
- [ ] Running the generation job twice in a row for the same period does not create a duplicate instance (idempotency test).
- [ ] An instance whose `expected_date` plus configured grace window has passed with no linked bill transitions to `missing` automatically, without manual intervention.
- [ ] A `missing` instance appears in the associated Office Admin's notification feed within one job run cycle.
- [ ] Deactivating a `UtilityAccount` stops future instance generation but leaves historical instances untouched and queryable.
- [ ] A bill entered against an instance still in `expected` status transitions that instance to `received`/`in_process`, not just creates an orphan bill record.

### ⚠️ Edge cases to handle
- The nightly job fails to run for one night (deploy issue, outage) — the next successful run's catch-up logic must generate any missed instance without creating duplicates for periods that were correctly generated earlier.
- A utility connection's billing cycle is edited mid-period — the currently in-flight instance keeps its original period, only future generation uses the new cycle.
- An office is deactivated while it has open `expected`/`missing` instances — those instances remain visible in audit/history views but produce no further notifications.

### ❌ Common pitfalls (do NOT do these)
- Don't generate the obligation instance ON `expected_date` — F-07's whole value proposition is generating it ahead of time; generating late defeats the entire "proactive" positioning from `01-idea.md`.
- Don't let two overlapping cron runs process the same schedule concurrently — use a job-level lock or rely on the idempotency check being airtight, verified under concurrent execution, not just sequential testing.
- Don't silently drop a "missing" flag once a bill eventually arrives without recording that it was ever late — the audit trail should show a bill was received after being flagged missing, not erase the history.

### 📊 Quality bar
- Nightly generation job processes 20,000 active schedules (the NFR portfolio size from the PRD) in under 5 minutes.
- Missing-bill flagging job runs and completes within 2 minutes for the same portfolio size.

### 🛑 Stop and review (gate before next step)
1. Create a utility connection with a monthly billing cycle. Manually trigger the generation job. Confirm exactly one `expected` instance exists for the upcoming period.
2. Trigger the generation job again immediately. Confirm no duplicate instance was created.
3. Manually set the instance's `expected_date` into the past, then trigger the missing-flag job. Confirm the instance transitions to `missing` and a notification record is created.
4. Enter a bill against that now-`missing` instance. Confirm it transitions correctly and the audit history shows it was previously flagged missing.

---

## Build Step 08 — Bill Entry + Approval Workflow + Payment Tracking (F-09, F-10, F-11)

### 🎯 Goal
A bill can be entered, submitted, approved (or rejected/returned) by a Checker with mandatory remarks on rejection/return, and paid/recorded by a Payment Authorizer within their configured authorization limit — the full flow the PRD's acceptance criteria calls "end-to-end."

### 📍 Why this is the leaf
This is the first fully closed obligation lifecycle in the product and the flow every design-partner demo in `07-phases.md`'s Phase 1 exit criteria depends on. It is also the first place Step 03's segregation-of-duties enforcement gets exercised against real financial actions, not just a synthetic test.

### 📥 Inputs (preconditions before you start)
- Step 07 complete: `ObligationInstance` records with status `expected`/`missing` exist to attach bills to
- Step 04's role assignment step has assigned at least one Checker and one Payment Authorizer to the test office

### 📤 Outputs (what exists after this step passes)
- Bill entry, invoice upload, and bulk entry working (F-09)
- Approval routing with amount-threshold-based multi-step chains, Approve/Reject/Return actions (F-10)
- Payment Tracking Mode recording with authorization-limit enforcement and automatic overdue flagging (F-11)

### 🛠 Implementation details

**Files to create:**
```
apps/api/src/utility/bill.service.ts
apps/api/src/workflow/approval.service.ts            routing, authorization-limit checks
apps/api/src/workflow/workflow-definition.seed.ts     default approval chains
apps/api/src/payment/payment.service.ts               tracking-mode recording, overdue job
apps/api/src/payment/jobs/flag-overdue.job.ts
apps/web/app/bills/new/page.tsx
apps/web/app/bills/[id]/page.tsx
apps/web/app/approvals/page.tsx
```

**Tech decisions:**
- Approval routing resolves the approver chain at submission time and stores it against the bill, per F-10's edge case ("in-flight bill uses the threshold that was active at submission time") — never re-resolve dynamically at approval time.
- Payment recording validates the authorization limit server-side inside `PaymentService`, called from the controller — never trust a client-supplied "this is within my limit" flag.

**Patterns:**
- Reject/Return actions share one endpoint shape requiring a non-empty `remark` field, validated server-side (not just a frontend `required` attribute) — per F-10's acceptance criteria.
- Bill status transitions go through a single `BillService.transitionStatus()` method mirroring the pattern established in Step 07 for obligation instances — no direct Prisma `update` calls to `status` scattered across the codebase.

### ✅ Acceptance rubric
- [ ] Bill entry rejects an amount ≤ 0 and a missing due date before allowing save.
- [ ] Entering a bill for a duplicate `(utilityAccountId, billingPeriod)` combination shows a warning before submission.
- [ ] Submitting a bill with no approver configured for its office/utility/amount combination is blocked with a specific configuration error, not a silent failure or crash.
- [ ] A Checker can Approve, Reject (with remark), or Return for Correction (with remark) — attempting Reject/Return with an empty remark fails server-side validation.
- [ ] The Maker who submitted a bill cannot approve that same bill, verified with an explicit test using the same user ID for both actions.
- [ ] An approved bill enters the Payment Authorizer's queue and is blocked from payment recording if the amount exceeds that authorizer's configured limit.
- [ ] Recording a partial payment correctly updates the bill status to `partially_paid` and displays the remaining balance.
- [ ] The overdue job flags any unpaid bill past its due date as `overdue` without manual action, and clears the flag automatically once paid.
- [ ] Every approve/reject/return/payment action produces a corresponding `AuditLog` entry with before/after status.

### ⚠️ Edge cases to handle
- Two Payment Authorizers attempt to record payment on the same bill simultaneously — the second request must fail with an "already recorded" error, not create a duplicate payment (test with a concurrent request, not just sequential).
- A bill is returned for correction multiple times — the full history of each round-trip must remain visible to both Maker and Checker, not just the latest remark.
- A payment amount greater than the remaining bill balance is submitted — reject it, don't silently create a credit.

### ❌ Common pitfalls (do NOT do these)
- Don't resolve the approval chain fresh every time someone views the bill — if the org's threshold configuration changes after submission, the PRD requires the originally-resolved chain to still apply to that in-flight bill.
- Don't implement the Maker-cannot-approve-own-bill check only in the frontend button's disabled state — this must be a server-side check in `ApprovalService`, verified by directly calling the API as that user.
- Don't let a payment recording silently succeed above the authorizer's limit "because it's just tracking mode, not real money movement" — the control value of Payment Tracking Mode per `03-analysis.md`'s go-to-market strategy IS the enforced limit; skipping this defeats the entire feature's purpose.

### 📊 Quality bar
- Bill submission-to-approval-notification latency under 5 seconds.
- Zero duplicate payments possible under concurrent submission (verified with a load test issuing simultaneous requests).

### 🛑 Stop and review (gate before next step)
1. As a Maker, enter and submit a bill. Confirm it appears in the correct Checker's queue based on configured routing.
2. Attempt to approve it as the same Maker user via direct API call — confirm rejection.
3. As the Checker, return it for correction with a remark. Confirm it reappears in the Maker's queue with the remark visible.
4. Resubmit, approve, then record a partial payment as the Payment Authorizer. Confirm the remaining balance is correct and the bill status is `partially_paid`.
5. Manually backdate the due date on a second unpaid bill and run the overdue job — confirm it flags as `overdue`.

---

## Build Step 09 — Property & Lease + TDS (F-12, F-13)

### 🎯 Goal
A rented office has a landlord, lease, and auto-generated monthly rent obligation; renewal reminders fire at configured intervals; TDS is calculated correctly on rent payments and blocked when a TDS-applicable landlord has no configured rate.

### 📍 Why this is the leaf
This closes the second problem cluster from `02-research.md` (lease expiry surprises) and the TDS risk flagged as requiring Finance/CA sign-off in `03-analysis.md`'s risk matrix — get the TDS math wrong here and it damages the exact trust this feature is meant to build.

### 📥 Inputs (preconditions before you start)
- Step 08 complete: Payment recording and authorization-limit enforcement already work for utility bills — Lease rent payments reuse the same `PaymentService`
- Step 04's onboarding wizard already branches into "Rented" — this step implements what that branch creates

### 📤 Outputs (what exists after this step passes)
- Landlord and Lease CRUD with rent schedule auto-generation (F-12)
- Renewal reminders at 180/90/60/30 days (F-12)
- TDS calculation integrated into the rent payment flow (F-13)

### 🛠 Implementation details

**Files to create:**
```
apps/api/src/property/landlord.service.ts
apps/api/src/property/lease.service.ts               creates RecurringObligationSchedule for rent
apps/api/src/property/jobs/renewal-reminder.job.ts
apps/api/src/tds/tds.service.ts                       rate resolution + calculation
apps/web/app/property/leases/new/page.tsx             Lease Setup wizard
apps/web/app/property/leases/[id]/page.tsx
```

**Tech decisions:**
- TDS rate resolution order: landlord-specific override → organization default → block if neither exists and landlord is flagged TDS-applicable. This resolution logic lives in one function (`TdsService.resolveRate()`), never duplicated inline at each call site.
- Lease renewal reuses the same notification infrastructure built for Step 07's missing-bill alerts, not a separate one-off reminder mechanism.

**Patterns:**
- Rent obligation generation reuses `ObligationScheduleService` from Step 07 exactly as-is (scope_type = `rent`) — do not fork a parallel obligation mechanism specific to leases.
- Escalation clause application is a scheduled job that updates the schedule's amount at the configured effective date — it does not retroactively change already-generated past instances.

### ✅ Acceptance rubric
- [ ] Marking an office "Rented" and completing landlord + lease details creates an active `Lease` and exactly one monthly rent `RecurringObligationSchedule`.
- [ ] Lease end date earlier than or equal to start date is rejected at save time with a clear validation error.
- [ ] Renewal reminders fire at each of 180/90/60/30 days before lease expiry, verified by manually setting a lease's end date and running the reminder job.
- [ ] A TDS-applicable landlord with no configured rate blocks the rent payment with a specific validation error naming the missing configuration — payment is not silently processed at 0% TDS.
- [ ] TDS calculation produces the correct net payable amount for a landlord-specific override rate and, separately, for the organization default rate, tested against both paths.
- [ ] TDS deduction history is queryable landlord-wise for a given period and exportable.
- [ ] Escalation clause changes the rent schedule's amount starting from its effective date, with prior-period instances retaining their original amount.

### ⚠️ Edge cases to handle
- Lease is renewed with a different rent amount — the new amount applies only to future rent instances; already-closed prior instances are untouched.
- Lease is terminated mid-cycle — cancel remaining future-period instances for that schedule rather than leaving them dangling in `expected` status forever.
- TDS rate is changed at the organization level mid-year — already-recorded payments retain the rate that was active when they were processed.

### ❌ Common pitfalls (do NOT do these)
- Don't calculate TDS as a client-side display-only value that the server doesn't independently verify before recording the payment — the net payable amount must be computed and validated server-side.
- Don't build a separate obligation-generation code path for rent "since it's slightly different from utility bills" — this duplicates Step 07's carefully-built idempotency and status-transition logic; extend the existing engine instead.
- Don't go live with TDS calculation against real payments before Finance/CA sign-off on rate configuration, per the explicit open decision in the PRD's Section 30 — gate this behind a feature flag if a design partner needs the rest of the lease module before that sign-off lands.

### 📊 Quality bar
- TDS calculation and net payable amount are accurate in 100% of a test matrix covering landlord-override, org-default, and missing-config scenarios.
- Renewal reminder job correctly identifies all leases within each alert window in under 1 minute for a 50-office portfolio.

### 🛑 Stop and review (gate before next step)
1. Create a landlord and a lease with a rent amount and TDS-applicable flag but no TDS rate configured. Attempt to record a rent payment — confirm it's blocked with a specific error.
2. Configure a TDS rate for that landlord. Retry the payment — confirm the net payable amount is mathematically correct.
3. Set a second lease's end date to trigger the 90-day reminder window, run the reminder job, confirm the notification fires exactly once (not duplicated on a second run the same day).
4. Attempt to save a lease with an end date before its start date — confirm rejection.

---

## Build Step 10 — Vendor, Maintenance, Asset, Compliance (F-14, F-15, F-16, F-17)

### 🎯 Goal
Vendors can be registered and linked to AMC contracts with renewal alerts; maintenance requests route to vendors with SLA tracking and evidence capture; assets can be registered and requested/allocated through the Employee → Manager → Admin flow; compliance certificates are tracked with expiry alerts and escalation.

### 📍 Why this is the leaf
These four modules complete the P0 module set from `07-phases.md`'s Phase 2 and are what makes AddMin usable for a design partner's full real office, not just the utility/lease wedge. They share the Obligation Engine (AMC and compliance renewal) and Workflow modules built in Steps 05-06, so building them after those steps reuses infrastructure instead of duplicating it.

### 📥 Inputs (preconditions before you start)
- Step 07's Obligation Engine (AMC and compliance items reuse the same schedule/instance mechanism)
- Step 08's Workflow module (asset request approval reuses the Maker-Checker pattern)

### 📤 Outputs (what exists after this step passes)
- Vendor registration, activation gating, and AMC renewal alerts (F-14)
- Maintenance request → work order → SLA escalation → verified closure, with photo/video evidence (F-15)
- Asset register and Employee → Manager → Admin → allocation request flow (F-16)
- Compliance checklist with expiry tracking and Office Head escalation (F-17)

### 🛠 Implementation details

**Files to create:**
```
apps/api/src/vendor/vendor.service.ts
apps/api/src/vendor/amc.service.ts                    reuses ObligationScheduleService
apps/api/src/maintenance/maintenance-request.service.ts
apps/api/src/maintenance/work-order.service.ts
apps/api/src/maintenance/sla-escalation.job.ts
apps/api/src/asset/asset.service.ts
apps/api/src/asset/asset-request.service.ts            reuses ApprovalService pattern
apps/api/src/compliance/compliance-item.service.ts
apps/api/src/compliance/compliance-escalation.job.ts
apps/web/app/vendors/**, /app/maintenance/**, /app/assets/**, /app/compliance/**
```

**Tech decisions:**
- AMC renewal and Compliance expiry both create `RecurringObligationSchedule` records (scope_type = `amc` / `compliance`) — same engine as utility and rent, no new mechanism.
- Asset request approval reuses the `ApprovalService` abstraction from Step 08, configured with a different chain (Employee → Manager → Admin) rather than a bespoke state machine.

**Patterns:**
- Photo/video evidence uploads go through the shared Document module (`04-architecture.md`), tagged with `before`/`after` and uploader/timestamp — not a maintenance-specific upload path.
- Compliance escalation reuses the same notification/escalation infrastructure as SLA escalation — one escalation mechanism, parameterized by threshold and recipient role, not two separate implementations.

### ✅ Acceptance rubric
- [ ] A vendor in `pending_activation` status cannot be assigned to any work order or AMC contract.
- [ ] AMC renewal alerts fire at 60 and 30 days before contract expiry.
- [ ] A maintenance request can route to a vendor, track an SLA due time, and be blocked from closure until an Admin explicitly verifies completion.
- [ ] SLA breach on an open work order triggers an escalation notification automatically.
- [ ] Photo/video evidence is stored with timestamp, uploader, and a before/after distinction.
- [ ] An asset request moves Employee → Manager approval → Admin review → (existing asset allocated OR Procurement handoff recorded) → Closed, with the custodian correctly linked at the end.
- [ ] A compliance item's status accurately reflects Valid/Expiring/Expired/Missing/Not Applicable at every point, recalculated on every relevant change.
- [ ] An expired compliance item unresolved past the configured SLA (PRD default: 15 days) escalates to Office Head automatically.

### ⚠️ Edge cases to handle
- Vendor completes work but Admin verification finds it unsatisfactory — the work order reopens with a remark rather than closing silently.
- An asset category has no available existing stock — the request correctly routes to a Procurement handoff state rather than getting stuck with no valid next action.
- A compliance certificate is renewed with a backdated effective date — expiry countdown uses the new certificate's actual expiry date, not the date the renewal was recorded.

### ❌ Common pitfalls (do NOT do these)
- Don't build a bespoke state machine for asset-request approval "because it's a bit different" — reusing Step 08's `ApprovalService` with a different configured chain keeps segregation-of-duties enforcement consistent everywhere, including here.
- Don't let compliance escalation silently stop once a certificate is marked Expired without renewal — per PRD Section 23, expired/missing mandatory compliance must remain visible until renewed or explicitly marked Not Applicable by an authorized role, not just logged once and forgotten.
- Don't allow a vendor performance review to be skippable before an AMC renewal decision if the organization has configured it as required — check this server-side, not just as a UI nudge.

### 📊 Quality bar
- SLA escalation job correctly identifies all breaching work orders within 1 minute of the configured threshold passing.
- Photo/video upload supports files up to the organization's configured max size without losing already-entered maintenance request data on failure.

### 🛑 Stop and review (gate before next step)
1. Register a vendor, confirm it cannot be assigned to a work order until activated.
2. Create a maintenance request, assign it to the activated vendor with a near-term SLA, let the SLA pass, run the escalation job — confirm escalation fires.
3. Submit an employee asset request with no existing stock available — confirm it reaches a Procurement handoff state rather than dead-ending.
4. Mark a compliance certificate expired and leave it unresolved past the configured threshold — run the escalation job, confirm Office Head is notified.

---

## Build Step 11 — Reporting: Office Home, My Actions, Executive Dashboard (F-18)

### 🎯 Goal
Every dashboard reads live transactional data (never dummy KPIs), My Actions aggregates pending items across every module built in Steps 05-08 into one queue, and the Executive Dashboard's every KPI drills down to its source records.

### 📍 Why this is the leaf
This is the feature `03-analysis.md` identifies as the artifact that drives renewal sponsorship from the Office Head persona — and the PRD's Section 1.2 explicitly forbids dummy KPI data in any environment a real user sees, making correctness here a hard release gate, not a polish item.

### 📥 Inputs (preconditions before you start)
- Steps 05-08 complete: real obligation, bill, lease, maintenance, asset, and compliance data exists to aggregate
- Reporting Module's read model approach decided per `04-architecture.md` (read-only aggregation across transactional modules, with a nightly refresh job for expensive rollups)

### 📤 Outputs (what exists after this step passes)
- `/app/offices/[officeId]` Office Home reading live data
- `/app/my-actions` aggregating pending items across every module
- `/app/reports/executive` with working drill-down on every KPI

### 🛠 Implementation details

**Files to create:**
```
apps/api/src/reporting/office-home.service.ts
apps/api/src/reporting/my-actions.service.ts          cross-module query aggregator
apps/api/src/reporting/executive-dashboard.service.ts
apps/api/src/reporting/jobs/refresh-aggregates.job.ts
apps/web/app/offices/[officeId]/page.tsx
apps/web/app/my-actions/page.tsx
apps/web/app/reports/executive/page.tsx
```

**Tech decisions:**
- KPI definitions are implemented exactly as specified in the PRD's Section 25 (e.g., "Overdue Bills = unpaid amount where due date < current date") — these formulas are the contract; do not approximate or simplify them.
- My Actions queries each module's service directly for "items assigned to me" rather than maintaining a separate denormalized "tasks" table that can drift out of sync with the source data.

**Patterns:**
- Every dashboard component that displays a KPI accepts an `onDrillDown` handler that navigates to the filtered source-record list — never a static number with no click target.
- No dashboard query result is ever mocked, stubbed, or hard-coded in a way that could reach a production or demo environment — this is checked explicitly in the Step 11 review gate below, not assumed.

### ✅ Acceptance rubric
- [ ] Office Home for a newly activated office with zero obligations yet shows an explicit "getting started" empty state, not a broken or misleadingly-zeroed chart.
- [ ] My Actions correctly aggregates at least one pending item each from Utility (pending approval), Lease (renewal due), Maintenance (open request), and Compliance (expiring item) for a test office seeded with all four.
- [ ] Every KPI on the Executive Dashboard, when clicked, navigates to a filtered list of exactly the source records that KPI counts.
- [ ] Filters (office/module/period/status) combine correctly and are reflected in the URL, verified by copy-pasting a filtered URL into a new browser session and confirming the same filtered view loads.
- [ ] Dashboard and list views load within 3 seconds for a seeded portfolio of 50 offices / 20,000 utility records (the NFR from the PRD).
- [ ] No dashboard in the staging or production environment displays a hard-coded or placeholder KPI value under any circumstance — verified by code review, not just visual check.
- [ ] Export to PDF/Excel produces a file matching the currently applied filters, not the full unfiltered dataset.

### ⚠️ Edge cases to handle
- A drill-down target record has since been archived or deleted — show a graceful "record no longer available" message instead of a broken link or 500 error.
- A user with access to only one office views the Executive Dashboard — it correctly scopes to just their accessible office(s), never leaking data from offices outside their role/office scope (this re-exercises Step 03's authorization layer at the reporting layer specifically).

### ❌ Common pitfalls (do NOT do these)
- Don't leave a "demo mode" flag anywhere in the codebase that swaps in sample KPI data — the PRD is explicit that this is unacceptable for production/UAT, and a flag left in "off" by default has a way of getting flipped on accidentally during a live customer demo.
- Don't build the Executive Dashboard's aggregation as a live join across all transactional tables on every page load if the portfolio-size performance target can't be met that way — use the nightly aggregate-refresh job from `04-architecture.md` and show a "last updated" timestamp instead of a slow live query.
- Don't let My Actions silently drop an item type because its query is slow or errors — a partial-failure in one module's query should degrade that section gracefully, not silently omit those items from the count with no indication anything's missing.

### 📊 Quality bar
- Dashboard load time under 3 seconds at the 50-office/20,000-record benchmark, measured with realistic seeded data, not an empty database.
- Zero hard-coded/mocked KPI values reachable from any non-test environment (verified by grep + manual review before this step's gate passes).

### 🛑 Stop and review (gate before next step)
1. Seed a test organization with realistic data across all modules (utilities, leases, maintenance, assets, compliance) for at least 3 offices.
2. Load Office Home for each office — confirm real, correct data appears, including at least one overdue item and one upcoming renewal.
3. Load My Actions as a user with cross-module pending items — confirm every item type appears and clicking one navigates to the correct detail page.
4. Load the Executive Dashboard, click each KPI, confirm drill-down shows exactly the matching source records.
5. Grep the codebase for any mock/dummy/placeholder KPI data path reachable outside test files — confirm zero results.

---

## Build Step 12 — Frontend polish (loading/empty/error states, design system)

### 🎯 Goal
Every route listed in `06-frontend.md`'s sitemap has an explicit, tested loading state, empty state, and error state — no route shows a blank white screen or an unhandled exception under any of the conditions listed in each page spec.

### 📍 Why this is the leaf
By this point every feature works on the happy path. This step is what makes the product feel trustworthy to a real design-partner Admin encountering a slow network, a first-time empty office, or a failed request — exactly the moments identified in `02-research.md` as make-or-break for a buyer used to "good enough" spreadsheets.

### 📥 Inputs (preconditions before you start)
- Steps 04-09 complete: every route in `06-frontend.md`'s sitemap has working happy-path functionality

### 📤 Outputs (what exists after this step passes)
- Design system tokens from `06-frontend.md` (colors, typography, spacing, radius, shadow, motion) implemented as a shared Tailwind/CSS-variables config
- Every page spec's named empty/loading/error state implemented and visually distinct
- Responsive behavior at mobile/tablet/desktop breakpoints per `06-frontend.md`'s responsive grid

### 🛠 Implementation details

**Files to create:**
```
apps/web/tailwind.config.ts             design tokens from 06-frontend.md
apps/web/components/ui/EmptyState.tsx
apps/web/components/ui/Skeleton.tsx
apps/web/components/ui/ErrorBoundary.tsx
apps/web/components/domain/*.tsx        ObligationCard, ActionQueueItem, ApprovalActionBar, etc. from the component tree
```

**Tech decisions:**
- Tailwind CSS configured with the exact token values from `06-frontend.md`'s design system section (brand `#D97706`, neutral scale, spacing scale 4/8/12/16/24/32/48/64, radius 4/8/12/16).
- Error boundaries are per-section (per `06-frontend.md`'s Office Home spec: "one card failing to load shows an inline retry, doesn't blank the whole page"), not one global catch-all per page.

**Patterns:**
- Every data-fetching component has three explicit render branches: loading, empty, error — never an implicit "if data exists, render; else nothing," which produces a blank screen instead of a designed state.
- Skeleton loading states match the actual layout of the loaded content (per `06-frontend.md`'s Office Home spec: "skeleton cards matching the section layout") — never a generic spinner replacing an entire structured page.

### ✅ Acceptance rubric
- [ ] Every route in `06-frontend.md`'s sitemap renders a named loading state when data-fetching is artificially delayed (test with a throttled network).
- [ ] Every route's documented empty state (from its page spec in `06-frontend.md`) renders correctly when the underlying data is genuinely empty, not just visually similar to the loaded state with zero values.
- [ ] Forcing an API error (e.g., killing the API mid-request) on each of the 8 page specs in `06-frontend.md` shows that page's documented error behavior, not an unhandled exception or blank screen.
- [ ] The design system's color/spacing/radius tokens are used consistently — no component hard-codes a one-off hex value or pixel spacing outside the defined scale (spot-checked across at least 10 components).
- [ ] Mobile (≤640px), tablet (641-1024px), and desktop (≥1025px) breakpoints each render correctly for Office Home, the Onboarding wizard, and the Executive Dashboard, per `06-frontend.md`'s responsive grid rules.
- [ ] Reject/Return remark modals, file upload errors, and form validation errors all use the shared `<FormError>` component consistently, not ad-hoc inline error text per form.

### ⚠️ Edge cases to handle
- A section-level error (e.g., the compliance card on Office Home fails to load) must not cascade into breaking sibling sections on the same page.
- Extremely long content (a vendor name, a long remark) must not break card/table layouts at any breakpoint — verify with intentionally long test strings, not just typical-length sample data.

### ❌ Common pitfalls (do NOT do these)
- Don't build empty states as an afterthought copy-pasted across every page with generic "No data" text — `06-frontend.md` specifies distinct, context-appropriate empty-state copy per page (e.g., Office Home's "You're all set" vs. Approvals' "Nothing pending your approval"); genericizing this undermines the guided, proactive feel that's the whole product thesis.
- Don't let a single slow dashboard section block the entire page's loading state — use independent loading boundaries per section so fast sections render immediately.
- Don't skip testing the error state by just "trusting the try/catch is there" — actually kill the API mid-request during manual testing for each of the 8 page specs; error boundaries silently fail to catch async errors in surprising ways if not tested directly.

### 📊 Quality bar
- Lighthouse accessibility score ≥ 90 on Office Home, Onboarding wizard, and Executive Dashboard (WCAG 2.1 AA is a stated PRD requirement, not optional polish).
- No layout shift (CLS) greater than 0.1 on any of the 8 major pages during their loading-to-loaded transition.

### 🛑 Stop and review (gate before next step)
1. Throttle network to "slow 3G" in devtools and load each of the 8 page specs from `06-frontend.md` — confirm each shows its documented loading state, not a blank screen.
2. Seed a brand-new, empty test office and view Office Home, Approvals, and Compliance register — confirm each shows its specific documented empty state.
3. Kill the API process, then reload each of the 8 page specs — confirm each shows a graceful documented error state, not a browser-level crash or unhandled exception in the console.
4. Resize the browser through mobile/tablet/desktop breakpoints on Office Home, Onboarding, and Executive Dashboard — confirm layout adapts per `06-frontend.md`'s responsive grid rules.
5. Run Lighthouse against the three named pages — confirm accessibility score ≥ 90 on each.

---

## Build Step 13 — Production deploy + observability

### 🎯 Goal
The full application is deployed to a production environment (separate from staging) with error monitoring, structured logging, and alerting configured, meeting the PRD's stated NFRs for availability and performance.

### 📍 Why this is the leaf
Steps 01-10 prove the product works. This step proves it keeps working unattended, which is the actual bar a paying design-partner customer holds you to — per `07-phases.md`'s Phase 3 exit criteria of 99.5% uptime measured over a 4-week window.

### 📥 Inputs (preconditions before you start)
- Steps 01-10 complete and passing on staging
- Production hosting environment provisioned, separate database instance from staging
- Sentry (or equivalent) and a structured logging destination configured

### 📤 Outputs (what exists after this step passes)
- Production environment live at a stable URL, isolated from staging data
- Error monitoring capturing both frontend and backend exceptions with alerting to a real notification channel
- Structured audit and application logs queryable for incident investigation
- A load test confirming the PRD's stated NFRs (300 concurrent users, 3-second dashboard load at 50 offices/20,000 records)

### 🛠 Implementation details

**Files to create:**
```
apps/api/src/observability/logger.ts       structured logging wrapper
apps/api/src/observability/sentry.ts       error capture config
.github/workflows/deploy-production.yml    production deploy pipeline (manual approval gate)
load-tests/dashboard-load.k6.js            load test script matching PRD NFRs
```

**Tech decisions:**
- Production deploys require a manual approval step in CI, unlike staging's automatic deploy-on-merge — a financial-workflow product does not get automatic unattended production deploys.
- Structured JSON logging (not plain-text console logs) so log queries can filter by `orgId`, `officeId`, `userId`, and `requestId` during incident investigation.

**Patterns:**
- Every background job (from Steps 05-08) logs its start, completion, and item-count-processed, so a silently-failing nightly job (e.g., obligation generation not running) is detectable from logs/alerts, not discovered days later when a customer notices missing bills.
- Alerts fire to a real channel (email/Slack) for: job failure, error rate spike, and the health-check endpoint failing — not just recorded silently in a dashboard nobody watches.

### ✅ Acceptance rubric
- [ ] Production environment is reachable at a stable URL, fully isolated from the staging database (verified by confirming staging test data does not appear in production).
- [ ] An intentionally-triggered backend exception appears in the error monitoring tool within 1 minute, with enough context (stack trace, request ID, user/org context) to diagnose without reproducing locally.
- [ ] Killing the nightly obligation-generation job mid-run triggers an alert to the configured notification channel.
- [ ] A load test simulating 300 concurrent authenticated users against the dashboard endpoints completes with no failed requests and p95 latency under the PRD's 3-second target.
- [ ] Production deploy requires an explicit manual approval step and cannot be triggered by an automatic merge.
- [ ] Audit logs from a production action are queryable by `orgId` + date range within seconds, not requiring a full table scan.
- [ ] TLS 1.3 is enforced on all production traffic; verify with an external TLS-checking tool, not just trusting the hosting provider's default.

### ⚠️ Edge cases to handle
- A deploy fails partway through a database migration in production — the deploy pipeline must halt and alert rather than leaving the schema in an inconsistent state that the API then runs against.
- Log volume from structured logging must not silently exceed a cost-relevant threshold — set a retention policy explicitly rather than accumulating indefinitely.

### ❌ Common pitfalls (do NOT do these)
- Don't point production and staging at the same database "temporarily to save setup time" — a single design-partner's real financial data mixed with test data is the kind of mistake that ends a pilot relationship immediately.
- Don't skip the load test because "it probably scales fine" — the PRD's specific NFR numbers (300 concurrent users, 50 offices/20,000 records, 3-second load) are commitments in the source document design partners will have seen; verify them before claiming the product meets them.
- Don't rely solely on the hosting provider's default uptime monitoring — configure your own synthetic health-check ping from an external service so an outage is detected even if the provider's own dashboard has a blind spot.

### 📊 Quality bar
- p95 dashboard load time under 3 seconds at the 50-office/20,000-record benchmark under a 300-concurrent-user load test.
- Error monitoring captures 100% of unhandled exceptions in a 48-hour staging soak test before promoting this step to "done."

### 🛑 Stop and review (gate before next step)
1. Deploy to production via the manual-approval pipeline. Confirm the approval gate actually blocks an unapproved deploy attempt.
2. Trigger a deliberate backend error in production (a test-only endpoint) — confirm it appears in the error monitoring tool with full context within 1 minute.
3. Run the load test script against production — confirm it meets the PRD's stated NFRs.
4. Manually fail the nightly obligation job (e.g., stop Redis briefly) — confirm an alert fires to the configured channel.
5. Query the audit log for a specific `orgId` and confirm results return in under 2 seconds.

---

## Build Step 14 — Post-launch ops & runbooks

### 🎯 Goal
A documented runbook exists for the top 5 operational failure scenarios (missed job run, authorization gap discovered, TDS calculation dispute, design-partner onboarding blocker, production incident), so a failure at 2am doesn't require re-deriving the system's behavior from source code under pressure.

### 📍 Why this is the root
This is the last node in the tree because it depends on everything above it actually existing and working — you cannot write a meaningful runbook for "the obligation job silently failed" until Step 07's job and Step 13's alerting both exist and have been exercised.

### 📥 Inputs (preconditions before you start)
- Steps 01-11 complete and deployed to production
- At least one design-partner organization actively using the product (per `07-phases.md`'s Phase 2)

### 📤 Outputs (what exists after this step passes)
- A runbook document covering the top 5 failure scenarios with concrete diagnostic steps and remediation actions
- An on-call/escalation path defined for production incidents
- A support handover checklist per the PRD's Section 12.4 (Operational Acceptance Criteria)

### 🛠 Implementation details

**Files to create:**
```
docs/runbooks/missed-obligation-job.md
docs/runbooks/authorization-gap.md
docs/runbooks/tds-dispute.md
docs/runbooks/onboarding-blocker.md
docs/runbooks/production-incident.md
docs/support-handover-checklist.md
```

**Patterns:**
- Every runbook follows the same shape: symptom → diagnostic query/command → likely root causes → remediation steps → how to confirm it's fixed → what to tell the affected customer.
- Runbooks reference actual entity/table names from `04-architecture.md` and actual job names from Step 07/08, not generic placeholders — a runbook a future on-call engineer can't act on without re-reading the entire codebase first has failed its purpose.

### ✅ Acceptance rubric
- [ ] Each of the 5 runbooks includes a copy-pasteable diagnostic query or command specific to this codebase (e.g., a query to check `RecurringObligationSchedule` records with no corresponding recent `ObligationInstance`).
- [ ] A person unfamiliar with the specific incident (tested by having a team member who didn't build that module follow the runbook) can diagnose and remediate a simulated version of each scenario using only the runbook.
- [ ] The production-incident runbook names a specific escalation path (who gets paged, in what order, within what time).
- [ ] The support handover checklist matches the PRD's Section 12.4 requirement: runbooks and escalation matrix delivered, plus role-based training with signed competency confirmation, before go-live.
- [ ] Each runbook has been exercised at least once against a deliberately simulated version of its failure scenario in staging, not just written speculatively.

### ⚠️ Edge cases to handle
- A runbook's diagnostic query becomes stale after a schema change in a later feature addition — treat runbooks as living documents reviewed whenever the referenced schema/job changes, not a one-time artifact.

### ❌ Common pitfalls (do NOT do these)
- Don't write runbooks as generic "check the logs" advice — they must name the specific job, table, or endpoint involved, and the specific query to run against this schema.
- Don't skip actually simulating each failure scenario before considering the runbook done — an untested runbook is a guess, and guesses under 2am incident pressure are how a 10-minute fix becomes a 3-hour outage.
- Don't treat this step as optional "nice to have" documentation — the PRD explicitly lists support handover documentation as an Operational Acceptance Criterion, meaning a design partner's contract sign-off depends on it existing.

### 📊 Quality bar
- 100% of the 5 runbooks have been exercised against a simulated failure at least once, with the outcome (time to diagnose, time to remediate) recorded.

### 🛑 Stop and review (gate — final gate of this playbook)
1. Have a team member who did not build the Obligation Engine follow the missed-obligation-job runbook against a deliberately broken staging job — time how long it takes them to correctly diagnose and fix it using only the document.
2. Repeat for the authorization-gap and TDS-dispute runbooks with a different team member.
3. Confirm the production-incident runbook's escalation path has actually been tested (a real page/alert reaches the named person).
4. Review the support handover checklist against the PRD's Section 12.4 line by line — confirm every item is checked, not assumed.

---

## Final ship checklist

- [ ] Step 01: CI/CD pipeline deploys to staging automatically, production requires manual approval.
- [ ] Step 02: All 19 core entities migrated, seeded, zero `Float` money fields.
- [ ] Step 03: 100% of API endpoints covered by authorization tests; cross-office access verified blocked and audit-logged.
- [ ] Step 04: An Admin can onboard and activate a real office without touching a generic expense form.
- [ ] Step 05: Trial starts at signup with no card required; `/app/subscribe` correctly activates a paid plan and gates access on trial expiry.
- [ ] Step 06: Platform Operator can manage org subscription/tenant status via `/platform`; no customer session can reach it; suspension blocks access independent of subscription status.
- [ ] Step 07: Recurring Obligation Engine generates instances ahead of due dates; Missing Bill Alert fires correctly.
- [ ] Step 08: Full bill lifecycle (enter → approve → pay → close) works with enforced segregation of duties.
- [ ] Step 09: Lease/rent obligations auto-generate; TDS calculation verified accurate against a test matrix.
- [ ] Step 10: Vendor/AMC, Maintenance, Asset, and Compliance modules all functional with their respective escalation paths.
- [ ] Step 11: Every dashboard reads live data only; zero mocked KPIs reachable in any non-test environment.
- [ ] Step 12: Every route has a tested loading/empty/error state; WCAG 2.1 AA accessibility score ≥ 90 on key pages.
- [ ] Step 13: Production deployed, isolated from staging, meeting the PRD's stated NFRs under load test.
- [ ] Step 14: All 5 runbooks written, simulated, and exercised by someone other than the original builder.
- [ ] At least one design-partner organization has completed a full billing cycle (bill → approval → payment → closed) in production.
- [ ] Setup Completion % for that design partner's first office is ≥ 90%.

## What to do when a step fails

1. **Don't skip ahead.** Each step is a foundation. Skipping creates a debt you'll pay 10x later — Step 08's approval workflow debugging is much harder if you're not sure whether Step 03's authorization layer or Step 07's obligation engine is the actual source of a bug.
2. **Re-read the dependency.** Most failures are caused by a missed input from the prior step — check the "Inputs" section of the failing step against what the prior step's "Outputs" actually produced.
3. **Check the pitfalls list first** — it exists because a specific, named failure mode was anticipated for this exact step; check there before assuming you've found a novel bug.
4. **Bisect the failing rubric item.** Identify the smallest change that broke it; revert if needed rather than debugging forward from a known-broken state.
5. **If still stuck**, paste the failing rubric item into your AI coding tool with this playbook file open, and reference the specific blueprint stage (e.g., "see 04-architecture.md's ObligationInstance status enum") so the context carries over rather than getting re-derived incorrectly.

## Why this playbook is different from generic build prompts

This playbook is specific to AddMin's actual entities, feature IDs, and route paths — every step references real names from `04-architecture.md` (RecurringObligationSchedule, ObligationInstance), `05-features.md` (F-01 through F-18), and `06-frontend.md` (the exact route paths and component names), not generic placeholders. A generic "build the auth system" instruction gives you no way to verify you built the *specific* authorization model this PRD requires — office-scoped, segregation-of-duties-enforced, server-side-checked.

It sequences leaf to root because that is the actual dependency reality of this system: you cannot correctly build the bill-approval workflow (Step 08) before the authorization layer (Step 03) it depends on for segregation-of-duties enforcement, and you cannot build a truthful Executive Dashboard (Step 11) before the transactional modules (Steps 05-08) whose data it aggregates actually exist.

It gates with observable rubrics because "I think this works" is not the same claim as "I verified this works," and the difference between those two claims is exactly where B2B financial-workflow software goes wrong in front of a paying customer. If a step in this playbook feels generic to you as you work through it, that's a signal you're missing context — go back and re-read the relevant blueprint stage (01 through 07) before continuing, rather than guessing at what "good" looks like.
