import { HttpError } from "wasp/server";
import type {
  EnrollMfa,
  ConfirmMfaEnrollment,
  VerifyMfaLogin,
  GetMfaStatus,
  GetMyUserContext,
} from "wasp/server/operations";
import { userFromSession } from "../shared/authz";
import {
  generateMfaSecret,
  getMfaOtpAuthUri,
  getMfaQrCodeDataUrl,
  verifyMfaCode,
  mfaVerifiedUntil,
  isMfaCurrentlyVerified,
  MFA_REQUIRED_ROLES,
} from "./mfa";

export const getMfaStatus: GetMfaStatus<void, { mfaEnabled: boolean; mfaRequired: boolean; mfaVerifiedThisWindow: boolean }> =
  async (_args, context) => {
    if (!context.user) throw new HttpError(401);
    const user = await userFromSession(context.user, context.entities);
    return {
      mfaEnabled: user.mfa_enabled,
      mfaRequired: !!user.role && (MFA_REQUIRED_ROLES as readonly string[]).includes(user.role),
      mfaVerifiedThisWindow: isMfaCurrentlyVerified(user.mfa_verified_until),
    };
  };

/** UI permissions from the DB user row — useAuth() alone often lacks role/org_id. */
export const getMyUserContext: GetMyUserContext<
  void,
  { role: string | null; canManageVendors: boolean }
> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  const user = await userFromSession(context.user, context.entities);
  const role = user.role ?? null;
  return {
    role,
    canManageVendors: role === "platform_admin" || role === "vendor_manager",
  };
};

// Step 1 of enrollment: generate a secret + QR code. Not yet persisted as
// mfa_enabled -- that only happens once the user proves they can generate a
// valid code from it (confirmMfaEnrollment), so a broken scanner never locks
// someone out of their own signup.
export const enrollMfa: EnrollMfa<void, { secret: string; qrCodeDataUrl: string }> = async (
  _args,
  context,
) => {
  if (!context.user) throw new HttpError(401);

  const secret = generateMfaSecret();
  const otpAuthUri = getMfaOtpAuthUri(secret, context.user.email ?? context.user.id);
  const qrCodeDataUrl = await getMfaQrCodeDataUrl(otpAuthUri);

  // Stored now (not just returned) so confirmMfaEnrollment can verify against
  // it without trusting the client to send the secret back.
  await context.entities.User.update({
    where: { id: context.user.id },
    data: { mfa_secret: secret },
  });

  return { secret, qrCodeDataUrl };
};

type ConfirmMfaEnrollmentInput = { code: string };

export const confirmMfaEnrollment: ConfirmMfaEnrollment<ConfirmMfaEnrollmentInput, { success: true }> = async (
  { code },
  context,
) => {
  if (!context.user) throw new HttpError(401);
  const user = await userFromSession(context.user, context.entities);
  if (!user.mfa_secret) {
    throw new HttpError(400, "Call enrollMfa first.");
  }
  if (!(await verifyMfaCode(user.mfa_secret, code))) {
    throw new HttpError(400, "Invalid or expired code.");
  }

  await context.entities.User.update({
    where: { id: user.id },
    data: { mfa_enabled: true, mfa_verified_until: mfaVerifiedUntil() },
  });

  return { success: true };
};

type VerifyMfaLoginInput = { code: string };

// Fails closed by design: if this never gets called successfully, every
// assertRole/assertOfficeScope check in authz.ts keeps rejecting the
// password-authenticated session (see mfa.ts's file comment on why this
// can't be enforced at Wasp's login step itself).
export const verifyMfaLogin: VerifyMfaLogin<VerifyMfaLoginInput, { success: true }> = async (
  { code },
  context,
) => {
  if (!context.user) throw new HttpError(401);
  const user = await userFromSession(context.user, context.entities);
  if (!user.mfa_enabled || !user.mfa_secret) {
    throw new HttpError(400, "MFA is not enabled for this account.");
  }
  if (!(await verifyMfaCode(user.mfa_secret, code))) {
    throw new HttpError(401, "Invalid or expired code.");
  }

  await context.entities.User.update({
    where: { id: user.id },
    data: { mfa_verified_until: mfaVerifiedUntil() },
  });

  return { success: true };
};
