-- « Mon équipe » sert à répartir les espaces : il n'est plus proposé par défaut aux rôles qui
-- ne faisaient que le consulter (Agent, Financier, Élu, Lecteur). Seuls les rôles restés au
-- niveau « Lecture » sont touchés ; un niveau choisi par l'administrateur est conservé.
UPDATE "role"
SET "permissions" = jsonb_set("permissions"::jsonb, '{equipe}', '0')
WHERE "name" IN ('agent', 'financier', 'elu', 'lecteur')
  AND "permissions"::jsonb ->> 'equipe' = '1';
