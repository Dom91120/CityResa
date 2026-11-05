-- AlterTable
ALTER TABLE "reservation" ADD COLUMN     "gratuit_motif" VARCHAR(300);

-- AlterTable
ALTER TABLE "tarif" ADD COLUMN     "deliberation" VARCHAR(120),
ADD COLUMN     "valid_from" DATE;
