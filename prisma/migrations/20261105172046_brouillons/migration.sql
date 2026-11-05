-- CreateTable
CREATE TABLE "brouillon_demande" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "espace_id" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brouillon_demande_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brouillon_demande_user_id_idx" ON "brouillon_demande"("user_id");

-- AddForeignKey
ALTER TABLE "brouillon_demande" ADD CONSTRAINT "brouillon_demande_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brouillon_demande" ADD CONSTRAINT "brouillon_demande_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
