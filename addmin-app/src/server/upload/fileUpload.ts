import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { HttpError, config } from "wasp/server";
import type { MiddlewareConfigFn } from "wasp/server/middleware";
import type { DownloadUploadedFile, UploadDocumentFile } from "wasp/server/api";
import { userFromSession } from "../shared/authz";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const TMP_DIR = path.join(UPLOAD_ROOT, "_tmp");
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = ["image/", "text/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/csv",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".csv", ".txt"]);

function isAllowedUpload(file: Express.Multer.File): boolean {
  if (ALLOWED_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p))) return true;
  if (ALLOWED_MIME_EXACT.has(file.mimetype)) return true;
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype === "application/octet-stream" && ALLOWED_EXTENSIONS.has(ext)) return true;
  return false;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

ensureDir(TMP_DIR);

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isAllowedUpload(file)) cb(null, true);
    else cb(new Error("File type is not allowed."));
  },
});

function uploadCorsMiddleware() {
  return cors({
    origin: config.isDevelopment ? true : config.frontendUrl,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });
}

function applyUploadCors(configMap: Parameters<MiddlewareConfigFn>[0]) {
  configMap.set("cors", uploadCorsMiddleware());
}

function multerSingle(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "OPTIONS") {
      next();
      return;
    }
    upload.single(fieldName)(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ message: err.message });
        return;
      }
      if (err instanceof Error) {
        res.status(400).json({ message: err.message });
        return;
      }
      next();
    });
  };
}

export const configureFileUploadMiddleware: MiddlewareConfigFn = (config) => {
  // Multipart must be parsed by Multer only — global express.json() breaks uploads.
  config.delete("express.json");
  config.delete("express.urlencoded");
  applyUploadCors(config);
  config.set("multer", multerSingle("file"));
  return config;
};

export const configureUploadDownloadMiddleware: MiddlewareConfigFn = (config) => {
  applyUploadCors(config);
  return config;
};

function safeBasename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 120) || "upload";
}

function orgDir(orgId: string): string {
  const dir = path.join(UPLOAD_ROOT, orgId);
  ensureDir(dir);
  return dir;
}

function resolveStoredPath(docRef: string): string | null {
  if (!docRef.startsWith("uploads/")) return null;
  const relative = docRef.slice("uploads/".length);
  if (!relative || relative.includes("..")) return null;
  const absolute = path.join(process.cwd(), "uploads", relative);
  const normalizedRoot = path.join(process.cwd(), "uploads") + path.sep;
  if (!absolute.startsWith(normalizedRoot)) return null;
  return absolute;
}

function assertCanAccessDocRef(userOrgId: string | null | undefined, docRef: string, role: string | null | undefined) {
  if (role === "platform_admin") return;
  const parts = docRef.split("/");
  const orgInPath = parts[1];
  if (!userOrgId || !orgInPath || orgInPath !== userOrgId) {
    throw new HttpError(403, "You do not have access to this file.");
  }
}

/** POST /api/upload — Multer field name `file`. Returns a stable `docRef` for existing actions. */
export const uploadDocumentFile: UploadDocumentFile = async (req: Request, res: Response, context) => {
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const user = await userFromSession(context.user, context.entities);
  if (!user.org_id) {
    throw new HttpError(400, "You must belong to an organization first.");
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }

  const storedName = `${crypto.randomUUID()}-${safeBasename(file.originalname)}`;
  const targetDir = orgDir(user.org_id);
  const targetPath = path.join(targetDir, storedName);

  try {
    fs.renameSync(file.path, targetPath);
  } catch {
    fs.copyFileSync(file.path, targetPath);
    fs.unlinkSync(file.path);
  }

  const docRef = `uploads/${user.org_id}/${storedName}`;

  await context.entities.AuditLog.create({
    data: {
      org_id: user.org_id,
      actor_user_id: user.id,
      entity_type: "FileUpload",
      entity_id: storedName,
      action: "uploaded",
      after_value: { doc_ref: docRef, original_name: file.originalname, size: file.size },
    },
  });

  res.json({
    docRef,
    originalName: file.originalname,
    size: file.size,
  });
};

/** GET /api/upload/file?ref=uploads/{orgId}/{name} */
export const downloadUploadedFile: DownloadUploadedFile = async (req: Request, res: Response, context) => {
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  if (req.method !== "GET") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const user = await userFromSession(context.user, context.entities);
  const ref = typeof req.query.ref === "string" ? req.query.ref.trim() : "";
  if (!ref) {
    res.status(400).send("Missing ref.");
    return;
  }

  assertCanAccessDocRef(user.org_id, ref, user.role ?? null);
  const absolute = resolveStoredPath(ref);
  if (!absolute || !fs.existsSync(absolute)) {
    res.status(404).send("File not found.");
    return;
  }

  res.sendFile(absolute);
};
