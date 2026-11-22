-- AlterTable
ALTER TABLE "reservation" ADD COLUMN     "circuit_version_id" INTEGER,
ADD COLUMN     "service_id" INTEGER;

-- CreateTable
CREATE TABLE "service" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(300),
    "email" VARCHAR(160),
    "phone" VARCHAR(40),
    "responsable_id" TEXT,
    "suppleant_id" INTEGER,
    "suppleance_du" DATE,
    "suppleance_au" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_membre" (
    "service_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "service_membre_pkey" PRIMARY KEY ("service_id","user_id")
);

-- CreateTable
CREATE TABLE "delegation" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "user_id" TEXT,
    "suppleant_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuit" (
    "id" SERIAL NOT NULL,
    "objet" VARCHAR(20) NOT NULL DEFAULT 'reservation',
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(400),
    "position" INTEGER NOT NULL DEFAULT 0,
    "par_defaut" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circuit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuit_version" (
    "id" SERIAL NOT NULL,
    "circuit_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'brouillon',
    "definition" JSONB NOT NULL,
    "note" VARCHAR(300),
    "created_by" VARCHAR(160),
    "publie_at" TIMESTAMPTZ,
    "publie_par" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circuit_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_etape" (
    "id" SERIAL NOT NULL,
    "objet" VARCHAR(20) NOT NULL,
    "objet_id" INTEGER NOT NULL,
    "circuit_version_id" INTEGER NOT NULL,
    "cle" VARCHAR(40) NOT NULL,
    "libelle" VARCHAR(120) NOT NULL,
    "nature" VARCHAR(12) NOT NULL,
    "intervenant" JSONB NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'ouverte',
    "contexte" TEXT,
    "ouvert_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ouvert_par" VARCHAR(160),
    "echeance_at" TIMESTAMPTZ,
    "clos_at" TIMESTAMPTZ,
    "clos_par" VARCHAR(160),
    "commentaire" TEXT,

    CONSTRAINT "dossier_etape_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_name_key" ON "service"("name");

-- CreateIndex
CREATE INDEX "service_membre_user_id_idx" ON "service_membre"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "delegation_label_key" ON "delegation"("label");

-- CreateIndex
CREATE INDEX "circuit_objet_position_idx" ON "circuit"("objet", "position");

-- CreateIndex
CREATE INDEX "circuit_version_circuit_id_status_idx" ON "circuit_version"("circuit_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "circuit_version_circuit_id_numero_key" ON "circuit_version"("circuit_id", "numero");

-- CreateIndex
CREATE INDEX "dossier_etape_objet_objet_id_idx" ON "dossier_etape"("objet", "objet_id");

-- CreateIndex
CREATE INDEX "dossier_etape_status_idx" ON "dossier_etape"("status");

-- CreateIndex
CREATE INDEX "reservation_service_id_idx" ON "reservation"("service_id");

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_circuit_version_id_fkey" FOREIGN KEY ("circuit_version_id") REFERENCES "circuit_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_suppleant_id_fkey" FOREIGN KEY ("suppleant_id") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_membre" ADD CONSTRAINT "service_membre_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_membre" ADD CONSTRAINT "service_membre_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation" ADD CONSTRAINT "delegation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation" ADD CONSTRAINT "delegation_suppleant_id_fkey" FOREIGN KEY ("suppleant_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_version" ADD CONSTRAINT "circuit_version_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_etape" ADD CONSTRAINT "dossier_etape_circuit_version_id_fkey" FOREIGN KEY ("circuit_version_id") REFERENCES "circuit_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
