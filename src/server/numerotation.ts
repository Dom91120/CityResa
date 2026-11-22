/**
 * Numéros de dossier : R260001 pour une réservation, F260001 pour une facture, S260001 pour une
 * subvention (une lettre, l'année sur deux chiffres — l'exercice pour une subvention —, le rang
 * sur quatre). Un dossier de subvention en rédaction porte un numéro provisoire, P270001, remplacé
 * par son numéro S au dépôt : les brouillons abandonnés ne trouent pas la numérotation. Un compteur
 * par préfixe et par année (table sequence, clés « RES-2026 », « FAC-2026 », « SUB-2026 »,
 * « PRO-2027 »), incrémenté atomiquement.
 */
import { prisma } from "@/server/db";

export async function prochainNumero(
  prefixe: "RES" | "FAC" | "SUB" | "PRO",
  annee = new Date().getFullYear(),
): Promise<string> {
  const key = `${prefixe}-${annee}`;
  const rows = await prisma.$queryRaw<{ value: number }[]>`
    INSERT INTO "sequence" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "sequence"."value" + 1
    RETURNING "value"`;
  const n = Number(rows[0]?.value ?? 1);
  const rang = String(n).padStart(4, "0");
  return `${prefixe[0]}${String(annee % 100).padStart(2, "0")}${rang}`;
}

/** Le numéro est-il celui, provisoire, d'un dossier de subvention pas encore déposé ? */
export function estNumeroProvisoire(numero: string): boolean {
  return /^Pd{6,}$/.test(numero);
}
