# Decision note: Can AddMin ship without the setup checklist?

**Question:** Drop (or drastically simplify) F-04/F-05 guided setup and rely on modules alone.

**Short answer:** **Yes, you can ship without the multi-step checklist** — if you accept a different first-run story and move “what must exist” into **Office Home + My Actions + module empty states**, not a dedicated wizard.

---

## What you lose vs keep

| If you remove setup | Impact |
|---------------------|--------|
| **Marketing story** | Weaker match to “checklist-driven onboarding” in `01-idea.md` and demo narrative — you lean harder on **obligation engine + My Actions** as the wedge. |
| **Trial funnel** | `register → onboard → subscribe` becomes `register → add office → dashboard` — still valid; onboarding step is shorter. |
| **Completion % / Activate gate** | These become optional or replaced by “office is active when created.” |
| **Differentiation** | Partially moved: **obligation-first** still holds if bills/leases/compliance create schedules without a prior checklist. |

| What still delivers “office-first, not expense-first” | How |
|--------------------------------------------------------|-----|
| Office switcher + scoped modules | Unchanged |
| Recurring obligations | Unchanged — core retention |
| My Actions + Office Home | **Becomes the primary “what’s missing” surface** |
| Compliance seeded types | Module-native, no wizard required |

---

## Three options (recommended order)

### Option A — **Minimal setup (recommended)**

**Keep:** Create office (name, address, type, ownership). **Drop:** Six-category checklist wizard, `OfficeChecklistItem` UX, activate ceremony.

**Behavior:**

- New office → `setup_status = active` immediately (or `active` after save on `NewOfficePage`).
- Remove `/app/onboarding` redirect from `HomePage`; land on `/app/dashboard`.
- Keep `/app/offices/:id/setup` as **office details edit only** (already partly there) or merge into a single “Office settings” page.
- **Do not delete** checklist tables yet — stop seeding/writing items on create, or leave dormant for a future “guided mode” flag.

**Why:** Smallest code churn, fastest path for design partners who already know what to configure. Aligns with your recent choice **not** to tie utilities (or other modules) to checklist answers.

**Product copy shift:** “Add an office, then add utilities, leases, and compliance as you go — AddMin tracks what’s due.”

---

### Option B — **Full removal (cleanest architecture)**

Everything in Option A, plus:

- Stop creating `OfficeChecklistItem` rows in `createOffice`.
- Remove `getOfficeChecklist`, `updateChecklistItem`, `activateOffice` from product UI (optional: keep API for migration period).
- Remove onboarding items from `listMyActions`.
- Drop `completion_pct` from office list/dashboard or replace with a **live health score** (e.g. count of open obligations / missing compliance — derived from modules only).

**Why:** Less surface area, no dual “intent vs truth” model. **Cost:** Larger delete/refactor; update `05-features.md` / playbook mentally as “F-04 deferred.”

---

### Option C — **Keep setup as optional “Guided mode” (enterprise / first office only)**

Default = Option A for all offices. Toggle org setting: “Show guided setup for new offices” for customers who want the checklist.

**Why:** Preserves blueprint differentiator for sales without forcing every user through 25 toggles. **Cost:** Two paths to maintain unless guided mode stays frozen.

---

## Recommendation

**Ship Option A now**, plan Option B once no customer relies on checklist data.

Reasons specific to your trajectory:

1. Checklist **does not yet drive** modules (and you explicitly **declined** utilities coupling) — users get little extra value from the wizard today.
2. **Real value** in the app is obligations, approvals, compliance expiry, My Actions — those work without setup.
3. Design partners can configure modules directly; completion % is a weak substitute for “3 overdue utilities on Office Home.”
4. You can reintroduce a **shorter** guided flow later as **templates** (“Start with this office profile: branch + rented”) without persisting 25 checklist rows.

---

## If you choose Option A — concrete app changes (checklist)

**Status: Implemented (2026-09-22).**

1. `createOffice`/`bulkImportOffices` → set `setup_status: "active"` immediately; stop seeding `OfficeChecklistItem` rows on create. `OfficeSetupProfile` still gets a row (Office Home's `completionPct` read still expects one) but fixed at 100%.
2. `HomePage` → no more `needsOnboarding` check / redirect to `/app/onboarding`; goes straight to `/app/dashboard` once an office exists.
3. `OnboardingRoute` (`/app/onboarding`) removed from `main.wasp.ts` entirely — no route, no import. `OnboardingPage.tsx`, `OfficeChecklistWizard.tsx`, `SetupReview.tsx`, and the `getOfficeChecklist`/`updateChecklistItem`/`activateOffice` operations are left in place (dormant) rather than deleted, per Option A's "don't delete yet" note — nothing routes to them anymore.
4. `OfficeSetupPage` (`/app/offices/:id/setup`) → stripped down to office-details editing only (`OfficeDetailsForm`); the `?category=` checklist-wizard branch and "Open onboarding flow" link are gone.
5. Office list (`OfficeListPage`) → removed the "Setup" badge and "Completion %" columns and the "Continue setup"/"Manage setup" link; replaced with a plain "Edit details" link.
6. Office Home (`DashboardPage`) → removed the "`{completionPct}% set up`" badge next to the office name (it was always going to read 100% for every new office going forward, so it had no signal left).
7. `listMyActions` → removed the "onboarding: checklist items marked Yes but still unowned" block and the `"onboarding"` module/label; nothing seeds those rows anymore so the block was dead weight.
8. `navSearch.ts` / `authScreenRoutes.ts` → removed the `/app/onboarding` command-palette entry and auth-screen path entry.
9. `seed.ts` → seed office now created with `setup_status: "active"` too, for consistency with real signups.

**Keep:** Office entity, ownership → lease nudge (can live on dashboard card, not wizard).

---

## Positioning after dropping setup

**Before:** “We onboard you with a checklist so you know what to configure.”  
**After:** “We track every obligation per office — add what you have, we tell you what’s missing and due.”

Still **office-first**; the checklist was one implementation of “proactive,” not the only one.

---

## When *not* to drop setup

- You are selling to **first-time admins** who truly don’t know what a branch office needs (checklist is education).
- Sales/demo **depends** on the wizard visual (completion ring) in the first 5 minutes.
- You want **activation metrics** (completion %) for trial conversion analytics before module data exists.

If those matter later, use Option C or a 5-question “office profile quiz” instead of full F-04.

<!-- blueprint-meta: topic=setup-removal decision=Option-A-recommended product=AddMin -->
