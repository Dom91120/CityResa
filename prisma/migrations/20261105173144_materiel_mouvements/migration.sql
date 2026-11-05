-- AlterTable
ALTER TABLE "materiel" ADD COLUMN     "controle_mois" INTEGER,
ADD COLUMN     "dernier_controle_at" TIMESTAMPTZ,
ADD COLUMN     "hors_service" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reservation_materiel" ADD COLUMN     "manquants" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retour_at" TIMESTAMPTZ,
ADD COLUMN     "sortie_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "mouvement_materiel" (
    "id" SERIAL NOT NULL,
    "materiel_id" INTEGER NOT NULL,
    "reservation_id" INTEGER,
    "kind" VARCHAR(12) NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "note" VARCHAR(300),
    "created_by" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvement_materiel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mouvement_materiel_materiel_id_created_at_idx" ON "mouvement_materiel"("materiel_id", "created_at");

-- AddForeignKey
ALTER TABLE "mouvement_materiel" ADD CONSTRAINT "mouvement_materiel_materiel_id_fkey" FOREIGN KEY ("materiel_id") REFERENCES "materiel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvement_materiel" ADD CONSTRAINT "mouvement_materiel_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
