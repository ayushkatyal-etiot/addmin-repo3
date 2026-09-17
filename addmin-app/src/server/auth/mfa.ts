import QRCode from "qrcode";
import { generateBase32Secret, getOtpAuthUri, verifyTotp } from "./totp";

// Wasp's built-in auth has no MFA. This module owns TOTP entirely, per
// 04-architecture.md's "Custom + MFA (TOTP)" decision and Build Step 03.
// TOTP itself (RFC 6238) is hand-rolled in ./totp.ts using only Node's
// stdlib crypto -- see that file's header comment for why (otplib v13 broke
// under this project's rollup-bundled server).

// Roles that cannot use the app without MFA enabled, per 04-architecture.md's
// F-01 acceptance criteria. Since Wasp's signup is atomic (no way to block
// account creation on "enroll MFA first"), this is enforced post-signup by
// authz.ts instead: an admin-tier user who hasn't enrolled yet is blocked
// from every operation until they do, same as an unverified-this-window one.
export const MFA_REQUIRED_ROLES = ["platform_admin", "payment_authorizer"] as const;

export function generateMfaSecret(): string {
  return generateBase32Secret();
}

export function getMfaOtpAuthUri(secret: string, accountLabel: string): string {
  return getOtpAuthUri(secret, accountLabel);
}

export function getMfaQrCodeDataUrl(otpAuthUri: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUri);
}

export async function verifyMfaCode(secret: string, code: string): Promise<boolean> {
  return verifyTotp(secret, code);
}

// --- "MFA verified" window ---------------------------------------------
//
// Wasp's built-in login is atomic (password -> session issued immediately) --
// there's no hook to withhold the session until a second factor is checked,
// and typed query/action `context` only ever exposes `context.user` (no raw
// request/cookies) so a cookie-based second factor isn't reachable from
// authz checks. Instead, `User.mfa_verified_until` / `PlatformOperator.
// mfa_verified_until` (schema.prisma) is set by `verifyMfaCode` succeeding
// and read fresh on every request via `context.user`. Every authz check in
// src/server/shared/authz.ts requires this window to still be open for any
// user with mfa_enabled -- so a password-only session can authenticate but
// cannot pass a single authorization check until MFA is verified.
export const MFA_VERIFIED_WINDOW_MS = 12 * 60 * 60 * 1000; // 12h

export function mfaVerifiedUntil(): Date {
  return new Date(Date.now() + MFA_VERIFIED_WINDOW_MS);
}

export function isMfaCurrentlyVerified(mfaVerifiedUntilValue: Date | null): boolean {
  return !!mfaVerifiedUntilValue && mfaVerifiedUntilValue.getTime() > Date.now();
}
