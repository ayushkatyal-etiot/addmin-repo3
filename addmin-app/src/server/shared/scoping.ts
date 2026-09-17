import { HttpError } from "wasp/server";

type ScopedUser = {
  org_id: string | null;
};

/**
 * Every operation that reads or writes org-scoped data must call this first.
 * Throws (never silently filters) so a scope bug fails loud, not as a leak.
 */
export function assertOrgScope(user: ScopedUser | null | undefined, orgId: string): void {
  if (!user) {
    throw new HttpError(401);
  }
  if (!user.org_id) {
    throw new HttpError(403, "User is not assigned to an organization yet.");
  }
  if (user.org_id !== orgId) {
    throw new HttpError(403, "User does not have access to this organization.");
  }
}
