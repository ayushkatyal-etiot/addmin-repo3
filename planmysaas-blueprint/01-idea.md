# AddMin

> An office administration operating system that tells admin teams what to manage — utilities, leases, compliance, vendors, assets, maintenance — instead of waiting for them to remember.

## Problem statement
Office Admin teams at mid-to-large companies run utility bills, rent/lease, DG/UPS/Solar maintenance, statutory compliance, vendor AMCs, and asset custody through spreadsheets, WhatsApp reminders, and email threads. There is no single system that knows what obligations exist per office, so bills get missed, leases lapse, licences expire, and management has zero real-time visibility into cost or risk across locations. This hasn't been solved by generic expense or ERP tools because those are expense-first (they wait for a receipt) rather than obligation-first (they know a bill is coming before it arrives).

## Target audience
**Primary buyer:** Head of Admin / Facilities at a company with 3–50 office locations (regional HQ, branches, warehouses) — someone who currently owns a shared Excel tracker and a WhatsApp group with vendors and landlords, and is measured on "nothing got disconnected/expired/missed."
**Secondary audiences (max 2):**
- **Finance/Accounts Lead** — wants payment authorization control and TDS-correct records, currently reconciling Admin's spreadsheets manually against bank statements.
- **CXO / Office Head** — wants a single cross-office dashboard of spend, overdue items, and compliance risk instead of asking Admin for a manual report each month.

Willingness to pay: mid-market B2B SaaS, procured as an operations tool (not a personal productivity tool) — budget typically sits with Admin/Facilities or shared services, not IT.

## Business model
**Subscription** (per-organization, tiered by number of offices + seats), because the value compounds with the number of offices and users being coordinated, not with usage volume.
Price hypothesis: ₹15,000–₹40,000/month per organization for up to 10 offices (roughly ₹1,500–₹4,000 per office/month), with an enterprise tier above 10 offices priced by negotiation. Directional estimate — validate against comparable facilities/property-management SaaS pricing before quoting.

## Key features (top 5)
- **Guided Office Onboarding checklist** (Utilities/Facilities/Compliance/Vendors/Assets/Roles) — solves the core problem: it tells the admin what must exist, rather than waiting for them to know.
- **Recurring Obligation Engine** (expected bill/rent/AMC/compliance instance generated automatically each cycle, flagged if missing) — solves the core problem: nothing gets missed silently.
- **Maker–Checker–Payment Authorizer workflow with office/amount-based routing** — solves the core problem: enforces the approval control Admin/Finance actually need, server-side.
- **Office Home / My Actions dashboard** (single view of what's due, overdue, expiring per office) — retention: this is what brings the admin back daily.
- **Executive cross-office dashboard with drill-down** — retention/expansion: this is what gets a CXO to sponsor renewal and upsell more offices.

## Founder's rules
- Office-first, not expense-first: every flow starts from an office and its obligations, never from a blank expense form.
- Role and office scope must be enforced at the API layer, not just hidden in the UI — this is a compliance/audit product, so backend authorization is non-negotiable.
- No dummy/seeded KPI data in any dashboard shown to a real user — dashboards must always read live transactional data.

## Success criteria
By month 6: 5–10 paying organizations live in production, each with at least one fully configured office running end-to-end (utility bill → approval → payment → closed) for at least 2 consecutive billing cycles, with zero P0-workflow dependency on manual DB intervention.

## Anti-goals
- Not a general ledger or full accounts-payable system — it tracks obligations and payments, it does not replace Finance's ERP.
- Not an IoT/smart-metering product — all consumption/meter data is manually entered, no sensor ingestion.
- Not a full HR, procurement (RFQ/PO/GRN), or fleet/visitor/meeting-room platform in this release — those are explicitly future OAMS modules.
