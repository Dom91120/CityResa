/**
 * Délais des étapes de circuit : combien de temps une relecture, un avis ou un visa met à
 * recevoir sa réponse, par étape et par service. Règles pures, sans base.
 */

export type LigneEtape = {
  /** Ce qui regroupe : le libellé de l'étape, ou le nom du service. */
  groupe: string;
  status: string;
  ouvertAt: Date;
  closAt: Date | null;
  echeanceAt: Date | null;
};

export type Delai = {
  groupe: string;
  /** Étapes qui ont reçu leur réponse sur la période. */
  closes: number;
  accords: number;
  refus: number;
  /** Durées de réponse, en minutes ; `null` sans étape close. */
  moyenne: number | null;
  mediane: number | null;
  max: number | null;
  /** Réponses arrivées après l'échéance indicative. */
  horsDelai: number;
  /** Étapes encore ouvertes, dont celles dont l'échéance est passée. */
  ouvertes: number;
  enRetard: number;
};

const MINUTE = 60_000;

export function mediane(valeurs: readonly number[]): number | null {
  if (!valeurs.length) return null;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

/** Une étape annulée (redemandée, ou dossier clos avant la réponse) ne compte pas. */
export function compte(l: Pick<LigneEtape, "status">): boolean {
  return l.status === "ouverte" || l.status === "validee" || l.status === "refusee";
}

/** Les délais d'un ensemble d'étapes, en un seul agrégat. */
export function delaiDe(groupe: string, lignes: readonly LigneEtape[], now = new Date()): Delai {
  const closes = lignes.filter((l) => l.status !== "ouverte" && l.closAt);
  const ouvertes = lignes.filter((l) => l.status === "ouverte");
  const durees = closes.map((l) =>
    Math.max(0, ((l.closAt as Date).getTime() - l.ouvertAt.getTime()) / MINUTE),
  );
  return {
    groupe,
    closes: closes.length,
    accords: closes.filter((l) => l.status === "validee").length,
    refus: closes.filter((l) => l.status === "refusee").length,
    moyenne: durees.length ? durees.reduce((a, b) => a + b, 0) / durees.length : null,
    mediane: mediane(durees),
    max: durees.length ? Math.max(...durees) : null,
    horsDelai: closes.filter((l) => l.echeanceAt && (l.closAt as Date) > l.echeanceAt).length,
    ouvertes: ouvertes.length,
    enRetard: ouvertes.filter((l) => l.echeanceAt && l.echeanceAt < now).length,
  };
}

/** Les délais groupe par groupe, les plus sollicités d'abord. */
export function delaisParGroupe(lignes: readonly LigneEtape[], now = new Date()): Delai[] {
  const groupes = new Map<string, LigneEtape[]>();
  for (const l of lignes.filter(compte)) {
    const g = groupes.get(l.groupe);
    if (g) g.push(l);
    else groupes.set(l.groupe, [l]);
  }
  return [...groupes]
    .map(([groupe, ls]) => delaiDe(groupe, ls, now))
    .sort(
      (a, b) =>
        b.closes + b.ouvertes - (a.closes + a.ouvertes) || a.groupe.localeCompare(b.groupe, "fr"),
    );
}

export const PERIODES_DELAIS = [3, 6, 12] as const;

export function lirePeriodeDelais(v: unknown): (typeof PERIODES_DELAIS)[number] {
  const n = Number(v);
  return n === 3 || n === 6 ? n : 12;
}
