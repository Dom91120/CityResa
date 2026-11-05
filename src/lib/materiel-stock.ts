/**
 * Matériel : stock utilisable (hors unités en panne ou perdues), sortie et retour pour un
 * dossier avec manquants signalés, pannes et remises en service, contrôles périodiques.
 * Logique PURE : testée dans materiel-stock.test.ts.
 */

export const MOUVEMENTS: Record<string, string> = {
  sortie: "Sortie pour un dossier",
  retour: "Retour",
  perte: "Manquant au retour",
  panne: "Panne ou perte signalée",
  reparation: "Remise en service",
  controle: "Contrôle périodique",
};

export type StockMateriel = { stockTotal: number; horsService: number };

/** Le stock réellement utilisable : total moins les unités hors service. */
export function stockUtilisable(m: StockMateriel): number {
  return Math.max(0, m.stockTotal - m.horsService);
}

/** Ce qui reste disponible une fois `mobilise` unités retenues par les dossiers. */
export function disponible(m: StockMateriel, mobilise: number): number {
  return Math.max(0, stockUtilisable(m) - mobilise);
}

export type LigneMateriel = {
  quantite: number;
  sortieAt: Date | null;
  retourAt: Date | null;
  manquants: number;
};

export type EtatLigne = "a_sortir" | "sortie" | "rendue" | "manquants";

/** Où en est le matériel d'un dossier : à sortir, sorti, rendu, rendu avec des manquants. */
export function etatLigne(l: LigneMateriel): EtatLigne {
  if (l.retourAt) return l.manquants > 0 ? "manquants" : "rendue";
  return l.sortieAt ? "sortie" : "a_sortir";
}

export const ETATS_LIGNE: Record<EtatLigne, string> = {
  a_sortir: "À sortir",
  sortie: "Sorti",
  rendue: "Rendu",
  manquants: "Rendu avec manquants",
};

/** Contrôle d'un retour : `rendus` unités reviennent sur `quantite` sorties ; le reste manque. */
export function verifierRetour(
  l: LigneMateriel,
  rendus: number,
): { ok: true; manquants: number } | { ok: false; erreur: string } {
  if (!l.sortieAt) return { ok: false, erreur: "Ce matériel n'a pas été sorti : rien à rendre." };
  if (l.retourAt) return { ok: false, erreur: "Le retour est déjà constaté." };
  if (!Number.isInteger(rendus) || rendus < 0)
    return { ok: false, erreur: "Indiquez le nombre d'unités rendues." };
  if (rendus > l.quantite)
    return { ok: false, erreur: `Au plus ${l.quantite} unité(s) étaient sorties.` };
  return { ok: true, manquants: l.quantite - rendus };
}

/** Une panne ou perte retire des unités du stock utilisable. */
export function verifierPanne(m: StockMateriel, quantite: number): string | null {
  if (!Number.isInteger(quantite) || quantite < 1) return "Indiquez le nombre d'unités concernées.";
  if (quantite > stockUtilisable(m))
    return `Au plus ${stockUtilisable(m)} unité(s) sont encore en service.`;
  return null;
}

/** Une remise en service rend des unités hors service au stock. */
export function verifierRemise(m: StockMateriel, quantite: number): string | null {
  if (!Number.isInteger(quantite) || quantite < 1)
    return "Indiquez le nombre d'unités remises en service.";
  if (quantite > m.horsService) return `Au plus ${m.horsService} unité(s) sont hors service.`;
  return null;
}

export type ControleMateriel = {
  controleMois: number | null;
  dernierControleAt: Date | null;
  createdAt: Date;
};

/** L'échéance du prochain contrôle (dernier contrôle, sinon création, plus la périodicité) ; null sans périodicité. */
export function echeanceControle(m: ControleMateriel): Date | null {
  if (!m.controleMois) return null;
  const d = new Date(m.dernierControleAt ?? m.createdAt);
  d.setUTCMonth(d.getUTCMonth() + m.controleMois);
  return d;
}

export function controleEnRetard(m: ControleMateriel, now = new Date()): boolean {
  const e = echeanceControle(m);
  return e !== null && e <= now;
}

/** « Tous les 6 mois · dernier le … · prochain le … (en retard) ». */
export function decrireControle(
  m: ControleMateriel,
  fmt: (d: Date) => string,
  now = new Date(),
): string {
  if (!m.controleMois) return "Pas de contrôle périodique.";
  const e = echeanceControle(m) as Date;
  const dernier = m.dernierControleAt
    ? `dernier le ${fmt(m.dernierControleAt)}`
    : "jamais contrôlé";
  return `Tous les ${m.controleMois} mois · ${dernier} · prochain le ${fmt(e)}${e <= now ? " (en retard)" : ""}`;
}
