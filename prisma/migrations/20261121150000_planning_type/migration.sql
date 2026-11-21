-- Personnel de service : planning type par type de contrat, et origine des horaires de chaque
-- personne (planning type du contrat, horaires personnalisés, ou pas d'horaires fixes).
CREATE TABLE "planning_type" (
  "contrat_type_id" INTEGER NOT NULL,
  "horaires" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" VARCHAR(160),

  CONSTRAINT "planning_type_pkey" PRIMARY KEY ("contrat_type_id")
);

ALTER TABLE "planning_type"
  ADD CONSTRAINT "planning_type_contrat_type_id_fkey" FOREIGN KEY ("contrat_type_id") REFERENCES "referential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personnel"
  ADD COLUMN "horaires_mode" VARCHAR(8) NOT NULL DEFAULT 'contrat';

-- Reprise de l'existant, sans changer la disponibilité de personne : un cycle déjà saisi reste
-- des horaires personnalisés, son absence reste « pas d'horaires fixes ».
UPDATE "personnel"
SET "horaires_mode" = CASE WHEN "horaires" IS NULL THEN 'libre' ELSE 'perso' END;
