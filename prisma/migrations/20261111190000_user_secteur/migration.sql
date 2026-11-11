-- AlterTable
ALTER TABLE "user" ADD COLUMN     "secteur" VARCHAR(8);

-- Reprise : un agent dont tous les espaces en charge sont d'un même secteur prend ce secteur ;
-- les autres (aucun espace, ou des espaces des deux secteurs) restent transversaux.
UPDATE "user" u SET "secteur" = s."secteur"
FROM (
  SELECT g."user_id", MIN(e."secteur") AS "secteur"
  FROM "espace_gestionnaire" g
  JOIN "espace" e ON e."id" = g."espace_id"
  GROUP BY g."user_id"
  HAVING COUNT(DISTINCT e."secteur") = 1
) s
WHERE u."id" = s."user_id" AND u."kind" = 'agent';
