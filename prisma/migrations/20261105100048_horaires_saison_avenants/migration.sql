-- CreateTable
CREATE TABLE "horaires_saison" (
    "id" SERIAL NOT NULL,
    "espace_id" INTEGER NOT NULL,
    "saison_id" INTEGER NOT NULL,
    "open_hours" JSONB NOT NULL,

    CONSTRAINT "horaires_saison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avenant" (
    "id" SERIAL NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "objet" TEXT NOT NULL,
    "document_id" INTEGER,
    "signature_channel" VARCHAR(10),
    "signature_sent_at" TIMESTAMPTZ,
    "signature_code_hash" VARCHAR(128),
    "signature_expires_at" TIMESTAMPTZ,
    "signature_attempts" INTEGER NOT NULL DEFAULT 0,
    "signed_at" TIMESTAMPTZ,
    "signer_name" VARCHAR(160),
    "signer_ip" VARCHAR(64),
    "created_by" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "horaires_saison_espace_id_saison_id_key" ON "horaires_saison"("espace_id", "saison_id");

-- CreateIndex
CREATE UNIQUE INDEX "avenant_reservation_id_numero_key" ON "avenant"("reservation_id", "numero");

-- AddForeignKey
ALTER TABLE "horaires_saison" ADD CONSTRAINT "horaires_saison_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horaires_saison" ADD CONSTRAINT "horaires_saison_saison_id_fkey" FOREIGN KEY ("saison_id") REFERENCES "saison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avenant" ADD CONSTRAINT "avenant_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avenant" ADD CONSTRAINT "avenant_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
