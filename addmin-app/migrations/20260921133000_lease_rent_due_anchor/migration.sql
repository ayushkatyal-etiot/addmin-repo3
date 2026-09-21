-- AlterTable
ALTER TABLE "Lease" ADD COLUMN "rent_due_anchor_date" DATE;

UPDATE "Lease" SET "rent_due_anchor_date" = "start_date" WHERE "rent_due_anchor_date" IS NULL;

ALTER TABLE "Lease" ALTER COLUMN "rent_due_anchor_date" SET NOT NULL;
