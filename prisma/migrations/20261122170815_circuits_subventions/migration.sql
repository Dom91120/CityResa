-- AlterTable
ALTER TABLE "subvention" ADD COLUMN     "circuit_version_id" INTEGER,
ADD COLUMN     "service_id" INTEGER;

-- AddForeignKey
ALTER TABLE "subvention" ADD CONSTRAINT "subvention_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subvention" ADD CONSTRAINT "subvention_circuit_version_id_fkey" FOREIGN KEY ("circuit_version_id") REFERENCES "circuit_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
