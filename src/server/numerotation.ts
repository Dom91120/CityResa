/**
 * Numéros de dossier : RES-2026-0001, FAC-2026-0001, SUB-2026-0001. Un compteur par
 * préfixe et par année (table sequence), incrémenté atomiquement.
 */
import { prisma } from "@/server/db";

export async function prochainNumero(
  prefixe: "RES" | "FAC" | "SUB",
  annee = new Date().getFullYear(),
): Promise<string> {
  const key = `${prefixe}-${annee}`;
  const rows = await prisma.$queryRaw<{ value: number }[]>`
    INSERT INTO "sequence" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "sequence"."value" + 1
    RETURNING "value"`;
  const n = Number(rows[0]?.value ?? 1);
  return `${key}-${String(n).padStart(4, "0")}`;
}
