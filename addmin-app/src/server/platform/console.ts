import type { Request, Response } from "express";
import { prisma } from "wasp/server";
import type {
  ListOrganizationsInternal,
  SetTenantStatusInternal,
  SetSubscriptionInternal,
} from "wasp/server/api";
import { requirePlatformOperator } from "./platformAuth";

// Raw api routes, same reasoning as platformAuth.ts: PlatformOperator never
// flows through Wasp's typed context.user. This is the one module that
// intentionally crosses org boundaries (04-architecture.md's Platform
// Operations Module), so every write here is audited with
// actor_platform_operator_id, never actor_user_id.

export const listOrganizationsInternal: ListOrganizationsInternal = async (req, res) => {
  try {
    await requirePlatformOperator(req);
  } catch {
    res.status(401).json({ message: "Not authenticated." });
    return;
  }

  const orgs = await prisma.organization.findMany({
    include: { subscription: true },
    orderBy: { created_at: "desc" },
  });

  res.json(
    orgs.map((org) => ({
      id: org.id,
      name: org.name,
      tenant_status: org.tenant_status,
      plan: org.subscription?.plan ?? null,
      subscription_status: org.subscription?.status ?? null,
      trial_ends_at: org.subscription?.trial_ends_at?.toISOString() ?? null,
    })),
  );
};

export const setTenantStatusInternal: SetTenantStatusInternal = async (req, res) => {
  let operator;
  try {
    operator = await requirePlatformOperator(req);
  } catch {
    res.status(401).json({ message: "Not authenticated." });
    return;
  }

  const orgId = req.params.orgId as string;
  const { tenant_status } = req.body ?? {};
  if (tenant_status !== "active" && tenant_status !== "suspended") {
    res.status(400).json({ message: "tenant_status must be 'active' or 'suspended'." });
    return;
  }

  const before = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!before) {
    res.status(404).json({ message: "Organization not found." });
    return;
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { tenant_status },
  });

  await prisma.auditLog.create({
    data: {
      org_id: orgId,
      actor_platform_operator_id: operator.id,
      entity_type: "Organization",
      entity_id: orgId,
      action: "tenant_status_set_by_platform_operator",
      before_value: { tenant_status: before.tenant_status },
      after_value: { tenant_status },
    },
  });

  res.json({ success: true });
};

export const setSubscriptionInternal: SetSubscriptionInternal = async (req, res) => {
  let operator;
  try {
    operator = await requirePlatformOperator(req);
  } catch {
    res.status(401).json({ message: "Not authenticated." });
    return;
  }

  const orgId = req.params.orgId as string;
  const { plan, status } = req.body ?? {};
  const validPlans = ["starter", "growth", "enterprise"];
  const validStatuses = ["trialing", "active", "past_due", "expired", "canceled"];
  if (plan && !validPlans.includes(plan)) {
    res.status(400).json({ message: `plan must be one of ${validPlans.join(", ")}` });
    return;
  }
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ message: `status must be one of ${validStatuses.join(", ")}` });
    return;
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    res.status(404).json({ message: "Organization not found." });
    return;
  }

  // Upsert, not update-only: a sales-assisted Enterprise org (F-19's
  // alternate path) may never have gone through self-serve signup, so it
  // may have no Subscription row yet -- a Platform Operator must be able to
  // create one here, not just edit an existing one.
  const before = await prisma.subscription.findUnique({ where: { org_id: orgId } });

  await prisma.subscription.upsert({
    where: { org_id: orgId },
    update: {
      plan: plan ?? undefined,
      status: status ?? undefined,
      activated_at: status === "active" && !before?.activated_at ? new Date() : undefined,
    },
    create: {
      org_id: orgId,
      plan: plan ?? "starter",
      status: status ?? "trialing",
      activated_at: status === "active" ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      org_id: orgId,
      actor_platform_operator_id: operator.id,
      entity_type: "Subscription",
      entity_id: orgId,
      action: before ? "subscription_set_by_platform_operator" : "subscription_created_by_platform_operator",
      before_value: before ? { plan: before.plan, status: before.status } : undefined,
      after_value: {
        plan: plan ?? before?.plan ?? "starter",
        status: status ?? before?.status ?? "trialing",
      },
    },
  });

  res.json({ success: true });
};
