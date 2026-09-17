import crypto from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "wasp/server";
import type { PlatformLogin, PlatformLogout, PlatformMe } from "wasp/server/api";
import { verifyMfaCode } from "../auth/mfa";

// PlatformOperator never shares a table, a session cookie, or an authz code
// path with the customer User -- per 04-architecture.md's F-20 and Build
// Step 03. Typed Wasp query/action `context.user` is always the customer
// User (it comes from Wasp's own auth middleware), so this can't reuse it --
// every /platform/* endpoint is a raw `api` route that checks the cookie
// below itself, never a typed operation.

const COOKIE_NAME = "addmin_platform_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h, shorter than the customer app's MFA window

function getSessionSecret(): string {
  const secret = process.env.PLATFORM_SESSION_SECRET ?? process.env.DATABASE_URL;
  if (!secret) throw new Error("PLATFORM_SESSION_SECRET must be set.");
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

function issueSessionToken(platformOperatorId: string): string {
  const payload = `${platformOperatorId}.${Date.now() + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [operatorId, expiresAtStr, signature] = parts;
  const payload = `${operatorId}.${expiresAtStr}`;
  if (sign(payload) !== signature) return null;
  if (Date.now() > Number(expiresAtStr)) return null;
  return operatorId;
}

/** Use at the top of every other /platform/* api route. */
export async function requirePlatformOperator(req: Request) {
  const operatorId = verifySessionToken(req.cookies?.[COOKIE_NAME]);
  if (!operatorId) {
    throw Object.assign(new Error("Not authenticated as a Platform Operator."), { statusCode: 401 });
  }
  const operator = await prisma.platformOperator.findUnique({ where: { id: operatorId } });
  if (!operator) {
    throw Object.assign(new Error("Platform Operator not found."), { statusCode: 401 });
  }
  return operator;
}

function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString("hex"));
    });
  });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const candidateHash = await hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(hash));
}

export async function createPasswordHash(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await hashPassword(password, salt);
  return `${salt}:${hash}`;
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export const platformLogin: PlatformLogin = async (req, res) => {
  const { email, password, code } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ message: "Email and password are required." });
    return;
  }

  const operator = await prisma.platformOperator.findUnique({ where: { email } });
  // Constant-shape response whether the email exists or not -- don't leak
  // account existence via timing/response differences.
  const passwordOk = operator ? await verifyPassword(password, operator.password_hash) : false;
  if (!operator || !passwordOk) {
    res.status(401).json({ message: "Invalid email or password." });
    return;
  }

  if (operator.mfa_enabled) {
    if (
      typeof code !== "string" ||
      !operator.mfa_secret ||
      !(await verifyMfaCode(operator.mfa_secret, code))
    ) {
      res.status(401).json({ message: "Invalid or missing MFA code." });
      return;
    }
  }

  const token = issueSessionToken(operator.id);
  setSessionCookie(res, token);
  res.json({ email: operator.email });
};

export const platformLogout: PlatformLogout = async (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ success: true });
};

export const platformMe: PlatformMe = async (req, res) => {
  try {
    const operator = await requirePlatformOperator(req);
    res.json({ email: operator.email });
  } catch (e) {
    res.status(401).json({ message: "Not authenticated." });
  }
};
