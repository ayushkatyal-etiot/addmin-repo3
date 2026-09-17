# Feature specifications — AddMin

## Summary
- Total features: 20
- Modules covered: 15 (Identity & Access, Organization & Office, Onboarding, Billing & Subscription, Platform Operations, Utility, Property & Lease, Obligation Engine, Workflow & Approval, Payment, Facility & Maintenance, Asset, Vendor, Compliance, Reporting — grouped into 20 specs)
- Coverage: 100% of P0 modules have at least 1 feature spec

The marketing site (`addmin-marketing/`, built with Astro — see `09-marketing-website.md`) now routes its primary CTA — "Start Free Trial" — directly into this product's funnel: F-01 (register) → F-04/F-05 (onboard) → F-19 (subscribe). "Book a Demo" is retained only as a secondary, sales-assisted path for the Enterprise plan and design-partner pilots, per the marketing site's Contact page.

## Feature index

| ID    | Module                    | Title                                          | Priority | Effort |
|-------|---------------------------|-------------------------------------------------|----------|--------|
| F-01  | Identity & Access         | Signup, Login & MFA                             | P0       | 3 days |
| F-02  | Identity & Access         | Role-Based Access Control (Office-Scoped)       | P0       | 5 days |
| F-03  | Organization & Office     | Organization & Office Hierarchy Setup           | P0       | 3 days |
| F-04  | Onboarding                | Guided Office Onboarding Checklist              | P0       | 7 days |
| F-05  | Onboarding                | Office Setup Completion % & Review              | P0       | 2 days |
| F-19  | Billing & Subscription    | Free Trial Signup & Subscription Activation     | P0       | 5 days |
| F-06  | Utility                   | Utility Connection Setup                        | P0       | 3 days |
| F-07  | Obligation Engine         | Recurring Obligation Schedule & Instance Engine | P0       | 7 days |
| F-08  | Obligation Engine         | Missing Bill / Expected Item Alert              | P0       | 3 days |
| F-09  | Utility                   | Utility Bill Entry & Invoice Upload             | P0       | 3 days |
| F-10  | Workflow & Approval       | Bill Approval Workflow (Maker-Checker)          | P0       | 5 days |
| F-11  | Payment                   | Payment Tracking Mode & Overdue Flagging        | P0       | 5 days |
| F-12  | Property & Lease          | Landlord, Lease & Rent Schedule                 | P0       | 5 days |
| F-13  | Property & Lease          | TDS Calculation on Rent Payment                 | P0       | 3 days |
| F-14  | Vendor                    | Vendor Registration & AMC Tracking              | P0       | 4 days |
| F-15  | Facility & Maintenance    | Maintenance Request, Work Order & SLA           | P0       | 5 days |
| F-16  | Asset                     | Asset Register & Employee Asset Request         | P0       | 5 days |
| F-17  | Compliance                | Compliance Checklist & Expiry Tracking          | P0       | 4 days |
| F-18  | Reporting                 | Office Home, My Actions & Executive Dashboard   | P0       | 7 days |
| F-20  | Platform Operations       | Platform Operator Console (Tenant & Subscription Oversight) | P0 | 3 days |

Backlog (P1, deferred per `03-analysis.md`): Payment Gateway Execution Mode + AutoPay, Late-Payment Fine Rules, AI-Assisted Lease Agreement Drafting, Broker/Commission Tracking, Property Handover/Takeover Condition Capture, Mobile Offline Sync, SSO Integration, Custom Role Builder UI, Group Multi-Tenancy (customer-side multi-org hierarchy, Group Super Admin, generalized Membership/permission-catalogue — see `03-analysis.md`, distinct from the lightweight internal Platform Operator console at F-20, which is in scope).

## Feature specs (12-20 features)

---

### F-01 · Signup, Login & MFA

**Module:** Identity & Access
**Primary actor:** Platform Administrator · **Secondary:** all roles
**Priority:** P0 · **Effort:** 3 days

#### Purpose
Establishes the account and authentication foundation every other feature depends on. Mandatory MFA for admin roles is a direct requirement from the PRD's security section and a trust signal for the Finance co-buyer identified in `02-research.md`.

#### User flow
```
1. User arrives at /signup, typically via the marketing site's "Start Free Trial" CTA (with an optional ?plan= param carried through from the pricing page), and enters org name + admin email + password
2. System sends email verification link
3. User clicks link, email verified
4. User is prompted to enable MFA (TOTP) — mandatory if role is admin-tier
5. User scans QR code in an authenticator app and enters a confirmation code
6. System activates the account, creates the Organization + first User record, and starts a 14-day trial Subscription (see F-19) with no payment method required
7. User is redirected to /onboarding to begin office setup
8. Alternate: on later logins, user enters email/password then MFA code before session is issued
```

#### Acceptance criteria
- [ ] User can sign up with org name, email, and password, and receives a verification email within 30 seconds.
- [ ] Unverified accounts cannot log in beyond a "verify your email" screen.
- [ ] Admin-tier roles cannot complete signup without enabling MFA.
- [ ] Non-admin roles can optionally enable MFA.
- [ ] Login fails closed (session not issued) if MFA code is invalid or expired.
- [ ] Password reset flow invalidates all existing sessions for that user.

#### Edge cases
- Verification link expired — user can request a new one without re-entering signup details.
- User loses MFA device — requires an admin-assisted recovery flow, never a silent bypass.
- Duplicate signup with an already-verified email is rejected with a clear "account exists, log in instead" message.
- Concurrent signup attempts with the same email do not create two Organization records.

#### Telemetry events
`signup_started`, `email_verified`, `mfa_enabled`, `login_succeeded`, `login_failed`

---

### F-02 · Role-Based Access Control (Office-Scoped)

**Module:** Identity & Access
**Primary actor:** Platform Administrator · **Secondary:** all roles
**Priority:** P0 · **Effort:** 5 days

