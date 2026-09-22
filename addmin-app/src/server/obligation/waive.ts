import { HttpError } from "wasp/server";
import type { WaiveMissingItem } from "wasp/server/operations";
import { assertRole, type Role } from "../shared/authz";

export const OFFICE_ADMIN_ROLES: Role[] = ["platform_admin", "office_admin"];

type WaiveMissingItemInput = { instanceId: string; remark: string };

// F-08: "Waiving a Missing item requires a remark and is recorded in AuditLog."
export const waiveMissingItem: WaiveMissingItem<WaiveMissingItemInput, { success: true }> = async (
  { instanceId, remark },
  context,
) => {
  const user = await assertRole(context.user, OFFICE_ADMIN_ROLES, context.entities, "waiveMissingItem");
  if (!remark.trim()) {
    throw new HttpError(400, "A remark is required to waive a missing item.");
  }

  const instance = await context.entities.ObligationInstance.findUnique({ where: { id: instanceId } });
  if (!instance || instance.org_id !== user.org_id) {
    throw new HttpError(404, "Obligation instance not found.");
  }
  if (instance.status !== "missing") {
    throw new HttpError(400, "Only items currently flagged Missing can be waived.");
  }

  await context.entities.ObligationInstance.update({
    where: { id: instanceId },
    data: {
      status: "waived",
      waived_by: user.id,
      waived_remark: remark.trim(),
      waived_at: new Date(),
    },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id!,
      actor_user_id: user.id,
      entity_type: "ObligationInstance",
      entity_id: instanceId,
      action: "waived",
      before_value: { status: "missing" },
      after_value: { status: "waived", remark: remark.trim() },
    },
  });

  return { success: true };
};
