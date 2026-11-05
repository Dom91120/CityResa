-- AlterTable
ALTER TABLE "espace" ADD COLUMN     "valorisation_horaire" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "valorisation" (
    "id" SERIAL NOT NULL,
    "organisation_id" INTEGER NOT NULL,
    "exercice" INTEGER NOT NULL,
    "nb_dossiers" INTEGER NOT NULL DEFAULT 0,
    "heures" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valeur_reference" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "redevance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avantage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subventions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "figee_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "figee_par" VARCHAR(160),
    "document_id" INTEGER,

    CONSTRAINT "valorisation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "valorisation_exercice_idx" ON "valorisation"("exercice");

-- CreateIndex
CREATE UNIQUE INDEX "valorisation_organisation_id_exercice_key" ON "valorisation"("organisation_id", "exercice");

-- AddForeignKey
ALTER TABLE "valorisation" ADD CONSTRAINT "valorisation_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valorisation" ADD CONSTRAINT "valorisation_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
