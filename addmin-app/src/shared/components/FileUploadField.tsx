import { useId } from "react";
import { cn } from "cn";

const DEFAULT_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt,application/pdf,image/*,text/csv,text/plain";

type FileUploadFieldProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
  hint?: string;
  /** Set to `false` to omit helper text (e.g. when the parent supplies layout). */
  showHint?: boolean;
  id?: string;
};

export function FileUploadField({
  file,
  onFileChange,
  accept = DEFAULT_ACCEPT,
  disabled,
  className,
  hint = "PDF, images, or CSV up to 10 MB",
  showHint = true,
  id: idProp,
}: FileUploadFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-xs",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="shrink-0 rounded-md bg-neutral-50 px-2 py-0.5 text-xs font-semibold text-neutral-700">
          Choose file
        </span>
        <span className="min-w-0 flex-1 truncate text-neutral-600">{file ? file.name : "No file selected"}</span>
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      {showHint && hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

/** Read a CSV/text file in the browser (bulk import). */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsText(file);
  });
}
