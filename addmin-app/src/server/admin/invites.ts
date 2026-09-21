import crypto from "node:crypto";
import { HttpError } from "wasp/server";
import { emailSender } from "wasp/server/email";
import type { InviteUser } from "wasp/server/operations";
import { assertRole, ALL_ROLES } from "../shared/authz";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type InviteUserInput = {
  email: string;
  // Account-level role: what the invite/signup flow needs a single value
  // for (Invite.role/User.role -- MFA requirement, etc). Falls back to this
  // for any office in officeRoles that doesn't specify its own.
  role: string;
  // Every role except platform_admin is office-scoped (see assertOfficeScope
  // in shared/authz.ts), so at least one office must be chosen at invite
  // time -- there is no later step that assigns one. Per-office role lets a
  // user be, say, office_admin at one site and checker at another --
  // office_scope stores exactly what's given here, one role per office.
  officeRoles?: Record<string, string>;
};

// platform_admin only -- this is the only way a second (or Nth) user ever
// joins an Organization, per the invite-only decision. See
// src/auth/email/userSignupFields.ts for the signup-side half of this flow.
export const inviteUser: InviteUser<InviteUserInput, { inviteId: string }> = async (
  { email, role, officeRoles },
  context,
) => {
  const user = await assertRole(context.user, ["platform_admin"], context.entities, "inviteUser");
  if (!user.org_id) {
    throw new HttpError(400, "You must belong to an organization to invite users.");
  }

  const officeEntries = Object.entries(officeRoles ?? {});
  if (role !== "platform_admin" && officeEntries.length === 0) {
    throw new HttpError(400, "Choose at least one office (and role) for this user.");
  }
  for (const [, officeRole] of officeEntries) {
    if (!ALL_ROLES.includes(officeRole as never)) {
      throw new HttpError(400, `"${officeRole}" is not a valid role.`);
    }
  }

  let officeScope: Record<string, string[]> | undefined;
  if (officeEntries.length > 0) {
    const officeIds = officeEntries.map(([id]) => id);
    const offices = await context.entities.Office.findMany({
      where: { id: { in: officeIds }, org_id: user.org_id },
    });
    if (offices.length !== officeIds.length) {
      throw new HttpError(400, "One or more selected offices do not belong to your organization.");
    }
    officeScope = Object.fromEntries(officeEntries.map(([id, officeRole]) => [id, [officeRole]]));
  }

  const existingUser = await context.entities.User.findUnique({ where: { email } });
  if (existingUser) {
    throw new HttpError(400, "That email already has an account.");
  }

  const token = crypto.randomBytes(24).toString("base64url");

  const invite = await context.entities.Invite.create({
    data: {
      org_id: user.org_id,
      email,
      role: role as never, // validated against the UserRole enum by Prisma at insert time
      office_scope: officeScope ?? undefined,
      token,
      invited_by: user.id,
      expires_at: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const signupUrl = `${process.env.WASP_WEB_CLIENT_URL ?? "http://localhost:3002"}/signup?invite=${token}`;

  await emailSender.send({
    to: email,
    subject: "You've been invited to AddMin",
    text: `You've been invited to join an organization on AddMin. Sign up here: ${signupUrl}\n\nThis invite expires in 7 days.`,
    html: `<p>You've been invited to join an organization on AddMin.</p><p><a href="${signupUrl}">Accept the invite</a></p><p>This invite expires in 7 days.</p>`,
  });

  return { inviteId: invite.id };
};
