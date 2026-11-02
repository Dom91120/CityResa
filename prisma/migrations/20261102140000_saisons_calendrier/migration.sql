-- CreateTable
CREATE TABLE "saison" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periode_calendrier" (
    "id" SERIAL NOT NULL,
    "kind" VARCHAR(12) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "source" VARCHAR(10) NOT NULL DEFAULT 'saisie',
    "zone" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periode_calendrier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saison_label_key" ON "saison"("label");

-- CreateIndex
CREATE INDEX "periode_calendrier_start_date_end_date_idx" ON "periode_calendrier"("start_date", "end_date");