#### Purpose
Enforces role + office scope at the API layer, not just the UI — this is the PRD's single loudest non-negotiable requirement and the feature that lets Finance trust the platform per `03-analysis.md`'s positioning.

#### User flow
```
1. Administrator opens /admin/users
2. Administrator invites a user with an email, a system role (Office Admin, Checker, Payment Authorizer, Vendor Manager, Compliance Coordinator, Facility Staff, Office Head, Employee), and an office scope (one or more offices)
3. Invited user accepts and sets password/MFA
4. User logs in and sees only data for their assigned office(s)
5. User attempts an action outside their scope (e.g., approving a bill for an office they don't own)
6. System rejects the request at the API layer with a 403, before any UI-level check is relevant
7. Administrator can view/edit any user's role and office scope at any time
8. Alternate: Administrator revokes a user's access — subsequent API calls from that user's existing session are rejected immediately
```

#### Acceptance criteria
- [ ] Every API endpoint checks the caller's role and office scope before executing, independent of any client-side check.
- [ ] A user assigned to Office A cannot read or write records scoped to Office B.
- [ ] A Maker cannot approve or authorize payment on a transaction they created, unless the organization has explicitly configured an exception.
- [ ] Revoking a user's role takes effect on their next API call, not just their next login.
- [ ] Unauthorized attempts are logged to the Audit Module, not silently dropped.
- [ ] Administrator can assign multiple offices to a single user (e.g., a regional Office Head).

#### Edge cases
- User has no approver configured for their office — the affected workflow blocks submission with a clear configuration error, per PRD acceptance criteria.
- User's last active office scope is removed while they have an open session — next request re-evaluates scope and rejects appropriately.
- Two roles granted to the same user with conflicting segregation-of-duties implications — system enforces the stricter rule.

#### Telemetry events
`user_invited`, `role_assigned`, `unauthorized_access_attempt`, `access_revoked`

---

### F-03 · Organization & Office Hierarchy Setup

**Module:** Organization & Office
**Primary actor:** Platform Administrator
**Priority:** P0 · **Effort:** 3 days

#### Purpose
Creates the root entity (Organization → Office → Building/Floor) that every operational record scopes to — the structural foundation the PRD calls out as blocking all other configuration.

#### User flow
```
1. Administrator completes org profile (name, address, GSTIN, industry, currency, timezone)
2. Administrator clicks "Add Office"
3. Administrator enters office name/code, address, city/state/pincode, office type
4. System creates the Office record with setup_status = draft
5. Administrator is immediately routed into the Guided Office Onboarding Checklist (F-04)
6. Administrator can optionally add Building/Floor structure under the office
7. Administrator can view a list of all offices with their setup status at /offices
8. Alternate: Administrator bulk-imports multiple offices via CSV
```

#### Acceptance criteria
- [ ] User can create an office with all mandatory fields validated before save.
- [ ] Newly created office defaults to setup_status = draft, never active.
- [ ] Office list view shows setup status (Draft / Setup Incomplete / Active / Inactive) for every office.
- [ ] CSV bulk import validates each row and reports per-row errors without failing the whole batch.
- [ ] Office code is unique within an organization.

#### Edge cases
- CSV import contains a duplicate office code — that row is rejected with a specific error, others still import.
- Administrator attempts to delete an office with active obligations — system blocks deletion and suggests deactivation instead.
- Building/floor structure is optional — office setup can proceed without it.

#### Telemetry events
`office_created`, `office_bulk_import_completed`, `office_deactivated`

---

### F-04 · Guided Office Onboarding Checklist

**Module:** Onboarding
**Primary actor:** Office Admin
**Priority:** P0 · **Effort:** 7 days

#### Purpose
The core product differentiator identified in `02-research.md` — replaces blank-form, expense-first setup with a proactive checklist across Property, Utilities, Facilities, Compliance, Vendors, Assets and Roles. This is the feature the 16 September demo correction was specifically about.

#### User flow
```
1. Office Admin lands on the onboarding wizard immediately after office creation
2. Step: Owned/Rented — if Rented, branches into landlord + lease capture (F-12)
3. Step: Utility checklist — preloaded list (Electricity, Water, Internet, Telephone, Gas, DG, UPS, Solar); admin marks each Yes/No/Not Applicable
4. Selecting "Yes" on a utility immediately creates a setup task and links to F-06
5. Step: Facilities checklist — admin marks applicable facilities and responsibility type
6. Step: Compliance checklist — admin marks Available/Missing/Not Applicable per certificate type and can upload documents inline
7. Step: Vendor mapping — admin maps providers to utilities/facilities/AMC
8. Step: Asset add/import — admin adds or bulk-imports assets
9. Step: Roles — admin assigns Office Admin, Checker, Payment Authorizer, Compliance Coordinator, Vendor Manager, Facility Staff for this office
10. Step: Review — shows Setup Completion % and remaining gaps; admin can save incomplete and return later
```

#### Acceptance criteria
- [ ] User can create an office and complete guided setup without first creating any generic expense category or payee.
- [ ] Every checklist item supports Yes/No/Not Applicable (or Available/Missing/Not Applicable for compliance) as the applicability input.
- [ ] Marking an item "Yes"/"Available" but leaving it unconfigured creates a visible open setup action.
- [ ] Setup Completion % = completed applicable items ÷ total applicable items; Not Applicable items are excluded from the denominator.
- [ ] Office can be saved in an incomplete state and resumed later without data loss.
- [ ] A workflow that depends on a missing mandatory item (e.g., no approver assigned) is blocked from executing, with a clear message pointing back to the checklist.

#### Edge cases
- Admin marks a utility "Not Applicable" after previously marking it "Yes" with data already entered — system warns before discarding linked records.
- Admin abandons onboarding mid-flow — checklist state persists exactly where they left off on return.
- Compliance document upload fails mid-step — already-entered checklist selections for other items are retained.

