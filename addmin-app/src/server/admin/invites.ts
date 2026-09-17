import crypto from "node:crypto";
import { HttpError } from "wasp/server";
import { emailSender } from "wasp/server/email";
import type { InviteUser } from "wasp/server/operations";
import { assertRole } from "../shared/authz";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type InviteUserInput = {
  email: string;
  role: string;
  officeScope?: Record<string, string[]>;
};

// platform_admin only -- this is the only way a second (or Nth) user ever
// joins an Organization, per the invite-only decision. See
// src/auth/email/userSignupFields.ts for the signup-side half of this flow.
export const inviteUser: InviteUser<InviteUserInput, { inviteId: string }> = async (
  { email, role, officeScope },
  context,
) => {
  const user = await assertRole(context.user, ["platform_admin"], context.entities, "inviteUser");
  if (!user.org_id) {
    throw new HttpError(400, "You must belong to an organization to invite users.");
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
