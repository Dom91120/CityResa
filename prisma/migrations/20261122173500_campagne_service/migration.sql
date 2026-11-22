-- AlterTable
ALTER TABLE "campagne" ADD COLUMN     "service_id" INTEGER;

-- AddForeignKey
ALTER TABLE "campagne" ADD CONSTRAINT "campagne_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
