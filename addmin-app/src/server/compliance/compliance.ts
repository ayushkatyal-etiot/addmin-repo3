import { HttpError } from "wasp/server";
import type {
  ListComplianceItems,
  GetComplianceItem,
  SetComplianceApplicability,
  UploadComplianceDocument,
} from "wasp/server/operations";
import { assertRole, assertOfficeScope, userFromSession, type Role } from "../shared/authz";
import { SEEDED_COMPLIANCE_TYPES } from "./complianceTypes";

// Build Step 08 (planmysaas-blueprint/08-build-playbook.md): Compliance
// Module, F-17. ComplianceItem rows are created lazily (on first
// applicability change or document upload), not pre-seeded at office
// creation -- listComplianceItems synthesizes a "missing, no row yet" entry
// for every seeded type an office hasn't touched, so the checklist still
// looks complete without a migration/backfill for offices that predate
// this module.
export const COMPLIANCE_ADMIN_ROLES: Role[] = ["platform_admin", "office_admin", "compliance_coordinator"];
export const COMPLIANCE_READ_ROLES: Role[] = [...COMPLIANCE_ADMIN_ROLES, "office_head"];

// Date-only diff (see asset/warrantyJob.ts's fix for why) -- reused by the
// nightly expiry job for the same reason.
export function daysBetween(a: Date, b: Date): number {
  const floor = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((floor(a) - floor(b)) / (24 * 60 * 60 * 1000));
}

export function computeExpiryStatus(
  expiryDate: Date,
  today: Date,
  reminderDays: number[],
): "valid" | "expiring" | "expired" {
  const days = daysBetween(expiryDate, today);
  if (days < 0) return "expired";
  if (days <= Math.max(...reminderDays)) return "expiring";
  return "valid";
}

type ItemSummary = {
  id: string | null;
  compliance_type: string;
  status: string;
  expiry_date: string | null;
  seeded: boolean;
};

export const listComplianceItems: ListComplianceItems<{ officeId: string }, ItemSummary[]> = async (
  { officeId },
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, COMPLIANCE_READ_ROLES, context.entities, "listComplianceItems");
  await assertOfficeScope(user, officeId, context.entities, "listComplianceItems");

  const items = await context.entities.ComplianceItem.findMany({ where: { office_id: officeId } });
  const byType = new Map(items.map((i) => [i.compliance_type, i]));

  const summaries: ItemSummary[] = items.map((i) => ({
    id: i.id,
    compliance_type: i.compliance_type,
    status: i.status,
    expiry_date: i.expiry_date ? i.expiry_date.toISOString() : null,
    seeded: (SEEDED_COMPLIANCE_TYPES as readonly string[]).includes(i.compliance_type),
  }));

  for (const type of SEEDED_COMPLIANCE_TYPES) {
    if (!byType.has(type)) {
      summaries.push({ id: null, compliance_type: type, status: "missing", expiry_date: null, seeded: true });
    }
  }

  return summaries.sort((a, b) => a.compliance_type.localeCompare(b.compliance_type));
};

export const getComplianceItem: GetComplianceItem<
  { id: string },
  {
    id: string;
    office_id: string;
    compliance_type: string;
    status: string;
    expiry_date: string | null;
    documents: Array<{ id: string; doc_ref: string; expiry_date: string; uploaded_by_email: string | null; uploaded_at: string }>;
  }
> = async ({ id }, context) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, COMPLIANCE_READ_ROLES, context.entities, "getComplianceItem");

  const item = await context.entities.ComplianceItem.findUnique({
    where: { id },
    include: { documents: { include: { uploadedBy: true }, orderBy: { uploaded_at: "desc" } } },
  });
  if (!item || item.org_id !== user.org_id) {
    throw new HttpError(404, "Compliance item not found.");
  }
  await assertOfficeScope(user, item.office_id, context.entities, "getComplianceItem");

  return {
    id: item.id,
    office_id: item.office_id,
    compliance_type: item.compliance_type,
    status: item.status,
    expiry_date: item.expiry_date ? item.expiry_date.toISOString() : null,
    documents: item.documents.map((d) => ({
      id: d.id,
      doc_ref: d.doc_ref,
      expiry_date: d.expiry_date.toISOString(),
      uploaded_by_email: d.uploadedBy.email,
      uploaded_at: d.uploaded_at.toISOString(),
    })),
  };
};

