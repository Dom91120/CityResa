-- CreateTable
CREATE TABLE "dossier_etape_reponse" (
    "id" SERIAL NOT NULL,
    "etape_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" VARCHAR(160) NOT NULL,
    "accord" BOOLEAN NOT NULL,
    "commentaire" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossier_etape_reponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dossier_etape_reponse_etape_id_user_id_key" ON "dossier_etape_reponse"("etape_id", "user_id");

-- AddForeignKey
ALTER TABLE "dossier_etape_reponse" ADD CONSTRAINT "dossier_etape_reponse_etape_id_fkey" FOREIGN KEY ("etape_id") REFERENCES "dossier_etape"("id") ON DELETE CASCADE ON UPDATE CASCADE;
