import { HttpError } from "wasp/server";
import type { ActivateOffice } from "wasp/server/operations";
import { assertRole, assertOfficeScope, type Role } from "../shared/authz";
import { CHECKLIST_TEMPLATE } from "./checklistTemplates";

// Build Step 04 (planmysaas-blueprint/08-build-playbook.md): F-05's
// activation gate. Deliberately never reads Subscription/billing status --
// F-05's user flow is explicit that office activation is never blocked by
// trial/plan state (that's Step 05's concern entirely).
export const OFFICE_ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];

type ActivateOfficeInput = { officeId: string };
type ActivateOfficeResult = { success: true } | { success: false; missingItems: string[] };

export const activateOffice: ActivateOffice<ActivateOfficeInput, ActivateOfficeResult> = async (
  { officeId },
  context,
) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "activateOffice");
  await assertOfficeScope(user, officeId, context.entities, "activateOffice");

  const office = await context.entities.Office.findUnique({ where: { id: officeId } });
  if (!office || office.org_id !== user.org_id) {
    throw new HttpError(404, "Office not found.");
  }

  const items = await context.entities.OfficeChecklistItem.findMany({ where: { office_id: officeId } });
  const templateByCode = new Map(CHECKLIST_TEMPLATE.map((t) => [t.code, t]));

  // Gate: every item marked "yes"/"Available" must be configured or have an
  // assigned owner. "no"/"not_applicable" items never block activation.
  const missingItems = items
    .filter((item) => item.applicability === "yes")
    .filter((item) => item.status === "pending" && !item.owner_user_id)
    .map((item) => templateByCode.get(item.template_item_code)?.label ?? item.template_item_code);

  if (missingItems.length > 0) {
    return { success: false, missingItems };
  }

  const now = new Date();
  await context.entities.Office.update({
    where: { id: officeId },
    data: { setup_status: "active" },
  });
  await context.entities.OfficeSetupProfile.update({
    where: { office_id: officeId },
    data: { activated_at: now, activated_by: user.id },
  });
  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "Office",
      entity_id: officeId,
      action: "activated",
      after_value: { activated_at: now.toISOString() },
    },
  });

  return { success: true };
};
