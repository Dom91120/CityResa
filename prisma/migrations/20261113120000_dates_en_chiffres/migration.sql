-- La date abrégée s'écrit désormais en chiffres (« Dim. 06 déc. 2026 » → « Dim. 06/12/2026 »).
-- Les textes déjà enregistrés qui la citent (notifications, historique des dossiers) sont alignés.
UPDATE "notification" SET "body" = regexp_replace("body", '(\d{2}) janv\. (\d{4})', '\1/01/\2', 'g') WHERE "body" ~ '\d{2} janv\. \d{4}';
UPDATE "notification" SET "body" = regexp_replace("body", '(\d{2}) févr\. (\d{4})', '\1/02/\2', 'g') WHERE "body" ~ '\d{2} févr\. \d{4}';
UPDATE "notification" SET "body" = regexp_replace("body", '(\d{2}) mars (\d{4})', '\1/03/\2', 'g') WHERE "body" ~ '\d{2} mars \d{4}';
UPDATE "notification" SET "body" = regexp_replace("body", '(\d{2}) avr\. (\d{4})', '\1/04/\2', 'g') WHERE "body" ~ '\d{2} avr\. \d{4}';
UPDATE "notification" SET "body" = regexp_replace("body", '(\d{2}) mai (\d{4})', '\1/05/\2', 'g') WHERE "body" ~ '\d{2} mai \d{4}';
UPDATE "notification" SET "body" = regexp_replace("body", '(\d{2}) juin (\d{4})', '\1/06/\2', 'g') WHERE "body" ~ '\d{2} juin \d{4}';
UPDATE "notification" SET "body" = regexp_replace("body", '(\d{2}) juil\. (\d{4})', '\1/07/\2', 'g') WHERE "body" ~ '\d{2} juil\. \d{4}';
UPDATE "notification" SET "body" = regexp_replace("body", '(\d{2}) août (\d{4})', '\1/08/\2', 'g') WHERE "body" ~ '\d{2} août \d{4}';
UPDATE "notification" SET "body" = regexp_replace("body", '(\d{2}) sept\. (\d{4})', '\1/09/\2', 'g') WHERE "body" ~ '\d{2} sept\. \d{4}';
UPDATE "notification" SET "body" = regexp_replace("body", '(\d{2}) oct\. (\d{4})', '\1/10/\2', 'g') WHERE "body" ~ '\d{2} oct\. \d{4}';
UPDATE "notification" SET "body" = regexp_replace("body", '(\d{2}) nov\. (\d{4})', '\1/11/\2', 'g') WHERE "body" ~ '\d{2} nov\. \d{4}';
UPDATE "notification" SET "body" = regexp_replace("body", '(\d{2}) déc\. (\d{4})', '\1/12/\2', 'g') WHERE "body" ~ '\d{2} déc\. \d{4}';
UPDATE "reservation_history" SET "comment" = regexp_replace("comment", '(\d{2}) janv\. (\d{4})', '\1/01/\2', 'g') WHERE "comment" ~ '\d{2} janv\. \d{4}';
UPDATE "reservation_history" SET "comment" = regexp_replace("comment", '(\d{2}) févr\. (\d{4})', '\1/02/\2', 'g') WHERE "comment" ~ '\d{2} févr\. \d{4}';
UPDATE "reservation_history" SET "comment" = regexp_replace("comment", '(\d{2}) mars (\d{4})', '\1/03/\2', 'g') WHERE "comment" ~ '\d{2} mars \d{4}';
UPDATE "reservation_history" SET "comment" = regexp_replace("comment", '(\d{2}) avr\. (\d{4})', '\1/04/\2', 'g') WHERE "comment" ~ '\d{2} avr\. \d{4}';
UPDATE "reservation_history" SET "comment" = regexp_replace("comment", '(\d{2}) mai (\d{4})', '\1/05/\2', 'g') WHERE "comment" ~ '\d{2} mai \d{4}';
UPDATE "reservation_history" SET "comment" = regexp_replace("comment", '(\d{2}) juin (\d{4})', '\1/06/\2', 'g') WHERE "comment" ~ '\d{2} juin \d{4}';
UPDATE "reservation_history" SET "comment" = regexp_replace("comment", '(\d{2}) juil\. (\d{4})', '\1/07/\2', 'g') WHERE "comment" ~ '\d{2} juil\. \d{4}';
UPDATE "reservation_history" SET "comment" = regexp_replace("comment", '(\d{2}) août (\d{4})', '\1/08/\2', 'g') WHERE "comment" ~ '\d{2} août \d{4}';
UPDATE "reservation_history" SET "comment" = regexp_replace("comment", '(\d{2}) sept\. (\d{4})', '\1/09/\2', 'g') WHERE "comment" ~ '\d{2} sept\. \d{4}';
UPDATE "reservation_history" SET "comment" = regexp_replace("comment", '(\d{2}) oct\. (\d{4})', '\1/10/\2', 'g') WHERE "comment" ~ '\d{2} oct\. \d{4}';
UPDATE "reservation_history" SET "comment" = regexp_replace("comment", '(\d{2}) nov\. (\d{4})', '\1/11/\2', 'g') WHERE "comment" ~ '\d{2} nov\. \d{4}';
UPDATE "reservation_history" SET "comment" = regexp_replace("comment", '(\d{2}) déc\. (\d{4})', '\1/12/\2', 'g') WHERE "comment" ~ '\d{2} déc\. \d{4}';
