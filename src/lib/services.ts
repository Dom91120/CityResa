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

export type Rattachement = {
  id: number;
  /** À quel titre la personne agit pour le service. */
  lien: "responsable" | "membre" | "suppleance";
  /** Pour une suppléance : le service de la personne, qui supplée celui-ci. */
  via: number | null;
};

/**
 * Les services (actifs) d'une personne ce jour-là et le titre auquel elle agit pour chacun :
 * les mêmes que `servicesAgis`, détaillés pour l'affichage (fiche d'un compte).
 */
export function rattachements(
  userId: string,
  services: readonly ServiceBrut[],
  jour: string,
): Rattachement[] {
  const actifs = services.filter((s) => s.isActive);
  const directs = new Set(actifs.filter((s) => estDu(s, userId)).map((s) => s.id));
  const out: Rattachement[] = [];
  for (const s of actifs) {
    if (directs.has(s.id))
      out.push({
        id: s.id,
        lien: s.responsableId === userId ? "responsable" : "membre",
        via: null,
      });
    else if (s.suppleantId && directs.has(s.suppleantId) && suppleanceEnCours(s, jour))
      out.push({ id: s.id, lien: "suppleance", via: s.suppleantId });
  }
  return out.sort((a, b) => a.id - b.id);
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
  return dossierOuvert(a, serviceId);
}

/**
 * Peut-elle accomplir un geste de terrain ou de gestion sur un dossier de ce service (facture,
 * constat de présence, personnel de service) ? Comme la décision, sauf pour un agent sans
 * service (régie, accueil), qui agit pour tous.
 */
export function dossierOuvert(a: Acteur, serviceId: number | null | undefined): boolean {
  return fileDeTravail(a) === null || agitPour(a, serviceId);
}

// ── Service de référence d'un usager ──

export type ServiceUsagers = {
  id: number;
  name: string;
  isActive: boolean;
  position: number;
  /** Types d'organisation suivis ; vide = le service ne suit aucun usager. */
  usagerTypes: readonly string[];
  /** true = les seules associations sportives, false = les non sportives, null = toutes. */
  usagersSportifs: boolean | null;
};

/**
 * Le service de référence d'une organisation : le premier service actif, dans l'ordre des
 * positions, qui suit son type (et, s'il le précise, son caractère sportif). Null = aucun :
 * la fiche reste l'affaire de tous les agents qui ont l'écriture sur les usagers.
 */
export function serviceReference<S extends ServiceUsagers>(
  org: { type: string; sportive: boolean },
  services: readonly S[],
): S | null {
  return (
    [...services]
      .filter((s) => s.isActive && s.usagerTypes.includes(org.type))
      .filter((s) => s.usagersSportifs === null || s.usagersSportifs === org.sportive)
      .sort((a, b) => a.position - b.position || a.id - b.id)[0] ?? null
  );
}

/** L'usager entre-t-il dans la file de travail de la personne (fiches à valider, pièces) ? */
export function usagerSuivi(a: Acteur, referenceId: number | null | undefined): boolean {
  const file = fileDeTravail(a);
  return file === null || !referenceId || file.includes(referenceId);
}

// ── Le signataire des documents d'un dossier ──

export type Signataire = {
  /** Le nom de la personne ; vide si seule la qualité est connue (« Le Maire »). */
  nom: string;
  /** Sa qualité ; vide si le service ne l'a pas précisée. */
  qualite: string;
  /** Vrai quand c'est le signataire du service, faux quand la collectivité signe. */
  duService: boolean;
};

/**
 * Qui signe pour la collectivité la convention ou l'avenant d'un dossier : le signataire du
 * service auquel le dossier est confié, s'il en a un ; sinon celui de la collectivité
 * (Paramètres › Collectivité). Un service qui nomme son signataire sans dire sa qualité n'hérite
 * pas de celle de la collectivité : « Damien Marillier, Le Maire » serait faux.
 */
export function signataireDe(
  service: { signataire: string | null; signataireQualite: string | null } | null | undefined,
  collectivite: { nom: string; qualite: string },
): Signataire {
  const nom = service?.signataire?.trim() ?? "";
  const qualite = service?.signataireQualite?.trim() ?? "";
  if (nom || qualite) return { nom, qualite, duService: true };
  return { nom: collectivite.nom.trim(), qualite: collectivite.qualite.trim(), duService: false };
}

/** « Damien Marillier, Directeur de la communication » ; l'un des deux s'il manque l'autre. */
export function signataireEnLigne(s: Signataire): string {
  return [s.nom, s.qualite].filter(Boolean).join(", ");
}

/** Le bloc de signature : la qualité, puis le nom, une ligne chacun (celles qui existent). */
export function lignesSignataire(s: Signataire): string[] {
  return [s.qualite, s.nom].filter(Boolean);
}

// ── Le service dans les courriels d'un dossier ──

export type ServiceContact = { name: string; email: string | null; phone: string | null };

/**
 * Les variables de courriel qui nomment le service d'un dossier : son nom, son contact sur une
 * ligne, et la signature (service, collectivité, coordonnées). Sans service, la collectivité
 * signe seule. `echapper` protège le HTML de la signature.
 */
export function variablesService(
  collectivite: string,
  service: ServiceContact | null | undefined,
  echapper: (s: string) => string,
): { service: string; service_contact: string; signature: string } {
  if (!service)
    return { service: collectivite, service_contact: "", signature: echapper(collectivite) };
  const contact = [service.email, service.phone].filter((x): x is string => Boolean(x));
  return {
    service: service.name,
    service_contact: contact.join(" · "),
    signature: [service.name, collectivite, ...contact].map(echapper).join("<br>"),
  };
}
