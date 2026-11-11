-- AlterTable
ALTER TABLE "espace" ADD COLUMN     "secteur" VARCHAR(8) NOT NULL DEFAULT 'salle';

-- Reprise : les espaces dont la nature est sportive passent en « sport » (à corriger au cas par cas).
UPDATE "espace" SET "secteur" = 'sport'
WHERE "nature_id" IN (
  SELECT "id" FROM "referential"
  WHERE "kind" = 'espace_nature'
    AND "label" IN ('Gymnase', 'Stade / terrain', 'Piscine', 'Dojo')
);
