/**
 * Les droits d'un agent : ceux de son RÔLE, par catégorie et par niveau (0 aucun, 1 lecture,
 * 2 écriture, 3 suppression, cumulatifs), corrigés par les DÉROGATIONS de son compte. PUR.
 *
 * Une dérogation ne porte que sur une catégorie et peut aller dans les deux sens : ouvrir un
 * domaine que le rôle ferme, ou en retirer un qu'il donne. Tout ce qui n'est pas dérogé suit le
 * rôle, y compris quand le rôle change ensuite. Les administrateurs (accès total) et les usagers
 * (aucun accès au back-office) n'ont pas de dérogations.
 */
import {
  CATEGORY_LABELS,
  PERMISSION_CATEGORIES,
  PERMISSION_LEVELS,
  type PermissionCategory,
} from "@/lib/constantes";

/** La teinte de la pastille d'un niveau. */
export const TEINTES_NIVEAU: Record<number, string> = {
  0: "slate",
  1: "sky",
  2: "emerald",
  3: "rose",
};

export type Niveaux = Partial<Record<PermissionCategory, number>>;

/** Un niveau saisi ou stocké, ramené à 0-3 ; null s'il n'en est pas un. */
export function lireNiveau(valeur: unknown): number | null {
  const n = typeof valeur === "number" ? valeur : Number.parseInt(String(valeur ?? ""), 10);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : null;
}

/** Les niveaux d'un JSON stocké (rôle ou dérogations) : catégories connues, niveaux valides. */
export function lireNiveaux(brut: unknown): Niveaux {
  const out: Niveaux = {};
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return out;
  for (const c of PERMISSION_CATEGORIES) {
    const n = lireNiveau((brut as Record<string, unknown>)[c]);
    if (n !== null) out[c] = n;
  }
  return out;
}

/** Le niveau du compte sur une catégorie : sa dérogation si elle existe, sinon celui du rôle. */
export function niveauEffectif(role: Niveaux, derogations: Niveaux, categorie: string): number {
  const c = categorie as PermissionCategory;
  return derogations[c] ?? role[c] ?? 0;
}

export type Ecart = { categorie: PermissionCategory; role: number; compte: number };

/**
 * Les catégories où le compte diffère RÉELLEMENT de son rôle. Une dérogation devenue égale au
 * rôle (parce que le rôle a changé depuis) n'est plus un écart.
 */
export function ecarts(role: Niveaux, derogations: Niveaux): Ecart[] {
  return PERMISSION_CATEGORIES.flatMap((categorie) => {
    const compte = derogations[categorie];
    const duRole = role[categorie] ?? 0;
    return compte === undefined || compte === duRole ? [] : [{ categorie, role: duRole, compte }];
  });
}

/** « Paiements : Écriture (rôle : Aucun), Usagers : Lecture (rôle : Écriture) » ; vide sans écart. */
export function resumeEcarts(liste: readonly Ecart[]): string {
  return liste
    .map(
      (e) =>
        `${CATEGORY_LABELS[e.categorie]} : ${PERMISSION_LEVELS[e.compte]} (rôle : ${PERMISSION_LEVELS[e.role]})`,
    )
    .join(", ");
}

/**
 * Les dérogations à enregistrer d'après une saisie : une catégorie laissée « comme le rôle »
 * (null) ou réglée au niveau du rôle n'est pas retenue. Vide : le compte suit son rôle.
 */
export function derogationsUtiles(
  role: Niveaux,
  saisie: Partial<Record<PermissionCategory, number | null>>,
): Niveaux {
  const out: Niveaux = {};
  for (const c of PERMISSION_CATEGORIES) {
    const n = saisie[c];
    if (n === null || n === undefined) continue;
    if (n !== (role[c] ?? 0)) out[c] = n;
  }
  return out;
}
