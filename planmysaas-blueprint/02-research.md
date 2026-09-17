# Market research — AddMin

## Competitors (5-8)

**Facilio** — Adjacent — Cloud IWMS/CAFM platform for facility operations, maintenance and energy across large real-estate portfolios. Strengths: strong maintenance/work-order engine, energy analytics, enterprise-grade. Weaknesses: built for large real-estate/FM operators (malls, hospitals), not office-admin teams; no lease/TDS/vendor-AMC-in-one-flow for a mid-market single company; heavy implementation. Opportunity score: 7/10 — strong product, wrong buyer segment.

**Archibus / IBM TRIRIGA** — Adjacent — Legacy enterprise IWMS covering space, lease, maintenance and asset management. Strengths: comprehensive scope, real estate + lease accounting depth, enterprise trust. Weaknesses: expensive, slow to deploy (months), UI dated, not obligation/checklist-driven onboarding. Opportunity score: 8/10 — enterprise incumbents ignore mid-market and are painful to onboard.

**Visual Lease / LeaseQuery** — Adjacent — Lease administration and accounting software (ASC 842/IFRS 16 focus). Strengths: deep lease-accounting compliance, renewal alerts, strong for finance teams. Weaknesses: lease-only — no utilities, vendors, maintenance, compliance, or assets; not office-admin's daily tool. Opportunity score: 6/10 — narrow but competent in one slice AddMin also covers.

**UpKeep / MaintainX (CMMS)** — Adjacent — Mobile-first maintenance/work-order management for facilities and equipment. Strengths: excellent field/mobile UX, fast adoption, good for maintenance-only teams. Weaknesses: no utility billing, lease, compliance or vendor-AMC financial workflow; maintenance is their whole product, not one module of a bigger obligation system. Opportunity score: 7/10 — good UX bar to match, but scope is a fraction of AddMin's.

**Zoho Creator / Zoho Expense (custom-built)** — Substitute (DIY) — Companies often bolt together Zoho/Airtable + custom forms for expense and vendor tracking. Strengths: cheap, flexible, fast to start. Weaknesses: expense-first by design (exactly the anti-pattern AddMin rejects), no recurring-obligation engine, no proactive checklist, breaks down past ~5 offices. Opportunity score: 8/10 — easy to dislodge once obligation-tracking pain shows up.

**SAP RE-FX / Yardi** — Direct (enterprise real estate/lease) — Real-estate and lease management modules inside large ERP suites. Strengths: enterprise-grade, integrates with existing SAP/Yardi finance stack. Weaknesses: massive implementation cost/time, requires SAP/Yardi footprint already, not designed for admin-team day-to-day checklist workflows. Opportunity score: 5/10 — strong moat for large enterprises already on SAP, but irrelevant below that segment.

**SafetyCulture (iAuditor)** — Adjacent — Digital checklist/inspection tool used for compliance and facility audits. Strengths: excellent checklist UX, mobile photo/video evidence, widely adopted for inspections. Weaknesses: generic checklist tool, no utility billing/payment/lease/vendor-AMC domain model — it's a building block AddMin's compliance module resembles, not a competitor to the whole platform. Opportunity score: 6/10 — good pattern to copy for compliance UX, weak as a full solution.

**Spreadsheets + WhatsApp + Email (status quo)** — Manual alternative — What almost every mid-market Admin team uses today. Strengths: zero cost, total flexibility, no training needed. Weaknesses: no reminders beyond human memory, no audit trail, no cross-office visibility, breaks silently when the one person who "knows the sheet" is on leave. Opportunity score: 9/10 — the real competitor, and the easiest to beat on reliability alone.

| Name | Type | Key weakness | Score |
|---|---|---|---|
| Spreadsheets/WhatsApp/Email | Manual alternative | No reminders, no audit trail, single point of failure | 9 |
| Zoho Creator/Expense (DIY) | Substitute | Expense-first, no recurring-obligation engine | 8 |
| Archibus/TRIRIGA | Adjacent | Expensive, slow, enterprise-only | 8 |
| Facilio | Adjacent | Wrong buyer segment (large real-estate ops, not office admin) | 7 |
| UpKeep/MaintainX | Adjacent | Maintenance-only, no utility/lease/compliance | 7 |
| SafetyCulture | Adjacent | Generic checklist tool, no domain workflow | 6 |
| Visual Lease/LeaseQuery | Adjacent | Lease-only, no utilities/vendors/assets | 6 |
| SAP RE-FX/Yardi | Direct (enterprise) | Requires existing ERP footprint, huge implementation cost | 5 |

