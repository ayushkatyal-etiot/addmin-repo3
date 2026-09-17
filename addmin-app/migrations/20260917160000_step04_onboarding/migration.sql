-- Build Step 04 (planmysaas-blueprint/08-build-playbook.md): onboarding core.
-- Adds Office.code, required by F-03's "office code is unique within an
-- organization" acceptance criterion (used for CSV bulk-import row dedup).
-- Nullable-then-backfill-then-NOT-NULL sequence so the existing seeded
-- office row (Build Step 02's seed.ts) doesn't violate the new constraint.

-- AlterTable
ALTER TABLE "Office" ADD COLUMN "code" TEXT;

-- Backfill: deterministic code derived from the row's own id so this is
-- idempotent and collision-free without needing app-level logic here.
UPDATE "Office" SET "code" = 'OFFICE-' || UPPER(SUBSTRING(REPLACE("id", '-', ''), 1, 8))
WHERE "code" IS NULL;

-- AlterTable
ALTER TABLE "Office" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Office_org_id_code_key" ON "Office"("org_id", "code");
