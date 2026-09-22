# Checklist data — how to use it across AddMin (all sections)

This document answers: **once `OfficeChecklistItem` rows exist for an office, how should the rest of the app consume them?** It aligns with F-04/F-05 (`05-features.md`), Build Step 04 (`08-build-playbook.md`), and the `linked_entity_type` / `linked_entity_id` fields in `04-architecture.md`.

AddMin already stores checklist answers; the product value is making **intent** (Yes/No/N/A) drive **UI scope**, **tasks**, **gates**, and **reporting** — not keeping answers in a silo.

---

## Mental model: two layers

| Layer | Source | Meaning |
|--------|--------|---------|
| **Intent** | `OfficeChecklistItem` (`applicability`, `status`, `owner_user_id`) | What the admin said this office needs |
| **Truth** | Module records (`UtilityAccount`, `ComplianceItem`, `User.office_scope`, etc.) | What is actually configured |
| **Bridge** | `linked_entity_type` + `linked_entity_id` | Which truth row satisfies which intent line |

**Setup Completion %** = intent items that are *done* (No/N/A complete immediately; Yes complete when `status` is `configured`/`complete` because of owner **or** link).

**Best practice:** modules **write back** to the bridge when they create/update the record that satisfies a checklist line; modules **read** intent to filter dropdowns, empty states, and “you said you need this” nudges — never the other way around (checklist must not be the only copy of business data).

---

## Per-category usage (all six wizard sections)

### 1. Utilities (`utility_*`)

**Intent codes:** `utility_electricity` … `utility_solar` → maps to `UtilityAccount.utility_type`.

| Use | How |
|-----|-----|
| **Add connection form** | Optional: dropdown shows only types not marked No/N/A (reviewed); default to first “Yes”; label “marked Yes in setup”. *(Not implemented — utilities form stays independent of checklist.)* |
| **Utilities list empty state** | If any utility is “Yes” but no `UtilityAccount` for that type → CTA “Add {label}” deep-linking to new form with type preselected. |
| **Obligation engine** | Only generate utility obligation schedules for types the office marked Yes (or has an account — account wins). |
| **Executive dashboard / spend** | Optional filter: “utilities in scope for this office” = checklist Yes ∪ existing accounts. |
| **Close the loop** | Optional: on `createUtilityAccount`, set checklist link `utility_account` + id; mark item `configured`. *(Not implemented for utilities.)* |

**Template → type mapping:** strip `utility_` prefix from `template_item_code` (single source in `checklistTemplates.ts`).

---

### 2. Facilities (`facility_*`)

**Gap today:** no Facility register module (F-04 step 5 mentions responsibility type; no `/app/facilities` route yet).

| Use | How (until a register exists) |
|-----|-------------------------------|
| **Maintenance** | Suggest categories in “Report an issue” from facility lines marked Yes (housekeeping → housekeeping, security → security). |
| **Vendors / AMC** | When `vendor_facility_mapping` is Yes, My Actions + setup review nudge to `/app/vendors` with copy “map facility vendors”. |
| **Future Facility module** | One `FacilityInstance` per Yes line; link via `linked_entity_type: facility_instance`. |
| **Interim completion** | Yes + assigned **owner** OR linked vendor/AMC contract counts as configured (same as activation gate today). |

Do **not** hide maintenance entirely for No/N/A facilities — only prioritize and pre-fill.

---

### 3. Compliance (`compliance_*`)

**Intent codes:** align with `SEEDED_COMPLIANCE_TYPES` (`fire_noc`, `trade_license`, …).

| Use | How |
|-----|-----|
| **Compliance list** | Primary rows = types marked Available/Yes or Missing (reviewed); hide or collapse Not Applicable; always allow “Add custom type”. |
| **Onboarding vs dashboard** | Same `ComplianceItem` rows; checklist item link when first upload completes (`compliance_item` + id). |
| **Sync applicability** | `setComplianceApplicability` / upload should call shared `reconcileChecklistItem(officeId, code)` so wizard % matches compliance UI. |
| **My Actions** | Missing/expiring items already surface; add setup-phase items: “Yes in checklist but no document” before activation. |
| **Obligation engine** | Expiry schedules only for types in scope (Yes/Available), not for N/A. |

---

### 4. Vendors (`vendor_*`)

Checklist lines are **process** items (mapping), not one vendor per row.

| Use | How |
|-----|-----|
| **Vendor list / create** | If `vendor_utility_mapping` Yes: banner “Link utility providers to connections on Utilities detail.” |
| **AMC** | If `vendor_amc_mapping` Yes: empty AMC list → link to vendor detail + AMC create. |
| **Auto-complete rule** | Mark `vendor_utility_mapping` configured when every **Yes** utility type has a `UtilityAccount` with `vendor_id` set (server job or on save). |
| **Categories** | Optional: restrict “Register vendor” category suggestions (utility_provider vs amc) based on which mapping lines are Yes. |

Vendors are org-scoped; checklist is office-scoped — evaluate rules **per office** (connections and AMCs tied to that office).

---

### 5. Assets (`asset_register_setup`)

Single aggregate line, not per-asset checklist rows.

| Use | How |
|-----|-----|
| **Assets list** | If Yes and zero assets for office → empty state “Complete asset register (marked in setup)” + import CTA. |
| **Auto-complete** | `configured` when `Asset.count({ office_id }) > 0` or CSV import succeeded; set link to first asset or a synthetic `asset_register` marker. |
| **Asset requests** | No checklist filter needed; optional badge on dashboard if register still open. |

---

### 6. Roles (`role_*`)

Each line = a **role slot** for the office (F-04 step 9).

