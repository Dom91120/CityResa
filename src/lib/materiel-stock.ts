/**
 * Matériel : stock utilisable (hors unités en panne ou perdues), sortie et retour pour un
 * dossier avec manquants signalés, pannes et remises en service, contrôles périodiques,
 * charge d'un jour face au stock (planning du matériel).
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

export type Mobilisation = { debut: Date; fin: Date; quantite: number };

/**
 * Le plus grand nombre d'unités retenues en même temps par des dossiers (bornes exclues :
 * un dossier qui finit à 12 h ne gêne pas celui qui commence à 12 h). C'est ce qui manque
 * au pire moment, à comparer au stock ; additionner tous les dossiers surestime le besoin.
 */
export function picMobilisation(lignes: Mobilisation[]): number {
  const bornes: [number, number][] = [];
  for (const l of lignes) {
    if (l.quantite <= 0 || l.fin <= l.debut) continue;
    bornes.push([l.debut.getTime(), l.quantite], [l.fin.getTime(), -l.quantite]);
  }
  // À instant égal, les fins passent avant les débuts.
  bornes.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let courant = 0;
  let pic = 0;
  for (const [, delta] of bornes) {
    courant += delta;
    if (courant > pic) pic = courant;
  }
  return pic;
}

/**
 * Le pic d'unités retenues sur une fenêtre (un jour du planning du matériel) : seule la part
 * des dossiers comprise dans la fenêtre compte, et seuls ceux qui s'y recouvrent s'additionnent.
 */
export function chargeSurFenetre(lignes: readonly Mobilisation[], de: Date, a: Date): number {
  return picMobilisation(
    lignes.map((l) => ({
      debut: l.debut < de ? de : l.debut,
      fin: l.fin > a ? a : l.fin,
      quantite: l.quantite,
    })),
  );
}

export type NiveauCharge = "libre" | "partiel" | "complet" | "depasse";

/** Où en est le stock un jour donné : rien de retenu, il en reste, tout est retenu, il en manque. */
export function niveauCharge(charge: number, utilisable: number): NiveauCharge {
  if (charge <= 0) return "libre";
  if (charge > utilisable) return "depasse";
  return charge === utilisable ? "complet" : "partiel";
}

export const NIVEAUX_CHARGE: Record<NiveauCharge, { label: string; teinte: string }> = {
  libre: { label: "Rien de retenu", teinte: "slate" },
  partiel: { label: "Retenu en partie", teinte: "emerald" },
  complet: { label: "Tout le stock est retenu", teinte: "amber" },
  depasse: { label: "Stock dépassé", teinte: "red" },
};

/** Le rattachement d'un matériel : aucun (stock commun), un site, ou un espace précis. */
export type Rattachement = { siteId: number | null; espaceId: number | null };

/**
 * Ce matériel peut-il accompagner une réservation de cet espace ? Le stock commun, partout ;
 * le matériel d'un site, pour les espaces de ce site ; celui d'un espace, pour lui seul.
 */
export function proposable(m: Rattachement, espace: { id: number; siteId: number }): boolean {
  if (m.espaceId) return m.espaceId === espace.id;
  if (m.siteId) return m.siteId === espace.siteId;
  return true;
}

/** « Stock commun », « Site : Gymnase », « Espace : Dojo ». */
export function libelleRattachement(m: {
  site?: { name: string } | null;
  espace?: { name: string } | null;
}): string {
  if (m.espace) return `Espace : ${m.espace.name}`;
  if (m.site) return `Site : ${m.site.name}`;
  return "Stock commun";
}
