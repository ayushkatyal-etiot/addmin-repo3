import { HttpError } from "wasp/server";
import type { GetOfficeChecklist, UpdateChecklistItem } from "wasp/server/operations";
import type { PrismaClient } from "@prisma/client";
import { assertRole, assertOfficeScope, type Role } from "../shared/authz";
import { CHECKLIST_TEMPLATE, CHECKLIST_CATEGORY_ORDER } from "./checklistTemplates";

// Build Step 04 (planmysaas-blueprint/08-build-playbook.md): Onboarding
// module. Setup Completion % is computed here and only here (server-side),
// per the step's mandatory pattern -- never duplicated in the React client.
//
// Sentinel state: a checklist item that has never been touched by the admin
// is stored as (applicability: "no", status: "pending"). Explicitly choosing
// "No"/"Missing" flips status to "complete" immediately (nothing left to
// configure), which is what distinguishes "never reviewed" from "reviewed,
// answered no" using only the two enum columns 04-architecture.md already
// defines -- no extra "unset" enum value needed.
const OFFICE_ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];

type ChecklistItemDto = {
  id: string;
  template_item_code: string;
  category: string;
  label: string;
  yesLabel: string;
  noLabel: string;
  applicability: string;
  status: string;
  owner_user_id: string | null;
  reviewed: boolean; // false = still the (no, pending) sentinel default
};

type ChecklistResultDto = {
  officeId: string;
  officeName: string;
  setupStatus: string;
  completionPct: number;
  completionByCategory: Record<string, number>;
  items: ChecklistItemDto[];
  // First category (in CHECKLIST_CATEGORY_ORDER) containing an un-reviewed
  // item -- lets the wizard resume exactly where the admin left off purely
  // from persisted state, no client-side step tracking required.
  resumeCategory: string;
};

async function ensureChecklistItemsExist(
  officeId: string,
  orgId: string,
  entities: {
    OfficeSetupProfile: PrismaClient["officeSetupProfile"];
    OfficeChecklistItem: PrismaClient["officeChecklistItem"];
  },
) {
  let profile = await entities.OfficeSetupProfile.findUnique({ where: { office_id: officeId } });
  if (!profile) {
    profile = await entities.OfficeSetupProfile.create({
      data: { org_id: orgId, office_id: officeId, completion_pct: 0 },
    });
  }

  const existingCount = await entities.OfficeChecklistItem.count({ where: { office_id: officeId } });
  if (existingCount === 0) {
    // Backfills offices created before this template existed (e.g. Build
    // Step 02's seed office) so the checklist is "always pre-populated,
    // never blank" per 06-frontend.md, regardless of when the office row
    // was created.
    await entities.OfficeChecklistItem.createMany({
      data: CHECKLIST_TEMPLATE.map((item) => ({
        org_id: orgId,
        office_id: officeId,
        office_setup_profile_id: profile!.id,
        template_item_code: item.code,
        category: item.category,
        applicability: "no" as const,
        status: "pending" as const,
      })),
    });
  }
  return profile;
}

function isApplicable(applicability: string): boolean {
  return applicability !== "not_applicable";
}

function isDone(status: string): boolean {
  return status === "complete" || status === "configured";
}

function isReviewed(applicability: string, status: string): boolean {
  // The only unreviewed state is the sentinel default (no, pending); every
  // other combination means the admin has actively made a choice.
  return !(applicability === "no" && status === "pending");
}

function computeCompletion(items: { category: string; applicability: string; status: string }[]) {
  const applicable = items.filter((i) => isApplicable(i.applicability));
  const overallPct = applicable.length === 0 ? 100 : Math.round((applicable.filter((i) => isDone(i.status)).length / applicable.length) * 100);

  const byCategory: Record<string, number> = {};
  for (const category of CHECKLIST_CATEGORY_ORDER) {
    const inCategory = applicable.filter((i) => i.category === category);
    byCategory[category] = inCategory.length === 0 ? 100 : Math.round((inCategory.filter((i) => isDone(i.status)).length / inCategory.length) * 100);
  }

  return { overallPct, byCategory };
}

