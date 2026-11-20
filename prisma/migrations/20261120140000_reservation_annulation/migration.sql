-- Annulation d'un dossier : sa date et son auteur, jusqu'ici absents (seul le motif était gardé,
-- et la fiche affichait à tort la date de la décision d'acceptation).
ALTER TABLE "reservation"
  ADD COLUMN "cancelled_at" TIMESTAMPTZ,
  ADD COLUMN "cancelled_by" VARCHAR(160);

-- Reprise des dossiers déjà annulés (y compris archivés depuis) : la dernière ligne « Annulée »
-- de leur historique. Un dossier ne quitte le statut « Annulée » que pour être archivé.
UPDATE "reservation" r
SET "cancelled_at" = h."performed_at", "cancelled_by" = h."performed_by"
FROM (
  SELECT DISTINCT ON ("reservation_id") "reservation_id", "performed_at", "performed_by"
  FROM "reservation_history"
  WHERE "action" = 'Annulée'
  ORDER BY "reservation_id", "performed_at" DESC
) h
WHERE h."reservation_id" = r."id" AND r."status" IN ('annulee', 'archivee');

-- Reprise des dossiers refusés : la décision est celle du refus, même quand le dossier avait
-- d'abord été accepté puis repris en traitement.
UPDATE "reservation" r
SET "decision_at" = h."performed_at", "decision_by" = h."performed_by"
FROM (
  SELECT DISTINCT ON ("reservation_id") "reservation_id", "performed_at", "performed_by"
  FROM "reservation_history"
  WHERE "action" = 'Refusée'
  ORDER BY "reservation_id", "performed_at" DESC
) h
WHERE h."reservation_id" = r."id" AND r."status" = 'refusee';