type SetApplicabilityInput = {
  office_id: string;
  compliance_type: string;
  applicability: "missing" | "not_applicable";
};

// F-17 edge case: "organization can mark a seeded type Not Applicable for a
// specific office without affecting other offices" -- the natural key is
// (office_id, compliance_type), never global, so this is automatic.
export const setComplianceApplicability: SetComplianceApplicability<SetApplicabilityInput, { id: string }> = async (
  input,
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, COMPLIANCE_ADMIN_ROLES, context.entities, "setComplianceApplicability");
  await assertOfficeScope(user, input.office_id, context.entities, "setComplianceApplicability");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");
  if (!input.compliance_type.trim()) throw new HttpError(400, "Certificate type is required.");

  const item = await context.entities.ComplianceItem.upsert({
    where: { office_id_compliance_type: { office_id: input.office_id, compliance_type: input.compliance_type.trim() } },
    update: { status: input.applicability, expiry_date: null, document_id: null },
    create: {
      org_id: user.org_id,
      office_id: input.office_id,
      compliance_type: input.compliance_type.trim(),
      status: input.applicability,
    },
  });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "ComplianceItem",
      entity_id: item.id,
      action: "applicability_set",
      after_value: { compliance_type: item.compliance_type, status: item.status },
    },
  });

  return { id: item.id };
};

type UploadComplianceDocumentInput = {
  office_id: string;
  compliance_type: string;
  doc_ref: string;
  expiry_date: string;
};

// F-17: "Available certificates get their document uploaded with an expiry
// date captured" -- this action does both the applicability transition
// (missing/not_applicable/expired -> valid|expiring) and the document
// upload in one call, since a real "Available" checklist state only exists
// once there's an actual expiry date to compute it from. Edge case: "expiry
// calculation uses the new document's actual expiry date, not the renewal
// action date" -- always true here since status is derived from
// input.expiry_date, never from today.
export const uploadComplianceDocument: UploadComplianceDocument<UploadComplianceDocumentInput, { id: string }> = async (
  input,
  context,
) => {
  const sessionUser = await userFromSession(context.user, context.entities);
  const user = await assertRole(sessionUser, COMPLIANCE_ADMIN_ROLES, context.entities, "uploadComplianceDocument");
  await assertOfficeScope(user, input.office_id, context.entities, "uploadComplianceDocument");
  if (!user.org_id) throw new HttpError(400, "You must belong to an organization first.");
  if (!input.doc_ref.trim()) throw new HttpError(400, "A file reference is required.");

  const expiryDate = new Date(input.expiry_date);
  if (Number.isNaN(expiryDate.getTime())) {
    throw new HttpError(400, "Expiry date is required.");
  }

  const rule = await context.entities.NotificationRule.findUnique({
    where: { org_id_rule_type: { org_id: user.org_id, rule_type: "compliance_expiry" } },
  });
  const reminderDays = (rule?.reminder_days as number[] | undefined) ?? [30];
  const status = computeExpiryStatus(expiryDate, new Date(), reminderDays);

  const item = await context.entities.ComplianceItem.upsert({
    where: {
      office_id_compliance_type: { office_id: input.office_id, compliance_type: input.compliance_type.trim() },
    },
    update: { status, expiry_date: expiryDate, escalated_at: null },
    create: {
      org_id: user.org_id,
      office_id: input.office_id,
      compliance_type: input.compliance_type.trim(),
      status,
      expiry_date: expiryDate,
    },
  });

  const document = await context.entities.ComplianceDocument.create({
    data: {
      org_id: user.org_id,
      compliance_item_id: item.id,
      doc_ref: input.doc_ref.trim(),
      expiry_date: expiryDate,
      uploaded_by: user.id,
    },
  });

  await context.entities.ComplianceItem.update({ where: { id: item.id }, data: { document_id: document.id } });

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "ComplianceItem",
      entity_id: item.id,
      action: "document_uploaded",
      after_value: { doc_ref: document.doc_ref, expiry_date: input.expiry_date, status },
    },
  });

  return { id: item.id };
};
