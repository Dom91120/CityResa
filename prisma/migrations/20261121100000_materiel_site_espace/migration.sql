-- Matériel : rattachement facultatif à un site ou à un espace. Sans rattachement, le matériel
-- reste un stock commun proposé pour tous les espaces (comportement inchangé pour l'existant).
ALTER TABLE "materiel"
  ADD COLUMN "site_id" INTEGER,
  ADD COLUMN "espace_id" INTEGER;

ALTER TABLE "materiel"
  ADD CONSTRAINT "materiel_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "materiel"
  ADD CONSTRAINT "materiel_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