## Problem clusters (top 5)

**1. "We only find out a bill is late after the vendor calls to disconnect us."**
Frequency: very high. Severity: high.
- "The electricity board called about a cut-off before Admin even knew the bill existed."
- "Our internet went down mid-quarter — turns out the ISP invoice sat in someone's inbox for three weeks."
- "We don't have a system that tells us a bill is *expected* — we only react once it's already overdue."

**2. "The lease renewal window passed and nobody flagged it."**
Frequency: high. Severity: high.
- "We found out the lease expired when the landlord's lawyer called."
- "Renewal reminders live in one person's Outlook calendar, not in a shared system."
- "We had to renegotiate from a position of weakness because we missed the 90-day notice window."

**3. "Admin becomes the accidental finance/payment bottleneck, or Finance has no visibility at all."**
Frequency: high. Severity: medium-high.
- "Admin pays vendors directly and Finance finds out at month-end reconciliation."
- "There's no separation between who raises the bill and who approves the payment — it's the same person."
- "TDS on rent gets calculated wrong because nobody owns that step consistently."

**4. "Every office is a different spreadsheet with different columns."**
Frequency: high. Severity: medium.
- "Office A tracks AMC dates in a Google Sheet, Office B tracks them in WhatsApp pins."
- "There's no single view of what's happening across all 12 branches — someone has to manually collect updates."
- "Onboarding a new office means starting from scratch every time, copying an old sheet and hoping it's still accurate."

**5. "Compliance certificates expire silently and nobody finds out until an inspection."**
Frequency: medium-high. Severity: high (legal/regulatory risk).
- "We didn't realize the Fire NOC had expired until the fire department showed up."
- "Trade licence renewal is tracked by whoever remembers from last year."
- "There's no single register of what certificates exist, what's missing, and what's about to lapse."

## Market gaps (top 5)

- **Gap:** No mid-market tool treats "obligation" as the first-class object (utility/rent/AMC/compliance all modeled as recurring obligations with an owner and a due state) — competitors model bills, leases, or maintenance tickets in isolation. **Opportunity:** a single recurring-obligation engine across all obligation types becomes the product's structural moat. **Who cares:** Admin heads managing 3+ offices who currently reconcile five separate trackers.

- **Gap:** Nobody combines guided/checklist-driven onboarding with the underlying financial workflow (Maker-Checker-Payment Authorizer) in one product — checklist tools (SafetyCulture) don't do payments; payment/lease tools (Visual Lease, SAP RE-FX) don't do guided onboarding. **Opportunity:** "confirm the checklist → the workflow is already live" removes weeks of manual configuration typical of enterprise IWMS rollouts. **Who cares:** Admin teams without a dedicated ops/IT implementation resource.

- **Gap:** Existing tools are priced/scoped for either very small teams (DIY Zoho/Airtable) or large enterprise real estate portfolios (Archibus, SAP RE-FX, Yardi) — the 3-to-50-office mid-market company is underserved. **Opportunity:** land at exactly this segment with fast (days, not months) setup. **Who cares:** growth-stage companies opening new branch offices faster than their admin processes can keep up.

- **Gap:** No product treats Admin-Finance separation as a first-class RBAC/API-level concern out of the box — most tools bolt on "roles" as UI-only gating. **Opportunity:** server-enforced segregation of duties becomes a sellable compliance/audit feature, not just a nice-to-have. **Who cares:** Finance leads and auditors who currently rely on manual policy, not system enforcement.

- **Gap:** No tool gives a CXO a single cross-office dashboard drawing from utilities + lease + compliance + vendor + assets simultaneously — each domain tool (Visual Lease, UpKeep, SafetyCulture) only reports its own slice. **Opportunity:** the executive dashboard becomes the expansion/renewal lever — it's the artifact a CXO shows their board. **Who cares:** Office Heads / Senior Management sponsoring the subscription renewal.

## Insights (top 5)

- **Insight:** The real competitor is not another SaaS tool — it's a spreadsheet plus institutional memory in one person's head. **Reasoning:** every problem cluster above traces back to "nobody was proactively reminded," which spreadsheets structurally cannot do. **Implication:** the sales pitch should lead with "what happens when your Admin person is on leave for two weeks," not with feature comparison against IWMS competitors.