export const getOfficeChecklist: GetOfficeChecklist<{ officeId: string }, ChecklistResultDto> = async (
  { officeId },
  context,
) => {
  const user = await assertRole(
    context.user,
    [...OFFICE_ADMIN_ROLES, "office_head"],
    context.entities,
    "getOfficeChecklist",
  );
  await assertOfficeScope(user, officeId, context.entities, "getOfficeChecklist");

  const office = await context.entities.Office.findUnique({ where: { id: officeId } });
  if (!office || office.org_id !== user.org_id) {
    throw new HttpError(404, "Office not found.");
  }

  await ensureChecklistItemsExist(officeId, user.org_id, context.entities);

  const items = await context.entities.OfficeChecklistItem.findMany({
    where: { office_id: officeId },
    orderBy: { template_item_code: "asc" },
  });

  const { overallPct, byCategory } = computeCompletion(items);

  // Persist so other modules (Office Home in a later step) can read
  // completion_pct without recomputing it themselves.
  await context.entities.OfficeSetupProfile.update({
    where: { office_id: officeId },
    data: { completion_pct: overallPct },
  });

  const templateByCode = new Map(CHECKLIST_TEMPLATE.map((t) => [t.code, t]));
  const dtoItems: ChecklistItemDto[] = items.map((item) => {
    const template = templateByCode.get(item.template_item_code);
    return {
      id: item.id,
      template_item_code: item.template_item_code,
      category: item.category,
      label: template?.label ?? item.template_item_code,
      yesLabel: template?.yesLabel ?? "Yes",
      noLabel: template?.noLabel ?? "No",
      applicability: item.applicability,
      status: item.status,
      owner_user_id: item.owner_user_id,
      reviewed: isReviewed(item.applicability, item.status),
    };
  });

  const resumeCategory =
    CHECKLIST_CATEGORY_ORDER.find((category) =>
      dtoItems.some((item) => item.category === category && !item.reviewed),
    ) ?? "review";

  return {
    officeId,
    officeName: office.name,
    setupStatus: office.setup_status,
    completionPct: overallPct,
    completionByCategory: byCategory,
    items: dtoItems,
    resumeCategory,
  };
};

type UpdateChecklistItemInput = {
  officeId: string;
  itemId: string;
  applicability: "yes" | "no" | "not_applicable";
  ownerUserId?: string | null;
};

export const updateChecklistItem: UpdateChecklistItem<UpdateChecklistItemInput, { success: true }> = async (
  { officeId, itemId, applicability, ownerUserId },
  context,
) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "updateChecklistItem");
  await assertOfficeScope(user, officeId, context.entities, "updateChecklistItem");

  const item = await context.entities.OfficeChecklistItem.findUnique({ where: { id: itemId } });
  if (!item || item.office_id !== officeId || item.org_id !== user.org_id) {
    throw new HttpError(404, "Checklist item not found.");
  }

  // Business rule (Build Step 04, F-04/F-05): "No"/"Not Applicable" need no
  // further configuration, so they resolve immediately. "Yes" stays "pending"
  // (an open action item, per F-04's acceptance criteria) unless the admin
  // also assigns an owner right now, which counts as "configured" for the
  // activation gate in activateOffice.
  let status: "pending" | "configured" | "complete";
  if (applicability === "no" || applicability === "not_applicable") {
    status = "complete";
  } else if (ownerUserId) {
    status = "configured";
  } else {
    status = "pending";
  }

  if (ownerUserId) {
    const owner = await context.entities.User.findUnique({ where: { id: ownerUserId } });
    if (!owner || owner.org_id !== user.org_id) {
      throw new HttpError(400, "Owner must be a user in your organization.");
    }
  }

  const before = { applicability: item.applicability, status: item.status, owner_user_id: item.owner_user_id };

  await context.entities.OfficeChecklistItem.update({
    where: { id: itemId },
    data: {
      applicability,
      status,
      owner_user_id: ownerUserId ?? (applicability === "yes" ? item.owner_user_id : null),
    },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "OfficeChecklistItem",
      entity_id: itemId,
      action: "updated",
      before_value: before,
      after_value: { applicability, status, owner_user_id: ownerUserId ?? null },
    },
  });

  // Recompute + persist completion_pct immediately (sub-second, per F-05's
  // acceptance criteria) rather than waiting for the next getOfficeChecklist call.
  const items = await context.entities.OfficeChecklistItem.findMany({ where: { office_id: officeId } });
  const { overallPct } = computeCompletion(items);
  await context.entities.OfficeSetupProfile.update({
    where: { office_id: officeId },
    data: { completion_pct: overallPct },
  });

  return { success: true };
};
