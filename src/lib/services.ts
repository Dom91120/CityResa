/**
 * Les services de la collectivité : qui agit pour un service, et ce que cela ouvre. PUR.
 *
 * Une personne agit pour un service si elle en est membre ou responsable, ou si elle est
 * membre ou responsable du service qui le supplée pendant la période de suppléance.
 *
 * Deux règles en découlent (module Processus et circuits) :
 * - DÉCIDER sur un dossier confié à un service revient aux seules personnes qui agissent
 *   pour lui (et aux administrateurs) ;
 * - la FILE DE TRAVAIL d'un agent qui appartient à des services (demandes à traiter,
 *   compteurs, filtre par défaut) se limite aux dossiers de ses services et à ceux qui n'en
 *   ont pas. Un agent sans service garde la vue d'ensemble, mais ne décide pas.
 */

export type ServiceBrut = {
  id: number;
  isActive: boolean;
  responsableId: string | null;
  membres: readonly string[];
  suppleantId: number | null;
  /** Bornes de la suppléance, AAAA-MM-JJ incluses ; null = sans limite de ce côté. */
  suppleanceDu: string | null;
  suppleanceAu: string | null;
};

/** Le service est-il suppléé ce jour-là (AAAA-MM-JJ) ? */
export function suppleanceEnCours(
  s: Pick<ServiceBrut, "suppleantId" | "suppleanceDu" | "suppleanceAu">,
  jour: string,
): boolean {
  if (!s.suppleantId) return false;
  return (!s.suppleanceDu || s.suppleanceDu <= jour) && (!s.suppleanceAu || jour <= s.suppleanceAu);
}

const estDu = (s: ServiceBrut, userId: string) =>
  s.responsableId === userId || s.membres.includes(userId);

/** Les services (actifs) pour lesquels une personne agit ce jour-là, suppléances comprises. */
export function servicesAgis(
  userId: string,
  services: readonly ServiceBrut[],
  jour: string,
): number[] {
  const actifs = services.filter((s) => s.isActive);
  const directs = new Set(actifs.filter((s) => estDu(s, userId)).map((s) => s.id));
  const out = new Set(directs);
  for (const s of actifs)
    if (s.suppleantId && directs.has(s.suppleantId) && suppleanceEnCours(s, jour)) out.add(s.id);
  return [...out].sort((a, b) => a - b);
}

export type Acteur = {
  /** Le module Processus et circuits est en service. */
  actif: boolean;
  isAdmin: boolean;
  /** Les services pour lesquels la personne agit. */
  services: readonly number[];
};

/** La personne peut-elle décider sur un dossier confié à ce service ? */
export function agitPour(a: Acteur, serviceId: number | null | undefined): boolean {
  if (!a.actif || !serviceId || a.isAdmin) return true;
  return a.services.includes(serviceId);
}

/**
 * Les services auxquels se limite la file de travail de la personne ; null = pas de limite
 * (module coupé, administrateur, ou agent qui n'appartient à aucun service).
 */
export function fileDeTravail(a: Acteur): number[] | null {
  if (!a.actif || a.isAdmin || !a.services.length) return null;
  return [...a.services];
}

/**
 * Peut-elle toucher à la facture d'un dossier confié à ce service ? Comme la décision, sauf
 * pour un agent sans service (régie, finances), qui encaisse pour tous.
 */
export function factureOuverte(a: Acteur, serviceId: number | null | undefined): boolean {
  return fileDeTravail(a) === null || agitPour(a, serviceId);
}