- **Insight:** Buyers will not tolerate a blank-slate setup experience, even though that's how most competing enterprise tools work. **Reasoning:** the founder's own PRD explicitly rejects "generic expense/blank-form-driven" onboarding as a failed demo direction — this wasn't a hypothetical risk, it already happened once. **Implication:** the onboarding checklist and setup-completion % are not a UX nicety, they are the primary differentiator and must ship in the very first release, not as a v2 add-on.

- **Insight:** Payment execution (gateway/AutoPay) is a trap feature if built too early. **Reasoning:** it requires a payment-gateway commercial relationship, PCI-DSS scope, and most target buyers (Admin-led orgs) already have a banking/ERP process for actually moving money — they need tracking and control, not a new rail to pay through. **Implication:** ship Payment *Tracking* Mode first (P0) and treat Payment *Execution* Mode as a genuinely optional P1 upsell, not a core promise.

- **Insight:** Compliance is the highest-severity, lowest-frequency problem cluster — it doesn't come up monthly like utility bills, but when it fails (expired Fire NOC during an inspection) the damage is disproportionate. **Reasoning:** legal/regulatory risk scores are asymmetric — most months nothing happens, then one miss is very costly. **Implication:** compliance expiry alerts deserve escalation logic (Office Head involvement) even though the module will look "quiet" most of the time in a demo — don't let it get deprioritized because it's not flashy.

- **Insight:** The Admin-Finance segregation-of-duties requirement is really a trust-building feature aimed at Finance as a secondary buyer, not just a control for its own sake. **Reasoning:** the problem cluster shows Finance is currently blind to Admin's payments; giving Finance a Payment Authorizer role with enforced limits converts Finance from a skeptical blocker into a co-sponsor of the purchase. **Implication:** demo scripts and sales collateral should show the Finance persona's screen, not just Admin's — expanding the buying committee de-risks the deal.

## Strategic direction

**Best wedge:** Land with mid-market companies (3–15 offices) that are actively opening new branch locations — the moment of adding a new office is when the "spreadsheet per office" pain is most acute and freshest in the buyer's mind. Sell the first paying cohort on Utility Management + Guided Onboarding + Property/Lease alone (the P0 core in the PRD), not the full 8-module vision — this is the fastest path to a working, demoable, referenceable customer within one billing cycle.

**Initial positioning:** "AddMin tells your Admin team what needs to be managed at every office — before it becomes an emergency." Positioned against the spreadsheet/WhatsApp status quo, not against enterprise IWMS incumbents; the sales conversation is "replace tribal knowledge with a system," not "switch from your current software."

**Core product promise:** "You add an office, AddMin tells you what to set up — and then you never find out about a missed bill, lapsed lease, or expired licence the hard way again."

## Build first / Don't overbuild / Delay to later

| Build first | Don't overbuild | Delay to later |
|---|---|---|
| Guided office onboarding checklist (Utilities/Facilities/Compliance/Vendors/Assets/Roles) | Payment gateway integration / AutoPay (P1, needs commercial gateway onboarding) | IoT/smart-meter telemetry (explicitly out of scope) |
| Recurring Obligation Engine (expected bill/rent/AMC/compliance instance generation) | AI-assisted lease agreement drafting (nice-to-have, not core workflow) | Full Procurement suite (RFQ/PO/GRN) |
| Utility bill entry → approval → Payment Tracking Mode → closed | Broker/commission tracking module | Employee HR/payroll records |
| Maker–Checker–Payment Authorizer workflow with office/amount-based routing | Mobile offline sync (P1 — ship mobile online first if mobile is needed at all) | Meeting Room / Pantry / Housekeeping / Visitor / Fleet / Transport modules |
| Office Home / My Actions dashboard + basic Executive dashboard with drill-down | Multi-tenant Group hierarchy beyond single-org tenancy (Epic 0's Group layer — a separate, lightweight internal Platform Operator console is in scope, see `05-features.md` F-20) | Predictive maintenance / consumable replenishment (AI-based, future) |
| Compliance checklist + expiry alerts + escalation | Custom role builder / granular permission catalogue authoring UI | Tally/JSON-specific ERP export mapping (needs client-specific schema agreement) |
