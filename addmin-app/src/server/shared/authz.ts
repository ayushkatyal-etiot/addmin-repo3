import { HttpError } from "wasp/server";
import type { AuthUser } from "wasp/auth";
import type { PrismaClient } from "@prisma/client";
import { isMfaCurrentlyVerified, MFA_REQUIRED_ROLES } from "../auth/mfa";

export type Role = NonNullable<AuthUser["role"]>;

/**
 * Every operation's first line. Throws (never silently filters) so a scope
 * bug fails loud, not as a data leak. Writes the denial to AuditLog before
 * rejecting, per F-02's acceptance criteria -- callers don't need to do this
 * themselves.
 */
export async function assertRole(
  user: AuthUser | null | undefined,
  allowedRoles: Role[],
  entities: { AuditLog: PrismaClient["auditLog"] },
  actionLabel: string,
): Promise<AuthUser> {
  if (!user) {
    throw new HttpError(401);
  }
  requireMfaIfEnabled(user);

  if (!user.role || !allowedRoles.includes(user.role)) {
    await logDenial(entities, user, actionLabel, "role_denied");
    throw new HttpError(403, "You do not have permission to perform this action.");
  }
  return user;
}

/**
 * Call after assertRole (or on its own for office-scoped reads open to any
 * role) whenever an operation touches a specific office. Re-derives scope
 * from the database via `user` on every call -- never trust a client-passed
 * officeId/role, and never cache scope on the session.
 */
export async function assertOfficeScope(
  user: AuthUser,
  officeId: string,
  entities: { AuditLog: PrismaClient["auditLog"] },
  actionLabel: string,
): Promise<void> {
  requireMfaIfEnabled(user);

  const officeScope = (user.office_scope ?? {}) as Record<string, string[]>;
  const hasUnrestrictedAccess = user.role === "platform_admin";
  const isInScope = hasUnrestrictedAccess || Object.keys(officeScope).includes(officeId);

  if (!isInScope) {
    await logDenial(entities, user, actionLabel, "office_scope_denied", officeId);
    throw new HttpError(403, "You do not have access to this office.");
  }
}

function requireMfaIfEnabled(user: AuthUser): void {
  const mfaIsRequiredForRole =
    !!user.role && (MFA_REQUIRED_ROLES as readonly string[]).includes(user.role);

  if (mfaIsRequiredForRole && !user.mfa_enabled) {
    throw new HttpError(403, "MFA enrollment required for this role.");
  }
  if (user.mfa_enabled && !isMfaCurrentlyVerified(user.mfa_verified_until)) {
    throw new HttpError(403, "MFA verification required.");
  }
}

async function logDenial(
  entities: { AuditLog: PrismaClient["auditLog"] },
  user: AuthUser,
  actionLabel: string,
  reason: string,
  entityId?: string,
): Promise<void> {
  if (!user.org_id) return; // nothing to scope the audit row to
  await entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: actionLabel,
      entity_id: entityId ?? "n/a",
      action: `denied:${reason}`,
    },
  });
}
