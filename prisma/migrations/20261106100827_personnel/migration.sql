-- AlterTable
ALTER TABLE "creneau" ADD COLUMN     "personnel_id" INTEGER;

-- CreateTable
CREATE TABLE "personnel" (
    "id" SERIAL NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "fonction" VARCHAR(80),
    "phone" VARCHAR(40),
    "email" VARCHAR(160),
    "color" VARCHAR(7),
    "note" VARCHAR(400),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ics_token" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacation" (
    "id" SERIAL NOT NULL,
    "personnel_id" INTEGER NOT NULL,
    "site_id" INTEGER NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "serie_id" VARCHAR(32),
    "note" VARCHAR(200),
    "created_by" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vacation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personnel_ics_token_key" ON "personnel"("ics_token");

-- CreateIndex
CREATE INDEX "personnel_is_active_last_name_idx" ON "personnel"("is_active", "last_name");

-- CreateIndex
CREATE INDEX "vacation_site_id_start_at_idx" ON "vacation"("site_id", "start_at");

-- CreateIndex
CREATE INDEX "vacation_personnel_id_start_at_idx" ON "vacation"("personnel_id", "start_at");

-- CreateIndex
CREATE INDEX "creneau_personnel_id_idx" ON "creneau"("personnel_id");

-- AddForeignKey
ALTER TABLE "vacation" ADD CONSTRAINT "vacation_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation" ADD CONSTRAINT "vacation_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creneau" ADD CONSTRAINT "creneau_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