| Use | How |
|-----|-----|
| **Users admin** | For each Yes line, show requirement chip: “Checker needed for {office}” until some user has that role in `office_scope[officeId]`. |
| **Auto-complete** | On `updateUserOffice` / invite, reconcile matching `role_*` checklist item; link `linked_entity_type: user`, `linked_entity_id: userId`. |
| **Workflow / bills** | **Gate (F-04 AC):** if checker Yes but no checker in scope → block submit approval with message + link to `/admin/users` and setup. Same pattern for payment authorizer on payment flows. |
| **My Actions** | Office admins see “Assign Checker for {office}” while `role_checker` Yes + pending. |

Role codes: `role_checker` → require `checker` in `office_scope[officeId]`, etc.

---

## Cross-app surfaces (every section)

### Office Home / Dashboard (`F-18`)

- Show **completion %** (already).
- Add **“Setup gaps”** card: count of Yes + pending without link/owner, link to `/app/offices/:id/setup?category=…`.
- Hide or soften gaps after `setup_status === active` unless you want continuous improvement mode.

### My Actions (`F-18`)

- **Onboarding module** items: Yes + pending (admins) — implemented.
- Extend with **module-specific** open setup (compliance upload missing, role unassigned) using same `ActionItem` shape.

### Office setup / onboarding wizard

- Keep as **editor of intent** + review + activate.
- Per row: Configure → module route; show linked record status.
- Category pills = navigation only; **truth** lives in modules.

### Leases / property (`F-12`)

- Not separate checklist rows today; use **`Office.ownership_type`** from office create (F-04 step 2): if **rented**, nudge lease wizard from setup review and count toward “property ready” in executive view later.

### Bills, approvals, payments, maintenance, reporting

- **Do not** read checklist on every click.
- Read **derived readiness**: e.g. “has checker in scope”, “utility account exists for type”.
- Checklist is the **bootstrap**; runtime depends on real entities.

### Executive dashboard

- Filters: offices with incomplete setup; modules “in scope” from checklist aggregates (optional P1).

---

## Recommended implementation pattern (one pattern, all sections)

### A. Extend template metadata (single file)

In `checklistTemplates.ts`, optional fields per item:

```ts
targetEntityType?: "utility_account" | "compliance_item" | "user" | ...
configPath?: string          // e.g. "/app/utilities/new?type=electricity"
autoComplete?: "on_entity_create" | "on_rule" | "manual"
ruleId?: string              // e.g. "all_yes_utilities_have_vendor"
```

Keeps wizard generic; product edits content without React changes (`08-build-playbook` pitfall).

### B. Server: `reconcileOfficeChecklist(officeId)`

One action/job that:

1. Loads all `OfficeChecklistItem` for office.
2. For each Yes item, runs category rule (counts, links, role in scope).
3. Updates `status` + `linked_entity_*` idempotently.
4. Recomputes `completion_pct`.

Call after: create utility, upload compliance, invite user, import assets, activate vendor.

### C. Client: `useOfficeChecklistScope(officeId, category)`

Returns:

- `isApplicable(code)`, `isYes(code)`, `pendingYes`, `moduleUrl`
- Used by list pages, dropdowns, empty states — **one hook**, all sections.

### D. Never duplicate completion math in React

Only `getOfficeChecklist` / `reconcileOfficeChecklist` compute % (existing mandatory pattern).

---

## Phased rollout (pragmatic)

| Phase | Scope | Outcome |
|-------|--------|---------|
| **1 — Read intent in UI** | Utilities, Compliance, Users | Dropdowns, empty states, banners match checklist (utilities started). |
| **2 — Write back links** | Utility create, compliance upload, user office assign | `linked_entity_*` + auto `configured`; My Actions shrinks. |
| **3 — Rules engine** | Vendor mapping, asset register, roles | Server `reconcile` + workflow gates (checker/authorizer). |
| **4 — Facilities** | New register or maintenance-only mapping | Facility Yes lines link to real entities. |
| **5 — Reporting** | Executive + Office Home gaps | Planned-vs-actual for sales/CS and design partners. |

---

## What not to do

- **Do not** auto-create full utility/compliance records on Yes alone without required fields — creates garbage data.
- **Do not** use checklist as the only store for “do we have electricity?” — after activation, **`UtilityAccount` existence** is truth; checklist is historical intent unless you run continuous reconcile.
- **Do not** block unrelated modules globally when setup incomplete — block **specific actions** (approve bill without checker) with checklist/setup links (F-04 AC).
- **Do not** fork template content into React — keep `CHECKLIST_TEMPLATE` as source of truth.

---

## Current app vs this spec (snapshot)

| Area | Status |
|------|--------|
| Persist Yes/No/N/A + completion % + activate gate | Done |
| My Actions for Yes + pending | Done |
| Utility new form filtered + link on create | Declined (form independent of checklist) |
| Compliance / vendor / asset / role UI driven by checklist | Not yet |
| `reconcileOfficeChecklist` | Not yet |
| Workflow gates from role checklist | Not yet |
| Facility section | Owner-only until module exists |

---

## Summary

Treat checklist data as **office-specific configuration intent** that should:

1. **Scope** what users see (dropdowns, lists, empty states) in every module section.
2. **Drive tasks** in My Actions until intent is satisfied by real records or owners.
3. **Link** intent rows to truth via `linked_entity_*` when modules create data.
4. **Gate** only the workflows that truly depend on a role or entity (checker, authorizer, etc.).
5. **Report** completion and gaps on Office Home, setup review, and optionally executive views.

That is the blueprint-intended use of collected checklist data across **all sections** — not storage for its own sake.

<!-- blueprint-meta: topic=checklist-data-usage product=AddMin relatesTo=F-04,F-05,F-18,F-06,F-17 -->
