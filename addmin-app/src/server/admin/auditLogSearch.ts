import type { SearchAuditLogs } from "wasp/server/operations";
import { assertRole, type Role } from "../shared/authz";

// Build Step 11: production hardening. AuditLog rows have existed since
// Step 02 (every assertRole/assertOfficeScope denial and most mutations
// write one), but there was no admin UI to search them -- only direct DB
// queries. platform_admin only: this is org-wide activity, not scoped to
// one office the way most other admin screens are.
const ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];

const PAGE_SIZE = 50;

type AuditLogRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string | null;
  actor_platform_operator_id: string | null;
  actorEmail: string | null;
  created_at: Date;
};

export const searchAuditLogs: SearchAuditLogs<
  { entityType?: string; actorEmail?: string; from?: string; to?: string; page?: number },
  { rows: AuditLogRow[]; total: number; page: number; pageSize: number }
> = async (input, context) => {
  const user = await assertRole(context.user, ADMIN_ROLES, context.entities, "searchAuditLogs");
  const page = Math.max(1, input.page ?? 1);

  const where: any = { org_id: user.org_id! };
  if (input.entityType) where.entity_type = input.entityType;
  if (input.from || input.to) {
    where.created_at = {};
    if (input.from) where.created_at.gte = new Date(input.from);
    if (input.to) where.created_at.lte = new Date(input.to);
  }
  if (input.actorEmail) {
    where.actor = { email: { contains: input.actorEmail, mode: "insensitive" } };
  }

  const [rows, total] = await Promise.all([
    context.entities.AuditLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { email: true } } },
    }),
    context.entities.AuditLog.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      action: r.action,
      actor_user_id: r.actor_user_id,
      actor_platform_operator_id: r.actor_platform_operator_id,
      actorEmail: (r as any).actor?.email ?? null,
      created_at: r.created_at,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
};
