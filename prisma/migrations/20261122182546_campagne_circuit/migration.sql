-- AlterTable
ALTER TABLE "campagne" ADD COLUMN     "circuit_version_id" INTEGER;

-- AddForeignKey
ALTER TABLE "campagne" ADD CONSTRAINT "campagne_circuit_version_id_fkey" FOREIGN KEY ("circuit_version_id") REFERENCES "circuit_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
