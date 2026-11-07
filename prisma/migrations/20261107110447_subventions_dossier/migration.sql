-- AlterTable
ALTER TABLE "organisation" ADD COLUMN     "sportive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "subvention" ADD COLUMN     "campagne_id" INTEGER,
ADD COLUMN     "dossier" JSONB,
ADD COLUMN     "dossier_document_id" INTEGER,
ADD COLUMN     "nature" VARCHAR(16) NOT NULL DEFAULT 'renouvellement',
ADD COLUMN     "recu_at" TIMESTAMPTZ,
ADD COLUMN     "secteur_id" INTEGER,
ADD COLUMN     "signature_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "signature_code_hash" VARCHAR(120),
ADD COLUMN     "signature_expires_at" TIMESTAMPTZ,
ADD COLUMN     "signature_sent_at" TIMESTAMPTZ,
ADD COLUMN     "signe_at" TIMESTAMPTZ,
ADD COLUMN     "signe_channel" VARCHAR(8),
ADD COLUMN     "signe_ip" VARCHAR(64),
ADD COLUMN     "signe_mandataire" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signe_nom" VARCHAR(160),
ADD COLUMN     "signe_qualite" VARCHAR(80),
ADD COLUMN     "verse_at" DATE;

-- CreateTable
CREATE TABLE "campagne_subvention" (
    "id" SERIAL NOT NULL,
    "exercice" INTEGER NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "ouverture_date" DATE NOT NULL,
    "cloture_date" DATE NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'brouillon',
    "consignes" TEXT,
    "created_by" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campagne_subvention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subvention_history" (
    "id" SERIAL NOT NULL,
    "subvention_id" INTEGER NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "comment" TEXT,
    "performed_by" VARCHAR(160),
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subvention_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campagne_subvention_exercice_key" ON "campagne_subvention"("exercice");

-- CreateIndex
CREATE INDEX "subvention_history_subvention_id_idx" ON "subvention_history"("subvention_id");

-- CreateIndex
CREATE INDEX "subvention_campagne_id_idx" ON "subvention"("campagne_id");

-- AddForeignKey
ALTER TABLE "subvention" ADD CONSTRAINT "subvention_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagne_subvention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subvention" ADD CONSTRAINT "subvention_dossier_document_id_fkey" FOREIGN KEY ("dossier_document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subvention" ADD CONSTRAINT "subvention_secteur_id_fkey" FOREIGN KEY ("secteur_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subvention_history" ADD CONSTRAINT "subvention_history_subvention_id_fkey" FOREIGN KEY ("subvention_id") REFERENCES "subvention"("id") ON DELETE CASCADE ON UPDATE CASCADE;
