-- AlterTable
ALTER TABLE "reservation" ADD COLUMN     "purge_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "anonymise_at" TIMESTAMPTZ,
ADD COLUMN     "inactivite_preavis_at" TIMESTAMPTZ;
