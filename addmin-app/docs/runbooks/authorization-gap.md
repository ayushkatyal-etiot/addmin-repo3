# Runbook: Suspected authorization gap

**Symptom:** a user (or a pentest/audit) reports being able to see or do something their role shouldn't allow — e.g. an `employee` reading another office's bills, a `checker` approving their own submission, a user acting on an org they don't belong to.

## 1. Confirm it, don't assume it

Every authorization decision in this app goes through exactly two functions in `src/server/shared/authz.ts`:

- `assertRole(user, allowedRoles, entities, actionLabel)` — role allow-list check, plus org-suspension and MFA gating.
- `assertOfficeScope(user, officeId, entities, actionLabel)` — office-scope check (bypassed only for `platform_admin`).

Every denial these two functions produce writes an `AuditLog` row with `action` starting `denied:` (`denied:role_denied`, `denied:office_scope_denied`) — check `/admin/audit-logs` (Build Step 11) filtered by the actor's email first. If there's a `denied:*` row for the exact action in question, authorization is working correctly and the report is user error (wrong expectation, not a real gap) — stop here.

If there's **no** denial logged but the action clearly should have been blocked, that's a real gap. Continue.

## 2. Find where it broke

A gap has exactly one of two shapes:

1. **The operation never calls `assertRole`/`assertOfficeScope` at all.** Grep the operation function in `src/server/**/*.ts` for `assertRole(` — every mutating operation and every office-scoped read should have one near the top, before any DB write. If it's missing, that's the bug.
2. **It calls them, but with the wrong allow-list.** Compare the role list passed against what `05-features.md`'s acceptance criteria for that feature actually says. `tests/authz-coverage.test.ts` (Build Step 11) pins the exact expected role list per module's exported `*_ROLES` constant — if the constant itself was edited to the wrong list, that test should already be failing in CI; if it's passing, the drift happened outside those pinned constants (e.g. a one-off inline role array that was never exported/pinned) — find it and pin it there too.

Also check for office-scope specifically: an operation that takes an `office_id`/`officeId` param but never calls `assertOfficeScope` on it will let any role-authorized user act on **any** office, not just their own. This is a different bug class than a wrong role list and easy to miss in review since the role check still "works."

## 3. Fix

- The lazy fix is also the correct fix here: add the missing `assertRole`/`assertOfficeScope` call at the top of the operation, mirroring the pattern every other operation in that same file already uses (see `src/server/shared/authz.ts`'s own doc comment on `assertOfficeScope`: "Re-derives scope from the database via `user` on every call — never trust a client-passed officeId/role, and never cache scope on the session.").
- Add the exact scenario as a new case in `tests/authz-coverage.test.ts` (or `tests/authz.test.ts` if it's about the primitive itself) so this exact gap can't regress silently.
- If the gap already shipped and real users may have exploited it, that's a data-integrity question, not just a code fix — check `AuditLog` for the affected entity's history around the window the gap was live, and loop in whoever owns customer comms if any cross-tenant data was actually exposed.

## 4. Prevention

- `tests/authz-coverage.test.ts` pins every module's role allow-list and proves `assertRole` enforces it correctly — keep it updated whenever a module adds a new mutating operation or changes who's allowed to call an existing one.
- Any new operation that takes an `office_id` and doesn't call `assertOfficeScope` should be treated as a review blocker, not a follow-up — office-scope gaps don't throw obviously wrong-looking errors in casual testing, they just quietly overshare.
