import { useState } from "react";
import { Button } from "./Button";
import { FileUploadField, readTextFile } from "./FileUploadField";

type ImportResult = { row: number; success: boolean; error?: string };

// Build Step 11: the CSV bulk-import UI OfficeListPage.tsx (Step 04) and
// AssetsListPage (Step 08) each built inline. Extracted once a third and
// fourth copy (vendors, utility accounts) were about to duplicate it again.
export function BulkImportPanel({
  header,
  examples,
  onImport,
}: {
  header: string;
  examples: string;
  onImport: (csv: string) => Promise<{ results: ImportResult[] }>;
}) {
  const [csv, setCsv] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  async function handleImport() {
    setImporting(true);
    setResults(null);
    try {
      const { results } = await onImport(csv);
      setResults(results);
    } catch (err) {
      setResults([{ row: 0, success: false, error: err instanceof Error ? err.message : "Import failed." }]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="card mb-6 p-6">
      <p className="mb-2 text-sm text-neutral-600">
        Paste CSV with header row: <code>{header}</code>. Each row is imported independently -- a bad row
        won't block the rest.
      </p>
      <div className="mb-3">
        <FileUploadField
          accept=".csv,text/csv,text/plain"
          hint="Upload a CSV file or paste below"
          file={csvFile}
          onFileChange={(file) => {
            setCsvFile(file);
            if (file) void readTextFile(file).then(setCsv);
          }}
        />
      </div>
      <textarea
        className="mb-3 h-32 w-full rounded-md border border-neutral-300 p-2 font-mono text-sm"
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={`${header}\n${examples}`}
      />
      <Button onClick={handleImport} disabled={importing || !csv.trim()}>
        {importing ? "Importing…" : "Import"}
      </Button>

      {results && (
        <ul className="mt-4 flex flex-col gap-1 text-sm">
          {results.map((r) => (
            <li key={r.row} className={r.success ? "text-primary-700" : "text-red-600"}>
              Row {r.row}: {r.success ? "imported" : `error - ${r.error}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