#### Telemetry events
`onboarding_started`, `checklist_item_updated`, `onboarding_step_completed`, `onboarding_saved_incomplete`

---

### F-05 · Office Setup Completion % & Review

**Module:** Onboarding
**Primary actor:** Office Admin · **Secondary:** Office Head
**Priority:** P0 · **Effort:** 2 days

#### Purpose
Gives a visible, always-present progress metric during onboarding — identified in `03-analysis.md` as a near-term differentiator that makes progress tangible during the self-serve free trial started from the marketing site's "Start Free Trial" CTA.

#### User flow
```
1. Office Admin opens the Review step of onboarding, or revisits /offices/:id/setup at any time
2. System displays Setup Completion % prominently, with a breakdown by category (Utilities, Facilities, Compliance, Vendors, Assets, Roles)
3. Office Admin clicks any category to jump directly to its incomplete items
4. Office Admin completes remaining mandatory items
5. Once all mandatory dependencies are satisfied, the "Activate Office" action becomes available
6. Office Admin clicks Activate — office setup_status transitions to active; this is never blocked by billing/subscription status (see F-19) — a trialing org has full functional access
7. Recurring obligations and reminders begin generating from this point forward
8. If this was the org's first office activation and the org is still on an unconverted trial, system routes the Office Admin to /app/subscribe to complete the register → onboard → subscribe flow promised by the marketing site's CTA (F-19) — this is a prompt, not a hard block on continued use
```

#### Acceptance criteria
- [ ] Setup Completion % recalculates immediately whenever a checklist item's status changes.
- [ ] "Activate Office" is disabled until every applicable item marked Yes/Available has either configured status or an explicit owner assigned.
- [ ] Activating an office is a single explicit action, never automatic.
- [ ] Office Home shows the current Setup Completion % for any non-active office.
- [ ] Activation timestamp and activating user are recorded.

#### Edge cases
- All items are marked Not Applicable — completion shows 100% and activation is still explicitly required, not automatic.
- Office is deactivated after being active — historical setup completion data is preserved, not reset.

#### Telemetry events
`setup_completion_viewed`, `office_activated`

---

### F-19 · Free Trial Signup & Subscription Activation

**Module:** Billing & Subscription
**Primary actor:** Office Admin (as Org Admin) · **Secondary:** Platform Administrator
**Priority:** P0 · **Effort:** 5 days

#### Purpose
Makes the marketing site's "Start Free Trial" CTA (the Astro site's homepage and Pricing page, `addmin-marketing/src/pages/`) a real, working product path: register (F-01) → onboard (F-04/F-05) → subscribe via Stripe Checkout, instead of routing prospects to a sales form. This is AddMin's own SaaS billing — charging the customer organization for using AddMin — and must never be confused with the Payment module (F-11), which tracks the customer's own payments to their utility providers and landlords.

#### User flow
```
1. Visitor clicks "Start Free Trial" on the marketing site (optionally with a plan pre-selected, e.g. /signup?plan=growth from the pricing page)
2. Visitor completes signup (F-01) — a Subscription record is created in "trialing" status with a 14-day trial window; no payment method is requested
3. User is routed into Guided Office Onboarding (F-04) with full functional access during the trial
4. User completes onboarding and activates their first office (F-05); system prompts (not blocks) a visit to /app/subscribe
5. On /app/subscribe, user reviews the pre-selected plan (or changes it), enters a payment method, and confirms
6. Subscription transitions from "trialing" to "active"; billing begins per the confirmed plan
7. Alternate: user ignores the prompt and keeps using the trial — a reminder notification fires at 3 days and 1 day before trial expiry
8. Alternate: trial expires with no plan chosen — org's access is gated to a "choose a plan to continue" screen until subscribed
9. Alternate: an Enterprise prospect comes through the sales-assisted "Contact Sales" path (the marketing site's Contact page) instead — a Platform Operator (AddMin-internal, via the Platform Ops Console, F-20 — not the org-scoped "Platform Administrator" customer role) sets their Subscription directly to "active" with a negotiated plan, bypassing the trial state entirely
```

