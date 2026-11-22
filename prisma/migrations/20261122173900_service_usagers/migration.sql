-- AlterTable
ALTER TABLE "service" ADD COLUMN     "usager_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "usagers_sportifs" BOOLEAN;
