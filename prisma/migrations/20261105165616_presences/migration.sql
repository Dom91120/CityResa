-- AlterTable
ALTER TABLE "creneau" ADD COLUMN     "presence" VARCHAR(10),
ADD COLUMN     "presence_at" TIMESTAMPTZ,
ADD COLUMN     "presence_by" VARCHAR(160),
ADD COLUMN     "presence_note" VARCHAR(200),
ADD COLUMN     "real_end_at" TIMESTAMPTZ,
ADD COLUMN     "real_start_at" TIMESTAMPTZ;
