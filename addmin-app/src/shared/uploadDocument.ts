import { config } from "wasp/client";
import { api, handleApiError } from "wasp/client/api";

export type UploadedDocument = {
  docRef: string;
  originalName: string;
  size: number;
};

function uploadApiPrefix(): string | undefined {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return window.location.origin;
  }
  return undefined;
}

/** Upload via Multer API ([Wasp file upload guide](https://wasp.sh/docs/guides/integrations/file-upload)). */
export async function uploadDocument(file: File): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await api.post("/api/upload", {
      prefix: uploadApiPrefix(),
      body: formData,
      throwHttpErrors: false,
    });

    if (!response.ok) {
      const text = await response.text();
      let message = text || "Upload failed.";
      try {
        const json = JSON.parse(text) as { message?: string; error?: string };
        message = json.message ?? json.error ?? message;
      } catch {
        // plain text body
      }
      throw new Error(message);
    }

    return (await response.json()) as UploadedDocument;
  } catch (err) {
    if (err instanceof Error && !(err as { name?: string }).name?.includes("HTTPError")) {
      throw err;
    }
    throw handleApiError(err);
  }
}

export function uploadedFileDownloadUrl(docRef: string): string {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return `${window.location.origin}/api/upload/file?ref=${encodeURIComponent(docRef)}`;
  }
  const base = config.apiUrl.replace(/\/$/, "");
  return `${base}/api/upload/file?ref=${encodeURIComponent(docRef)}`;
}

export function isUploadedDocRef(docRef: string): boolean {
  return docRef.startsWith("uploads/");
}