#### Acceptance criteria
- [ ] Completing signup creates a Subscription in "trialing" status with trial_ends_at set to 14 days out, with zero payment method required.
- [ ] A trialing org has full functional access to onboarding, office activation, and every P0 module — subscription status never blocks onboarding.
- [ ] The `?plan=` query parameter from the marketing site's pricing-page CTAs pre-selects that plan on /app/subscribe without charging until the user explicitly confirms.
- [ ] Submitting valid payment details transitions Subscription status to "active" within 5 seconds and is confirmed against Stripe's authoritative webhook (`POST /payments-webhook`), not just client-side confirmation.
- [ ] Reminder notifications fire at 3 days and 1 day before trial expiry.
- [ ] An org whose trial expires with no plan chosen is gated to a "choose a plan to continue" state; every other role/office authorization rule (F-02) still applies independently on top of this gate.
- [ ] A sales-assisted Enterprise or design-partner org can be set to "active" directly by a Platform Operator (F-20) without ever entering "trialing" status.
- [ ] Every subscription status transition is recorded in the audit trail (F-02's Audit Module).

#### Edge cases
- Stripe's webhook arrives before or after the browser redirect from /app/subscribe completes — status transition must be idempotent regardless of arrival order.
- A user returns to the product for the first time after their trial has already expired — they land on the "choose a plan to continue" screen immediately, not on a broken or blank Office Home.
- A payment method fails during subscription confirmation — the org remains correctly in "trialing" (or "past_due" if already active and a renewal failed), never in an ambiguous or silently-broken state.

#### Telemetry events
`trial_started`, `trial_reminder_sent`, `trial_expired`, `subscription_plan_selected`, `subscription_activated`, `subscription_payment_failed`

---

### F-06 · Utility Connection Setup

**Module:** Utility
**Primary actor:** Office Admin
**Priority:** P0 · **Effort:** 3 days

#### Purpose
Registers the actual utility account/connection that the Obligation Engine (F-07) needs to generate recurring bill expectations — the entry point from onboarding into ongoing utility management.

#### User flow
```
1. From the onboarding checklist (or /utilities directly), Office Admin selects a utility type marked "Yes"
2. Office Admin enters provider name, meter/account number, connection type, billing cycle
3. Office Admin optionally links a vendor from the Vendor module
4. System creates the UtilityAccount record and immediately creates a RecurringObligationSchedule for it
5. Office Admin can add multiple connections of the same utility type (e.g., two electricity meters on different floors)
6. Office Admin views the connection in /utilities/:officeId list with status Active
7. Alternate: Office Admin edits connection details later (e.g., billing cycle change)
```

#### Acceptance criteria
- [ ] User can create a utility connection with provider, account/meter number, and billing cycle as mandatory fields.
- [ ] Creating an applicable utility connection creates/activates the recurring obligation logic for future bill cycles (per PRD acceptance criteria).
- [ ] A single office/floor can have multiple connections of the same utility type.
- [ ] Editing billing cycle updates future obligation schedule generation without altering already-closed past instances.
- [ ] Connection list is filterable by utility type and status.

#### Edge cases
- Duplicate account/meter number entered for the same office — system flags a warning, does not hard-block (a legitimate provider re-use is possible).
- Vendor link is optional at creation time and can be added later without disrupting the obligation schedule.

#### Telemetry events
`utility_connection_created`, `utility_connection_edited`

---

### F-07 · Recurring Obligation Schedule & Instance Engine

**Module:** Obligation Engine
**Primary actor:** System (automated) · **Secondary:** Office Admin
**Priority:** P0 · **Effort:** 7 days

#### Purpose
The structural moat identified in `02-research.md` and `03-analysis.md` — unifies utility, rent, AMC, and compliance into one recurring-obligation model, generating expected instances proactively instead of waiting for a bill to arrive.

#### User flow
```
1. A RecurringObligationSchedule is created automatically whenever a UtilityAccount, active Lease, AMCContract, or applicable ComplianceItem is set up
2. Nightly job evaluates all active schedules and generates the next period's ObligationInstance ahead of its expected_date
3. Office Admin sees the new instance appear in their My Actions queue as "Expected" before any bill/invoice has arrived
4. When a bill/invoice/renewal is entered against the instance, its status moves to Received / In Process
5. Once the associated workflow closes (paid, renewed, etc.), the instance moves to Closed
6. If expected_date passes with no linked record, the instance moves to Missing and triggers F-08
7. Administrator can view the full schedule and instance history for any obligation from its source record (e.g., a UtilityAccount's obligation tab)
```

#### Acceptance criteria
- [ ] Every active UtilityAccount, active Lease, active AMCContract, and applicable ComplianceItem has exactly one RecurringObligationSchedule.
- [ ] ObligationInstance is generated ahead of expected_date, not on or after it.
- [ ] Instance status transitions correctly through Expected → Received/Missing → In Process → Closed/Cancelled.
- [ ] Deactivating the source record (e.g., closing a lease) stops future instance generation without deleting historical instances.
- [ ] Duplicate instance generation for the same schedule + period is prevented (idempotent nightly run).

#### Edge cases
- Nightly job fails to run for one night — next run's catch-up logic generates any missed instance without creating duplicates.
- Schedule frequency changes mid-cycle (e.g., billing cycle edited) — in-flight instance for the current period is unaffected; only future generation uses the new frequency.
- Office is deactivated while it has open obligation instances — instances remain visible for audit but no new ones generate.

#### Telemetry events
`obligation_schedule_created`, `obligation_instance_generated`, `obligation_instance_closed`

---

### F-08 · Missing Bill / Expected Item Alert

**Module:** Obligation Engine
**Primary actor:** System (automated) · **Secondary:** Office Admin
**Priority:** P0 · **Effort:** 3 days

#### Purpose
Directly solves problem cluster #1 from `02-research.md` ("we only find out a bill is late after the vendor calls to disconnect us") — flags an obligation that should have arrived but hasn't, which no competitor in the research set does.

#### User flow
```
1. Nightly job scans all ObligationInstance records past their expected receipt window still in status Expected
2. System transitions the instance to Missing and creates a notification to the Office Admin
3. Office Admin sees the item highlighted in My Actions and on the Office Home
4. Office Admin either enters the bill late (instance moves to Received) or marks it waived with a remark (instance moves to Cancelled with audit note)
5. If unresolved beyond a configured threshold, the item escalates to Office Head
6. Alternate: the missing item resolves itself if a bill is entered directly before the alert fires
```

#### Acceptance criteria
- [ ] An obligation instance not received by its configured expected window is automatically flagged Missing.
- [ ] Missing items remain visible until Received or explicitly waived by an authorized role.
- [ ] Waiving a missing item requires a remark and is recorded in the audit trail.
- [ ] Missing items unresolved past a configurable threshold escalate to the Office Head.
- [ ] Missing Bill Alert count is visible as a KPI on the Office Home dashboard.

#### Edge cases
- Bill is entered for a period that was never flagged as Expected (e.g., a new connection's first bill) — system still accepts and links it correctly.
- Multiple consecutive missing periods for the same schedule — each is tracked as a distinct instance, not merged.

#### Telemetry events
`obligation_missing_flagged`, `obligation_missing_waived`, `obligation_missing_escalated`

---

### F-09 · Utility Bill Entry & Invoice Upload

**Module:** Utility
**Primary actor:** Office Admin (Maker)
**Priority:** P0 · **Effort:** 3 days

#### Purpose
Digitizes the actual bill-entry step that today happens via spreadsheet/email per problem cluster #1 — this is where a received bill enters the system and links to its obligation instance.

#### User flow
```
1. Office Admin opens a Missing/Expected obligation instance, or starts a new bill entry directly
2. Office Admin enters utility type, billing period, amount, due date
3. Office Admin uploads the invoice document
4. System validates amount > 0, due date required, and checks for duplicate account + billing period
5. Bill is saved as Draft
6. Office Admin clicks Submit, moving the bill to Pending Approval (routes to F-10)
7. Alternate: Office Admin amends the bill before approval — change is recorded in the audit log
8. Alternate: Office Admin uses Bulk Bill Entry to enter multiple bills in one batch with row-level validation
```

#### Acceptance criteria
- [ ] Bill amount must be greater than 0 and due date is required before save.
- [ ] Duplicate account + billing period combination is flagged before submission.
- [ ] Invoice file upload validates allowed format and configured maximum size.
- [ ] If upload fails, already-entered form data (amount, period, due date) is retained, not lost.
- [ ] Bill amendment is only allowed before approval; every amendment is captured in the audit log.
- [ ] Bulk entry reports per-row validation errors without failing the entire batch.

#### Edge cases
- Bill entered for an obligation instance already marked Closed — system blocks and directs the user to create a new period instead.
- Invoice file exceeds size limit — clear error shown, form state preserved.
- Bulk entry file has mixed valid/invalid rows — valid rows commit, invalid rows are returned with specific error reasons.

#### Telemetry events
`bill_drafted`, `bill_submitted`, `bill_amended`, `bulk_bill_entry_completed`

---

### F-10 · Bill Approval Workflow (Maker-Checker)

**Module:** Workflow & Approval
**Primary actor:** Checker · **Secondary:** Office Admin (Maker)
**Priority:** P0 · **Effort:** 5 days

#### Purpose
Enforces the segregation-of-duties control that lets Admin own the process while Finance retains authorization control — directly addresses problem cluster #3 from `02-research.md`.

#### User flow
```
1. Submitted bill enters the Checker's My Actions queue based on configured approval routing (by office/utility/amount threshold)
2. Checker opens the bill, reviews amount/invoice/details
3. Checker approves, rejects (with mandatory remark), or returns for correction (with mandatory remark)
4. Approved bill moves to Awaiting Payment and enters the Payment Authorizer's queue (F-11)
5. Rejected bill is closed with the Maker notified
6. Returned bill goes back to the Maker's queue in Draft status with the Checker's remark visible
7. Alternate: bill amount exceeds the Checker's authorization limit — routes to a higher-tier approver automatically
8. System blocks submission entirely if no approver is configured for that office/utility combination
```

#### Acceptance criteria
- [ ] Utility bill can complete end-to-end: enter → approve → pay/record → close, including return/reject/partial/overdue paths.
- [ ] Reject and Return actions require a remark before the action can be confirmed.
- [ ] The same user cannot be both Maker and Checker on the same bill unless the organization has explicitly configured that exception.
- [ ] Multi-step approval chains route correctly based on configured amount thresholds.
- [ ] No approver configured for a transaction blocks submission with a clear configuration error, not a silent failure.
- [ ] Every approve/reject/return action is recorded in the audit trail with before/after status.

#### Edge cases
- Approval threshold changes after a bill is already in the approval queue — in-flight bill uses the threshold that was active at submission time.
- Checker is deactivated while bills are pending in their queue — those items are reassigned per an administrator action, not left orphaned.
- Bill is returned for correction multiple times — full history of each round is visible to both Maker and Checker.

#### Telemetry events
`bill_approval_assigned`, `bill_approved`, `bill_rejected`, `bill_returned`

---

### F-11 · Payment Tracking Mode & Overdue Flagging

**Module:** Payment
**Primary actor:** Payment Authorizer · **Secondary:** Office Admin
**Priority:** P0 · **Effort:** 5 days

#### Purpose
Provides the "control and audit" payment value proposition from `03-analysis.md`'s go-to-market strategy — records payments executed outside the platform, without the PCI-DSS/gateway scope of Payment Execution Mode (deferred to P1).

#### User flow
```
1. Approved bill appears in the Payment Authorizer's Awaiting Payment queue
2. Payment Authorizer records payment date, amount, mode (NEFT/RTGS/cheque/online), reference number, and uploads proof
3. System validates the recording is within the Payment Authorizer's configured authorization limit
4. Bill status updates to Paid (or Partially Paid if amount is less than the bill total)
5. If a partial payment is recorded, the remaining balance stays visible as Awaiting Payment
6. Nightly job flags any unpaid bill past its due date as Overdue
7. Overdue bills escalate per the configured notification/escalation rule
8. Alternate: Payment Authorizer records payment against multiple bills in one batch
```

#### Acceptance criteria
- [ ] Payment recording captures date, amount, mode, and reference number as mandatory fields.
- [ ] Payment execution/recording is restricted to a user holding the Payment Authorizer role.
- [ ] Payment amount exceeding the Payment Authorizer's configured authorization limit is blocked, not just warned.
- [ ] Partially paid bills correctly track and display the remaining balance.
- [ ] Bills unpaid past due date automatically flag as Overdue without manual action.
- [ ] Full payment history is filterable and exportable per office/utility/period.

#### Edge cases
- Payment recorded for an amount greater than the bill total — system rejects and requires correction, does not silently create a credit balance.
- Two Payment Authorizers attempt to record payment on the same bill simultaneously — second attempt is rejected with a "already recorded" message, not a duplicate payment.
- Overdue bill is finally paid — Overdue flag clears and payment history reflects the actual payment date, not the flag date.

#### Telemetry events
`payment_recorded`, `payment_partial_recorded`, `bill_overdue_flagged`

---

### F-12 · Landlord, Lease & Rent Schedule

**Module:** Property & Lease
**Primary actor:** Office Admin
**Priority:** P0 · **Effort:** 5 days

#### Purpose
Directly solves problem cluster #2 from `02-research.md` ("the lease renewal window passed and nobody flagged it") by centralizing landlord/lease data and generating the recurring rent obligation automatically.

#### User flow
```
1. During onboarding (or later), Office Admin marks office as Rented
2. Office Admin registers the landlord (contact, PAN, bank details) or selects an existing landlord
3. Office Admin enters lease terms: start/end date, rent amount, CAM amount, security deposit, escalation clause
4. Office Admin uploads the lease agreement document
5. System creates the Lease record and a RecurringObligationSchedule for monthly rent (and CAM if applicable)
6. As the lease approaches expiry, renewal reminders fire at 180/90/60/30 days
7. Office Admin records the renewal outcome (Renewed with new terms, or Terminated)
8. Alternate: escalation clause auto-applies the configured rent increase at its effective date
```

#### Acceptance criteria
- [ ] Rented office supports landlord, lease, recurring rent/CAM, and renewal reminders end-to-end.
- [ ] Lease end date must be later than start date, validated on save.
- [ ] Creating an active lease automatically creates the monthly rent RecurringObligationSchedule.
- [ ] Renewal reminders fire at each configured interval (180/90/60/30 days) without manual triggering.
- [ ] Escalation clause applies the configured rent increase automatically at its effective date, reflected in future rent obligation amounts.
- [ ] Security deposit amount and refund status are tracked independently of the rent schedule.

#### Edge cases
- Lease renewed with different rent terms — new terms apply only from the renewal effective date, historical rent instances are unaffected.
- Lease terminated mid-cycle — remaining scheduled rent instances for future periods are cancelled, not left dangling.
- Landlord bank details are incomplete — payment recording (F-11) still proceeds but flags the missing detail as a setup gap.

#### Telemetry events
`landlord_registered`, `lease_created`, `lease_renewal_reminder_sent`, `lease_renewed`, `lease_terminated`

---

### F-13 · TDS Calculation on Rent Payment

**Module:** Property & Lease
**Primary actor:** Payment Authorizer · **Secondary:** Office Admin
**Priority:** P0 · **Effort:** 3 days

#### Purpose
Automates a statutory calculation that is currently error-prone and inconsistently owned per problem cluster #3 — directly supports Finance/CA trust as identified in `03-analysis.md`'s risk matrix, which flags this as requiring sign-off before go-live.

#### User flow
```
1. Payment Authorizer opens a rent payment due for recording
2. System checks whether TDS applies for this landlord (configured landlord-wise or default org-wise rate)
3. If applicable, system calculates TDS amount and displays the net payable amount alongside the gross rent
4. Payment Authorizer confirms and records the net payment
5. TDS deduction is logged to TDS history, landlord-wise
6. Office Admin/Finance can export TDS history for a selected period for Finance/ERP reconciliation
7. Alternate: landlord has no TDS configuration set — system flags this before allowing payment to proceed, per PRD validation rules
```

#### Acceptance criteria
- [ ] TDS rate is configurable at the organization level and overridable per landlord.
- [ ] TDS calculation and net payable amount are accurate against the configured percentage in every test scenario.
- [ ] A landlord flagged as TDS-applicable without a configured rate blocks payment with a clear validation error, not a silent zero-TDS payment.
- [ ] TDS deduction history is viewable and exportable landlord-wise for a selected period.
- [ ] TDS amount is clearly separated from gross rent in both the payment record and payment history.

#### Edge cases
- TDS rate changes mid-year — historical payments retain the rate applied at the time, only future payments use the new rate.
- Landlord PAN is missing where TDS is applicable — system flags this as a compliance gap rather than blocking silently with no explanation.

#### Telemetry events
`tds_calculated`, `tds_payment_blocked_missing_config`, `tds_history_exported`

---

### F-14 · Vendor Registration & AMC Tracking

**Module:** Vendor
**Primary actor:** Vendor Manager
**Priority:** P0 · **Effort:** 4 days

#### Purpose
Centralizes the vendor relationships (utility providers, DG/UPS/Solar vendors, AMC contractors) that Utility, Facility, and Compliance modules all depend on — supports the onboarding checklist's vendor-mapping step (F-04).

#### User flow
```
1. Vendor Manager registers a new vendor: name, category, contact, PAN/GSTIN
2. Vendor Manager uploads required documents (licences, insurance, SLA acceptance)
3. Vendor status starts as Pending Activation until documents are validated
4. Vendor Manager activates the vendor, making it eligible for work assignment
5. Vendor Manager creates an AMC contract linking the vendor to specific equipment/service, with start/end dates
6. System generates a RecurringObligationSchedule for AMC renewal tracking
7. Renewal alerts fire at 60/30-day intervals before AMC expiry
8. Vendor Manager records a performance review after service completion, feeding future renewal decisions
```

#### Acceptance criteria
- [ ] Vendor cannot be assigned to any work order or AMC while status is Pending Activation.
- [ ] AMC renewal alerts trigger at 60- and 30-day intervals before expiry, per configured rule.
- [ ] Vendor AMC renewal and compliance expiry alerts trigger according to configured rules (PRD acceptance criteria).
- [ ] Vendor performance record captures SLA compliance rate, response time, and quality rating.
- [ ] Expired AMC without renewal action automatically flags as Expired on the Vendor Dashboard.

#### Edge cases
- Vendor has multiple AMC contracts across different offices — each is tracked and renewed independently.
- Vendor document expires (e.g., insurance) — vendor is flagged but not automatically deactivated, pending manual review.

#### Telemetry events
`vendor_registered`, `vendor_activated`, `amc_created`, `amc_renewal_alert_sent`, `vendor_performance_recorded`

---

### F-15 · Maintenance Request, Work Order & SLA

**Module:** Facility & Maintenance
**Primary actor:** Facility Support Staff · **Secondary:** Office Admin, Employee
**Priority:** P0 · **Effort:** 5 days

#### Purpose
Routes equipment faults and facility issues to the right vendor with SLA tracking and closure evidence — covers DG/UPS/Solar maintenance workflows called out explicitly in the PRD.

#### User flow
```
1. Employee or Facility Staff logs a maintenance request: category, location, priority, description
2. Office Admin reviews and creates a Work Order, assigning an eligible vendor and SLA due date
3. Vendor/Facility Staff updates status to In Progress
4. Facility Staff uploads before/after photo/video evidence with timestamp and comments
5. Facility Staff marks the work order Completed
6. Office Admin verifies completion before final closure
7. If SLA due date passes without completion, system escalates per configured rule
8. Alternate: a failed inspection or equipment fault auto-generates a maintenance request without manual re-entry
```

#### Acceptance criteria
- [ ] Maintenance request can route to a vendor/facility owner with SLA and closure evidence end-to-end.
- [ ] SLA breach triggers an automatic escalation notification to the configured owner.
- [ ] Work order cannot be closed without Admin verification following vendor completion.
- [ ] Photo/video evidence is timestamped and attributed to the uploader, with before/after distinguished.
- [ ] Full service history is retained per equipment/facility and viewable chronologically.

#### Edge cases
- Vendor marks work Completed but Admin verification finds it unsatisfactory — request reopens with a remark, not silently closed.
- Maintenance request has no eligible vendor available for its category — request remains Open with a visible gap flagged to the Office Admin.
- Photo/video upload fails during field submission — request data is still saved, media can be added when connectivity resumes.

#### Telemetry events
`maintenance_request_created`, `work_order_assigned`, `maintenance_evidence_uploaded`, `work_order_verified_closed`, `sla_breach_escalated`

---

### F-16 · Asset Register & Employee Asset Request

**Module:** Asset
**Primary actor:** Office Admin · **Secondary:** Employee, Employee's Manager
**Priority:** P0 · **Effort:** 5 days

#### Purpose
Provides the asset custody and request/indent workflow the PRD scopes as P0 core — gives Admin visibility into what equipment exists and who holds it, and a controlled path for employees to request new assets.

#### User flow
```
1. Office Admin adds or bulk-imports assets: category, model/serial, office/floor, initial custodian
2. Employee submits an asset request (e.g., a laptop) with a reason
3. Employee's manager approves, rejects, or returns the request
4. Office Admin reviews the approved request against existing available stock
5. If an existing asset is available, Office Admin allocates it directly and closes the request
6. If not, the requirement is handed off to Procurement (outside AddMin) and the request stays open pending receipt
7. Once a new asset is registered as received, Office Admin allocates it and closes the request
8. Custodian is recorded and asset status updates to Assigned
```

#### Acceptance criteria
- [ ] Asset request can move Employee → Manager → Admin → Procurement handoff / allocation and end with a custodian-linked asset.
- [ ] Asset status accurately reflects Available / Assigned / Under Service / Retired at every stage.
- [ ] Warranty expiry generates a reminder at a configured advance period.
- [ ] Employees can view the status of their own requests but not other employees' requests.
- [ ] Bulk asset import validates rows and reports per-row errors without failing the whole batch.

#### Edge cases
- Manager rejects a request — Employee is notified with the rejection reason, request closes without reaching Admin.
- Requested asset category has multiple available units — Admin can choose which specific unit to allocate.
- Asset marked Retired still has historical assignment/service records — those remain visible for audit, asset just can't be reassigned.

#### Telemetry events
`asset_request_created`, `asset_request_approved`, `asset_allocated`, `asset_returned`, `warranty_expiry_reminder_sent`

---

### F-17 · Compliance Checklist & Expiry Tracking

**Module:** Compliance
**Primary actor:** Compliance Coordinator · **Secondary:** Office Admin
**Priority:** P0 · **Effort:** 4 days

#### Purpose
Directly addresses problem cluster #5 from `02-research.md` — the highest-severity, lowest-frequency risk (a lapsed licence discovered during an inspection) — by making every applicable certificate visible with proactive expiry alerts.

#### User flow
```
1. During onboarding, Compliance Coordinator/Office Admin marks each certificate type Available/Missing/Not Applicable for the office
2. Available certificates get their document uploaded with an expiry date captured
3. As expiry approaches, reminders fire at a configurable advance period
4. Certificate status updates from Valid to Expiring as it nears expiry
5. Compliance Coordinator uploads the renewed certificate, resetting status to Valid with the new expiry date
6. If unresolved past expiry, status moves to Expired and escalates to Office Head per the configured SLA (existing BRD rule: escalate within 15 days of expiry)
7. Organization can add custom certificate types beyond the seeded list
```

#### Acceptance criteria
- [ ] Compliance checklist is presented during onboarding and remains editable from the Compliance dashboard afterward.
- [ ] Certificate status accurately reflects Valid / Expiring / Expired / Missing / Not Applicable at all times.
- [ ] Expired or missing mandatory compliance items remain visible until renewed or marked Not Applicable by an authorized role.
- [ ] Expiry reminders fire at the configured advance period without manual triggering.
- [ ] Unresolved expired items escalate to Office Head within the configured SLA threshold.
- [ ] Organization-defined custom certificate types behave identically to seeded types for tracking and alerting.

#### Edge cases
- Certificate renewed with a backdated effective date — expiry calculation uses the new document's actual expiry date, not the renewal action date.
- Compliance type applicability varies by jurisdiction — organization can mark a seeded type Not Applicable for a specific office without affecting other offices.
- Multiple documents uploaded for the same certificate over time — full document history is retained, not overwritten.

#### Telemetry events
`compliance_item_updated`, `compliance_document_uploaded`, `compliance_expiry_reminder_sent`, `compliance_expired_escalated`

---

### F-18 · Office Home, My Actions & Executive Dashboard

**Module:** Reporting
**Primary actor:** Office Admin · **Secondary:** Office Head / Senior Management
**Priority:** P0 · **Effort:** 7 days

#### Purpose
Delivers the "single view of what's due, overdue, expiring" retention feature from `01-idea.md` and the cross-office executive view identified in `03-analysis.md` as the artifact that drives renewal sponsorship — all built on live transactional data, never dummy KPIs.

#### User flow
```
1. Office Admin logs in and lands on Office Home for their default/assigned office
2. Office Home shows current obligations, pending actions, overdue items, upcoming renewals, and setup completion in one view
3. Office Admin opens My Actions — a personal queue of every item awaiting their action across all modules
4. Office Admin clicks any item to act on it directly, without navigating through module menus
5. Office Head switches to Executive Dashboard, selects office/module/period filters
6. Executive Dashboard shows cross-office spend, overdue items, upcoming renewals, and compliance gaps
7. Office Head clicks any KPI to drill down to the underlying source records
8. Office Head exports a filtered view to PDF/Excel
```

#### Acceptance criteria
- [ ] All dashboards read live transactional data; no dummy or hard-coded KPI values appear in any environment used for a real user.
- [ ] My Actions queue aggregates pending items across Utility, Lease, Maintenance, Asset, Vendor, and Compliance modules into one list per user.
- [ ] Every KPI on the Executive Dashboard opens the underlying source records when clicked (drill-down).
- [ ] Dashboard and list views load within 3 seconds for a portfolio up to 50 offices / 20,000 utility records.
- [ ] Filters (office/module/period/status) are combinable and persist in the URL for shareable links.
- [ ] Export to PDF/Excel is available for every supported report.

#### Edge cases
- User has zero pending actions — My Actions shows a clear empty state, not a blank/broken screen.
- Office has just been activated with no historical data yet — dashboard shows a "getting started" state rather than a misleading zero-value chart.
- Drill-down target record has since been deleted/archived — link shows a graceful "record no longer available" message instead of erroring.

#### Telemetry events
`office_home_viewed`, `my_actions_item_opened`, `executive_dashboard_filtered`, `dashboard_drilldown_clicked`, `report_exported`

---

### F-20 · Platform Operator Console (Tenant & Subscription Oversight)

**Module:** Platform Operations
**Primary actor:** Platform Operator (AddMin-internal staff, not a customer role) · **Secondary:** none — this feature is never exposed to any customer
**Priority:** P0 · **Effort:** 3 days

#### Purpose
Gives AddMin's own team the one cross-org capability the product actually needs from day one: see every customer Organization and manually activate or suspend its Subscription/tenant status. This resolves a real gap already latent in F-19 — its sales-assisted Enterprise path assumed *someone* could set a Subscription to "active" outside the self-serve flow, but no such role existed. This is deliberately the lightweight version — no Epic 0 Group hierarchy, Membership abstraction, permission catalogue, or break-glass consent flow (see `03-analysis.md`'s scoping note); it is a single internal role with cross-org read/write on exactly two fields.

#### User flow
```
1. Platform Operator logs into /platform (a separate login from the customer Web App, backed by the standalone PlatformOperator identity, not the customer User table)
2. Platform Operator sees a list of every Organization: name, plan, subscription status, tenant status, trial_ends_at
3. Platform Operator searches/filters the list (e.g., by subscription status = "trialing" and trial_ends_at within 3 days)
4. Platform Operator opens a specific org, sees its full Subscription detail
5. For a sales-assisted Enterprise/design-partner deal (F-19's alternate path), Platform Operator sets plan + status = "active" directly, skipping the trial
6. Alternate: Platform Operator suspends an org's tenant_status (e.g., non-payment, abuse, or an explicit customer offboarding request) — every API call for that org's users is subsequently blocked
7. Alternate: Platform Operator reactivates a previously suspended org — access resumes immediately
8. Every action taken here is written to the Audit Module, tagged with the acting Platform Operator's identity
```

#### Acceptance criteria
- [ ] `/platform` is unreachable by any customer-scoped session — a customer User (of any role) attempting to access it is rejected, verified with a direct test using a valid customer session token.
- [ ] The org list shows every Organization on the platform with its current plan, Subscription status, and tenant_status, with search/filter by at least name and Subscription status.
- [ ] Setting a Subscription to "active" with a chosen plan from the console works identically to F-19's self-serve path from the customer's perspective — their next login sees an active subscription, no special-casing visible to them.
- [ ] Suspending an org's tenant_status immediately blocks every subsequent API call for that org's users, independent of and in addition to Step 03's `AuthzGuard` and F-19's `SubscriptionGuard` — a suspended org is blocked even if its Subscription is otherwise "active".
- [ ] Reactivating a suspended org restores access on the org's very next API call, with no re-login required.
- [ ] Every tenant-status or subscription change made through this console produces an AuditLog entry identifying the acting Platform Operator, distinct from any customer-side audit entry.
- [ ] PlatformOperator accounts require MFA, consistent with the admin-MFA requirement elsewhere in the product.

#### Edge cases
- A Platform Operator suspends an org that has an in-progress trial — trial_ends_at and Subscription status are left untouched; suspension is a separate, orthogonal gate (tenant_status), not a Subscription state, so reactivating restores the org exactly where its trial/subscription state was.
- Two Platform Operators edit the same org's status concurrently — the second write wins and is fully audited, but the console should show a warning if the record changed since it was loaded (optimistic concurrency check), not silently overwrite.
- A suspended org's users attempt to log in — they see a clear "your organization's access has been suspended, contact support" message, not a generic error or a misleading authentication failure.

#### Telemetry events
`platform_org_viewed`, `platform_subscription_manually_set`, `platform_tenant_suspended`, `platform_tenant_reactivated`
