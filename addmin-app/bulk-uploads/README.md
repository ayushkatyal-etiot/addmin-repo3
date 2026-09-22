# Bulk uploads — sample files for demo and testing

Use these files with the matching AddMin actions in the app. CSV bulk imports accept the same columns shown on each screen (Offices list → **Bulk import**, Assets → **Bulk import**). Document uploads go through **File upload** (`POST /api/upload`) and are then attached via the module action noted below.

| File | Action / API | Where in the app |
|------|----------------|-------------------|
| `bulkImportOffices.csv` | `bulkImportOffices` | **Offices** → Bulk import (CSV) |
| `bulkImportAssets.csv` | `bulkImportAssets` | **Assets** → Bulk import (CSV) |
| `uploadDocumentFile.pdf` | `uploadDocumentFile` (`/api/upload`) | Generic upload; used before compliance / evidence actions |
| `uploadComplianceDocument.pdf` | `uploadComplianceDocument` (after upload) | **Compliance** → upload certificate on an item |
| `uploadWorkOrderEvidence.jpg` | `uploadWorkOrderEvidence` (after upload) | **Maintenance** → work order → evidence |

## CSV notes

- **Offices:** Header must be `name,address,office_type,ownership_type,code`. `code` is optional (auto-generated if blank). `office_type`: `head_office`, `regional`, `branch`, `warehouse`, `other`. `ownership_type`: `owned`, `rented`. Duplicate codes in the same org fail that row only.
- **Assets:** Header must be `office_code,category,serial_no,warranty_end`. `office_code` must match an existing office (e.g. seed data uses `DEMO-HQ`). `warranty_end` is optional (`YYYY-MM-DD`).

## Seed data

After `wasp db seed`, log in with **`abc@test.com`** / **`12345678`**. Import assets against office code **`DEMO-HQ`**. Import offices with **new** codes (as in `bulkImportOffices.csv`) so rows are not rejected as duplicates.
