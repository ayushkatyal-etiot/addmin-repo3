# Phases + release plan — AddMin

## Total scope summary
- Total features: 20 (P0) + 9 backlog (P1, deferred)
- Total services: 19 modules/services + 3 stores + 4 external integrations
- Estimated MVP timeline: 12 weeks
- Estimated v1.0 timeline: 20 weeks
- Estimated team: 3 engineers (1 backend-lead, 1 full-stack, 1 frontend) + 1 part-time PM/founder doing design-partner validation

This is a B2B compliance-adjacent product with server-enforced authorization and financial workflow at its core — the honest estimate below assumes a small team building carefully, not a solo weekend build. Effort estimates from `05-features.md` sum to ~87 person-days of feature work alone; the phases below add foundation, integration, and hardening time on top of that, which is where most B2B tools actually lose time.

The marketing site (`addmin-marketing/`, an Astro site — see `09-marketing-website.md`) ships alongside the app and is self-serve-first — its "Start Free Trial" CTA sends every visitor into `/signup` → onboarding → `/app/subscribe`, not into a sales queue. That means Billing & Subscription (F-19) can no longer wait until a later phase the way a sales-led plan would have allowed; it moves into Phase 1 below, because the marketing site's core promise is broken without it, even before any other module ships.

## Phase 0 — Foundation (Week 0-2)

Goal: codebase ready, deploy pipeline working, no real users yet.

