-- AlterTable
ALTER TABLE "organisation" ADD COLUMN     "conventionnee" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "campagne" (
    "id" SERIAL NOT NULL,
    "saison_id" INTEGER NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'brouillon',
    "close_date" DATE,
    "consignes" TEXT,
    "created_by" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campagne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campagne_espace" (
    "id" SERIAL NOT NULL,
    "campagne_id" INTEGER NOT NULL,
    "espace_id" INTEGER NOT NULL,

    CONSTRAINT "campagne_espace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voeu" (
    "id" SERIAL NOT NULL,
    "campagne_id" INTEGER NOT NULL,
    "organisation_id" INTEGER NOT NULL,
    "user_id" TEXT,
    "espace_id" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "participants" INTEGER,
    "description" TEXT,
    "weekday" INTEGER NOT NULL,
    "start_min" INTEGER NOT NULL,
    "end_min" INTEGER NOT NULL,
    "hors_vacances" BOOLEAN NOT NULL DEFAULT true,
    "status" VARCHAR(12) NOT NULL DEFAULT 'en_attente',
    "decision_note" TEXT,
    "decided_at" TIMESTAMPTZ,
    "decided_by" VARCHAR(160),
    "notified_at" TIMESTAMPTZ,
    "reservation_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voeu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campagne_espace_campagne_id_espace_id_key" ON "campagne_espace"("campagne_id", "espace_id");

-- CreateIndex
CREATE UNIQUE INDEX "voeu_reservation_id_key" ON "voeu"("reservation_id");

-- CreateIndex
CREATE INDEX "voeu_campagne_id_espace_id_weekday_idx" ON "voeu"("campagne_id", "espace_id", "weekday");

-- CreateIndex
CREATE INDEX "voeu_organisation_id_idx" ON "voeu"("organisation_id");

-- AddForeignKey
ALTER TABLE "campagne" ADD CONSTRAINT "campagne_saison_id_fkey" FOREIGN KEY ("saison_id") REFERENCES "saison"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campagne_espace" ADD CONSTRAINT "campagne_espace_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campagne_espace" ADD CONSTRAINT "campagne_espace_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voeu" ADD CONSTRAINT "voeu_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voeu" ADD CONSTRAINT "voeu_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voeu" ADD CONSTRAINT "voeu_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voeu" ADD CONSTRAINT "voeu_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voeu" ADD CONSTRAINT "voeu_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
