import { defineUserSignupFields } from "wasp/server/auth";
import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";

// Invite-only teammate signup: only the first user of an Organization signs
// up self-serve (creating the org, per 04-architecture.md F-19's trial
// funnel). Every subsequent User must present a valid, unexpired,
// email-matching Invite token -- there's no open "create your own org"
// signup beyond the first user. See planmysaas-blueprint/08-build-playbook.md
// Build Step 03 and src/server/admin/invites.ts (the platform_admin-only
// action that creates+emails these tokens).
//
// The client passes `inviteToken` as an extra field on the raw signup
// payload (src/auth/email/SignupPage.tsx) -- it isn't a User column, so it's
// read out of the untyped `data` object each getter receives, not declared
// as a field below.

// Read-only and safe to call from more than one field getter for the same
// signup request -- Wasp doesn't guarantee getter execution order, so this
// must not depend on a mutation another getter may or may not have made yet.
// The actual "can't reuse this invite for a second account" guarantee comes
// from User.email's unique constraint, not from a status transition here.
async function resolveInvite(data: { [key: string]: unknown }) {
  const inviteToken = typeof data.inviteToken === "string" ? data.inviteToken : undefined;
  if (!inviteToken) return null;

  const invite = await prisma.invite.findUnique({ where: { token: inviteToken } });
  if (!invite) {
    throw new HttpError(400, "This invite link is invalid.");
  }
  if (invite.status === "revoked") {
    throw new HttpError(400, "This invite has been revoked.");
  }
  if (invite.expires_at.getTime() < Date.now()) {
    throw new HttpError(400, "This invite has expired. Ask your admin to send a new one.");
  }
  const submittedEmail = typeof data.email === "string" ? data.email.toLowerCase() : undefined;
  if (submittedEmail !== invite.email.toLowerCase()) {
    throw new HttpError(400, "This invite was sent to a different email address.");
  }
  return invite;
}

export const userSignupFields = defineUserSignupFields({
  email: (data) => {
    if (typeof data.email !== "string" || !data.email) {
      throw new HttpError(400, "Email is required.");
    }
    return data.email;
  },
  // Named `organization` (Prisma's relation field), not `org_id` -- Wasp's
  // checked `UserCreateInput` doesn't expose the raw `org_id` scalar as a
  // settable key when a `@relation` exists, only the nested-connect shape.
  organization: async (data) => {
    const invite = await resolveInvite(data);
    if (invite) {
      // Best-effort bookkeeping for the admin's invite list (Build Step 04+);
      // not a security gate -- see resolveInvite's comment.
      await prisma.invite.updateMany({
        where: { id: invite.id },
        data: { status: "accepted" },
      });
      return { connect: { id: invite.org_id } };
    }
    // No invite -> this is the first user of a brand-new Organization
    // (self-serve trial signup, F-19). default_currency/timezone are
    // placeholders the onboarding wizard (Build Step 04) lets them change.
    const org = await prisma.organization.create({
      data: {
        name: `${typeof data.email === "string" ? data.email.split("@")[0] : "New"}'s Organization`,
        default_currency: "INR",
        timezone: "Asia/Kolkata",
      },
    });
    // Build Step 05, F-19: every new org gets a 14-day trial with zero
    // payment method required -- created here, not in a later "activate"
    // step, so there is never a moment where a signed-up org has no
    // Subscription row at all.
    const trialDays = 14;
    await prisma.subscription.create({
      data: {
        org_id: org.id,
        plan: "starter",
        status: "trialing",
        trial_ends_at: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
      },
    });
    return { connect: { id: org.id } };
  },
  role: async (data) => {
    const invite = await resolveInvite(data);
    return invite ? invite.role : "platform_admin";
  },
  // Carries the office the platform_admin picked in inviteUser (src/server/
  // admin/invites.ts) onto the created User -- without this, an invited
  // non-platform_admin would sign up with no office_scope and fail every
  // assertOfficeScope check.
  office_scope: async (data) => {
    const invite = await resolveInvite(data);
    return invite?.office_scope ?? undefined;
  },
});