**Tasks:**
- Repo setup: `wasp new addmin` scaffolds the app (React client + Node/Express server + Prisma schema in one `main.wasp` spec, per `04-architecture.md`); Prisma schema written from `04-architecture.md`'s data model; TailwindCSS + shadcn/ui wired in. Marketing site scaffolded separately with `npm create astro@latest addmin-marketing`.
- Auth scaffolding (F-01: Wasp full-stack auth for signup/login/sessions/email verification, custom TOTP MFA layered on top)
- Base RBAC/office-scope enforcement pattern inside Wasp operations (F-02 skeleton — the gate every later feature's `query`/`action` must pass through)
- Database schema migration for Organization/Office/User/AuditLog (the tables everything else depends on)
- Deploy to staging with `wasp deploy fly launch` (one command provisions client + server + Postgres on Fly.io); marketing site deployed separately as a static Astro build
- Error monitoring (Sentry) and basic analytics (Plausible)

**Exit criteria:** A test user can sign up, verify email, enable MFA, log in, and see an empty Office Home for a placeholder office — and a second test user in a different office scope cannot see the first user's data (verified with an automated test, not just manual check).

## Phase 1 — MVP: Onboarding + Utility Core (Week 3-7)

Goal: prove the core promise end-to-end for one office — a real Admin can onboard an office, get a bill obligation flagged before it's late, and route it through approval to payment.

**Features (from stage 5):**
- F-03 (Organization & Office Hierarchy)
- F-04, F-05 (Guided Onboarding Checklist + Setup Completion %)
- F-19 (Free Trial Signup & Subscription Activation) — required because the marketing site's CTA and pricing-page plan buttons already point at this flow
- F-20 (Platform Operator Console) — small (3 days) but a hard dependency of F-19's sales-assisted Enterprise/design-partner path; without it, nobody on the team can actually activate that alternate flow when the first sales-assisted deal closes
- F-06 (Utility Connection Setup)
- F-07, F-08 (Recurring Obligation Engine + Missing Bill Alert)
- F-09, F-10 (Bill Entry + Approval Workflow)
- F-11 (Payment Tracking Mode + Overdue Flagging)

**Tasks broken down:**
- Week 3: Office hierarchy + onboarding checklist backend (OfficeChecklistTemplate/Item) and wizard frontend shell
- Week 4: Trial/subscription backend (F-19: `Subscription` state machine, Stripe Checkout + `POST /payments-webhook` route) + `/app/subscribe` frontend, wired to the onboarding wizard's exit; the Platform Ops Console (F-20: org list + manual subscription/tenant-status control) ships alongside it since it shares the `Subscription` entity; utility connection setup starts in parallel
- Week 5: Recurring Obligation Engine (schedule + instance generation, nightly job) + Missing Bill Alert job + Bill entry/invoice upload + Bill register frontend
- Week 6: Approval workflow (Maker-Checker routing, authorization limits) + Payment Tracking Mode
- Week 7: Office Home dashboard (minimal version), internal QA against the full signup-to-payment flow, bug fixing

**Exit criteria:**
- A test user can click "Start Free Trial" on the actual marketing site, land in `/signup`, complete guided onboarding for a real office, and reach `/app/subscribe` without support intervention.
- At least one full obligation cycle (utility bill: expected → entered → approved → paid → closed) completes end-to-end with correct audit trail.
- At least one test subscription completes trial → paid conversion through the real Stripe integration (not a stub), verified against the Stripe dashboard.
- A Platform Operator can log into `/platform`, see that test org in the list, and manually set a second test org's Subscription to "active" and back to "trialing" — with no customer-scoped session able to reach `/platform` at all.
- 0 P0 bugs in the signup-to-payment path.
- Unauthorized cross-office access attempts are rejected and logged in 100% of a scripted test suite.

## Phase 2 — Design-partner pilot: Lease, Vendor, Compliance (Week 8-12)

Goal: round out the P0 module set with 2-3 paying design-partner organizations actually using it on real offices, not just the wedge flow.

**Features added:**
- F-12, F-13 (Landlord/Lease/Rent Schedule + TDS Calculation)
- F-14 (Vendor Registration & AMC Tracking)
- F-15 (Maintenance Request, Work Order & SLA)
- F-16 (Asset Register & Employee Asset Request)
- F-17 (Compliance Checklist & Expiry Tracking)
- F-18 (My Actions queue + Executive Dashboard, full version)

**Pilot activities (per `03-analysis.md`'s updated go-to-market strategy — self-serve trial is the default path, design partners are recruited through it, not routed around it):**
- Point 2-3 target organizations at the live marketing site's "Start Free Trial" CTA and let them go through the real signup → onboard → subscribe funnel like any other visitor, rather than a manually provisioned account
- Offer the discounted design-partner pilot rate via `/contact` (per `pricing.md`'s FAQ) only if they'd rather not put a card in during the self-serve flow
- Weekly feedback loop adjusting onboarding checklist content against what those offices actually need
- Watch trial-to-paid conversion (the new metric from `03-analysis.md`'s GTM section) for all three plans, not just pilot pricing

**Exit criteria:**
- 2-3 design-partner organizations have at least one office fully active, with all P0 modules in real use for one full billing cycle.
- At least one of those organizations converted through the unassisted self-serve `/signup → /app/subscribe` path, proving the marketing site's funnel works end-to-end without manual intervention.
- Setup Completion % reaches ≥90% for each design partner's first office within 30 days of signup.

## Phase 3 — Hardening & narrow launch (Week 13-20)

Goal: production-grade reliability and security posture, then a narrow, targeted launch to the segment defined in `03-analysis.md` (not a broad public launch).

**Features added:**
- Bulk import/export polish (CSV for offices, utility masters, vendors, assets)
- Notification/escalation rule configuration UI (previously hard-coded defaults)
- Audit log search UI for Compliance Coordinator/Auditor use
- Performance pass: dashboard load <3s at 50 offices / 20,000 utility records (NFR from PRD)

**Go-to-market activities (per `03-analysis.md`):**
- Direct outbound to Admin/Facilities heads at companies with recent office-expansion signals
- Partnership conversations with 1-2 CA/compliance advisory firms as a referral channel
- Case study / reference content from the design-partner pilots

**Exit criteria:**
- 99.5% uptime measured over a 4-week window.
- Security review: full role × office × action authorization matrix tested and passing.
- 5-10 paying organizations live, each with ≥1 office through ≥2 consecutive billing cycles (the month-6 success criterion from `01-idea.md`, pulled forward as the exit gate for this phase).

## Phase 4 — Scale & selective expansion (Month 6+)

Goal: grow within the validated wedge before touching anything on the deferred backlog.

**Features (only if pulled by ≥2 paying customers, per `03-analysis.md`'s expansion discipline):**
- Payment Gateway Execution Mode + AutoPay (P1)
- Mobile app (online first, offline sync later) for Facility Staff field actions
- SSO integration for the first enterprise-track customer that requires it
- Late-payment fine rules, if design partners request it

**Explicitly not started in this phase:** Epic 0's full Group multi-tenancy (customer-side multi-org hierarchy, Group Super Admin, Membership abstraction, custom role builder UI), AI-assisted lease drafting, broker/commission tracking, additional OAMS modules (Meeting Room, Pantry, Visitor, Fleet, Procurement, Transport) — see `03-analysis.md`'s "avoid" recommendation. (The lightweight Platform Operator console, F-20, already shipped in Phase 1 — it is not part of this deferred list.)

## Risk register (from stage 3)

| Risk | Phase impacted | Mitigation |
|---|---|---|
| Scope creep delays first paying customer | Phase 1-2 | P0 feature list in `05-features.md` is the hard boundary for Phase 1-2; any new request goes to the Phase 4 backlog, not the current sprint |
| No design partner validating real data/workflows | Phase 2 | Design-partner recruitment starts in parallel with Phase 1 build, not after — pilot organizations are lined up before Phase 2 begins |
| TDS/compliance calculation error damages trust | Phase 2 | TDS and compliance-type seed data are not enabled for real payment processing until Finance/CA sign-off is obtained, per the PRD's own open-decision list |
| Server-side RBAC/audit gap exploited at a customer | Phase 0-3 | Automated authorization test suite (every role × office × action) is a Phase 0 deliverable, re-run as a gate before every phase's exit |
| Buyer expects payment execution, tracking-only feels incomplete | Phase 2-3 | Sales messaging explicitly frames Payment Tracking Mode as a control/audit feature in pilot conversations, before objections surface |
| Sales cycle longer than expected because Admin buyer lacks budget authority | Phase 3 | Finance-facing value (TDS accuracy, segregation of duties) is included in every pilot pitch from Phase 2 onward to build a second internal sponsor |

## Decision log (initial 5 decisions)

1. **Chose Wasp (a full-stack React/Node/Prisma framework) over a hand-built Next.js + NestJS split** — team size (3 engineers) doesn't justify maintaining a separate frontend app, REST API, and worker service; Wasp compiles one spec into all three, and module boundaries in `04-architecture.md` keep a clean path to extracting a service later if that's ever justified.
2. **Chose Postgres + Prisma over a NoSQL store** — financial/audit data (bills, payments, TDS, audit logs) needs ACID guarantees and relational integrity across Office/Utility/Payment/Audit entities; Prisma is also Wasp's native ORM, so this isn't a separate integration to maintain.
3. **Deferred Epic 0's full multi-tenant Group layer** — no validated customer need yet for multi-organization tenancy; single-org tenancy with an `org_id` reserved on every table keeps the door open without paying the complexity cost now. (The much smaller, AddMin-internal Platform Operator console is a separate decision — see 7 below.)
4. **Deferred Payment Gateway/Execution Mode to Phase 4** — avoids taking on PCI-DSS scope and a commercial gateway relationship before Payment Tracking Mode alone has been validated with paying customers. This is separate from decision 6 below.
5. **Web-first, no mobile app in Phase 0-3** — Facility Staff field actions (photo/video evidence, maintenance updates) work adequately on mobile web in the pilot phase; a native/offline app is only justified once volume of field usage is proven.
6. **Brought AddMin's own SaaS billing (F-19, Stripe) into Phase 1, not deferred like the P1 payment gateway above** — the marketing site is self-serve, with "Start Free Trial" as the primary CTA across the homepage, header, and pricing page (see `09-marketing-website.md`); shipping Phase 1 without a working trial-to-subscribe flow would mean the marketing site makes a promise the product can't keep.
7. **Scoped in a lightweight Platform Operator console (F-20) alongside F-19, but explicitly did not build Epic 0's full Group tenancy** — AddMin's own team needs a way to view all orgs and manually flip a subscription/tenant status the moment the first sales-assisted deal closes (F-19's alternate path already assumed this existed); a single internal role with cross-org read/write on two fields solves that completely, without the Membership abstraction, permission catalogue, or break-glass consent flow that a customer-facing multi-org Group hierarchy would require. Revisit Group tenancy only per `03-analysis.md`'s expansion discipline (≥10 paying orgs, ≥2 explicitly asking for it).

## Initiatives (cross-cutting)

- **Onboarding checklist accuracy** (continuous, Phase 1 onward) — every design-partner feedback session feeds directly into refining `OfficeChecklistTemplate` content; this is the product's core differentiator and never stops improving.
- **Authorization test coverage** (continuous, Phase 0 onward) — every new module or endpoint added must extend the role × office × action test suite before merge, not after.
- **Audit trail completeness** (continuous) — every new state-changing endpoint is checked against the Definition-of-Done requirement (audit entry produced where auditable) from the PRD.
- **Jurisdiction-specific compliance/TDS rule validation** (Phase 2 onward, ongoing) — each new design-partner organization's jurisdiction requirements are validated with their Finance/CA before their compliance/TDS seed data goes live, per the PRD's explicit open-decision requirement.
