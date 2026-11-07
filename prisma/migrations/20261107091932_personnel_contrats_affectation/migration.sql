-- AlterTable
ALTER TABLE "creneau" ADD COLUMN     "personnel_propose_id" INTEGER,
ADD COLUMN     "propose_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "personnel" ADD COLUMN     "contrat_debut" DATE,
ADD COLUMN     "contrat_fin" DATE,
ADD COLUMN     "contrat_type_id" INTEGER,
ADD COLUMN     "heures_hebdo" DECIMAL(4,1),
ADD COLUMN     "horaires" JSONB,
ADD COLUMN     "quotite" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "site" ADD COLUMN     "affectation_auto" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "personnel_site" (
    "personnel_id" INTEGER NOT NULL,
    "site_id" INTEGER NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "personnel_site_pkey" PRIMARY KEY ("personnel_id","site_id")
);

-- CreateTable
CREATE TABLE "absence" (
    "id" SERIAL NOT NULL,
    "personnel_id" INTEGER NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "motif_id" INTEGER,
    "note" VARCHAR(200),
    "created_by" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "absence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "absence_personnel_id_start_at_idx" ON "absence"("personnel_id", "start_at");

-- CreateIndex
CREATE INDEX "creneau_personnel_propose_id_idx" ON "creneau"("personnel_propose_id");

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_contrat_type_id_fkey" FOREIGN KEY ("contrat_type_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_site" ADD CONSTRAINT "personnel_site_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_site" ADD CONSTRAINT "personnel_site_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence" ADD CONSTRAINT "absence_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence" ADD CONSTRAINT "absence_motif_id_fkey" FOREIGN KEY ("motif_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creneau" ADD CONSTRAINT "creneau_personnel_propose_id_fkey" FOREIGN KEY ("personnel_propose_id") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
