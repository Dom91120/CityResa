-- AlterTable
ALTER TABLE "reservation" ADD COLUMN     "option_expires_at" TIMESTAMPTZ,
ADD COLUMN     "option_relance_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "liste_attente" (
    "id" SERIAL NOT NULL,
    "espace_id" INTEGER NOT NULL,
    "organisation_id" INTEGER,
    "user_id" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "title" VARCHAR(160),
    "notified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liste_attente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "liste_attente_espace_id_start_at_idx" ON "liste_attente"("espace_id", "start_at");

-- CreateIndex
CREATE INDEX "liste_attente_user_id_idx" ON "liste_attente"("user_id");

-- AddForeignKey
ALTER TABLE "liste_attente" ADD CONSTRAINT "liste_attente_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liste_attente" ADD CONSTRAINT "liste_attente_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liste_attente" ADD CONSTRAINT "liste_attente_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
