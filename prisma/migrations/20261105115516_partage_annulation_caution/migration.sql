-- AlterTable
ALTER TABLE "document" ADD COLUMN     "etat_des_lieux_id" INTEGER;

-- AlterTable
ALTER TABLE "espace" ADD COLUMN     "capacite_simultanee" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "reservation" ADD COLUMN     "caution_cloturee_at" TIMESTAMPTZ,
ADD COLUMN     "caution_decidee_par" VARCHAR(160),
ADD COLUMN     "caution_encaissee_at" TIMESTAMPTZ,
ADD COLUMN     "caution_motif" TEXT,
ADD COLUMN     "caution_retenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "caution_status" VARCHAR(20) NOT NULL DEFAULT 'aucune',
ADD COLUMN     "caution_validee_par" VARCHAR(160);

-- CreateTable
CREATE TABLE "etat_des_lieux" (
    "id" SERIAL NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "kind" VARCHAR(8) NOT NULL,
    "done_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agent" VARCHAR(160) NOT NULL,
    "observations" TEXT,
    "degats" BOOLEAN NOT NULL DEFAULT false,
    "signataire" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etat_des_lieux_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "etat_des_lieux_reservation_id_kind_key" ON "etat_des_lieux"("reservation_id", "kind");

-- AddForeignKey
ALTER TABLE "etat_des_lieux" ADD CONSTRAINT "etat_des_lieux_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_etat_des_lieux_id_fkey" FOREIGN KEY ("etat_des_lieux_id") REFERENCES "etat_des_lieux"("id") ON DELETE CASCADE ON UPDATE CASCADE;
