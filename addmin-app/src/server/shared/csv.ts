// Naive comma-split CSV parser -- fine for the simple, quote-free bulk
// import templates this app hands admins (offices, assets); reused wherever
// a "CSV string in, per-row error report out" bulk-import action is needed
// (see organization/office.ts's bulkImportOffices for the original, asset.ts
// for the second user).
export function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 1) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    header.forEach((key, idx) => {
      row[key] = cells[idx] ?? "";
    });
    return row;
  });
}
