/**
 * Les données qu'un usager doit avoir renseignées avant de déposer une demande de
 * réservation. La liste dépend du type d'organisation : une association châtillonnaise
 * doit fournir son président et la date de l'AG qui l'a nommé, une entreprise son SIRET
 * et son dirigeant, un particulier ses seules coordonnées.
 *
 * Trois sources : l'organisation (fiche « Mon organisation »), le contact (le compte qui
 * dépose, fiche « Mon compte ») et la demande elle-même (objet, nombre de participants).
 * Les deux dernières données sont contrôlées par le formulaire de demande ; ce module
 * vérifie les deux premières sources et explique ce qui manque.
 */

export type DonneeOrganisation = {
  type: string;
  name: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  siret: string | null;
  legalFirstName: string | null;
  legalLastName: string | null;
  legalAppointedAt: Date | null;
};

export type DonneeContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
};

export type ExigenceCle =
  | "org_name"
  | "address"
  | "postal_code"
  | "city"
  | "siret"
  | "legal_first_name"
  | "legal_last_name"
  | "legal_appointed_at"
  | "contact_first_name"
  | "contact_last_name"
  | "contact_phone"
  | "contact_email";

export type Exigence = {
  cle: ExigenceCle;
  /** Où la donnée se renseigne. */
  cible: "organisation" | "compte";
  libelle: string;
};

const ORGANISATION_COMPLETE: Exigence[] = [
  { cle: "org_name", cible: "organisation", libelle: "Nom de l'organisation" },
  { cle: "address", cible: "organisation", libelle: "Adresse postale du siège social" },
  { cle: "postal_code", cible: "organisation", libelle: "Code postal" },
  { cle: "city", cible: "organisation", libelle: "Ville" },
];

const CONTACT: Exigence[] = [
  { cle: "contact_first_name", cible: "compte", libelle: "Prénom du contact" },
  { cle: "contact_last_name", cible: "compte", libelle: "Nom du contact" },
  { cle: "contact_phone", cible: "compte", libelle: "Téléphone du contact" },
  { cle: "contact_email", cible: "compte", libelle: "E-mail du contact" },
];

/** Les exigences par type d'organisation. Un type absent = celui d'un particulier. */
export const EXIGENCES_PAR_TYPE: Record<string, Exigence[]> = {
  association: [
    { cle: "org_name", cible: "organisation", libelle: "Nom de l'association" },
    ...CONTACT,
    ...ORGANISATION_COMPLETE.slice(1),
    { cle: "legal_first_name", cible: "organisation", libelle: "Prénom du président" },
    { cle: "legal_last_name", cible: "organisation", libelle: "Nom du président" },
    { cle: "legal_appointed_at", cible: "organisation", libelle: "Date de l'AG de nomination" },
  ],
  entreprise: [
    { cle: "org_name", cible: "organisation", libelle: "Raison sociale" },
    ...CONTACT,
    ...ORGANISATION_COMPLETE.slice(1),
    { cle: "siret", cible: "organisation", libelle: "SIRET" },
    { cle: "legal_first_name", cible: "organisation", libelle: "Prénom du dirigeant" },
    { cle: "legal_last_name", cible: "organisation", libelle: "Nom du dirigeant" },
  ],
  particulier: [...CONTACT, ...ORGANISATION_COMPLETE.slice(1)],
  service_interne: [...CONTACT],
  collectivite: [{ ...ORGANISATION_COMPLETE[0], libelle: "Nom de la collectivité" }, ...CONTACT],
  autre: [...ORGANISATION_COMPLETE, ...CONTACT],
};

/** Les exigences applicables à un type d'organisation. */
export function exigencesPour(type: string): Exigence[] {
  return EXIGENCES_PAR_TYPE[type] ?? EXIGENCES_PAR_TYPE.particulier;
}

/** Les clés exigées sur la fiche organisation pour ce type (pour marquer les champs « * »). */
export function exigeSurOrganisation(type: string, cle: ExigenceCle): boolean {
  return exigencesPour(type).some((e) => e.cible === "organisation" && e.cle === cle);
}

function rempli(v: string | Date | null | undefined): boolean {
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  return Boolean(v?.trim());
}

function valeur(
  cle: ExigenceCle,
  org: DonneeOrganisation,
  contact: DonneeContact | null,
): string | Date | null {
  switch (cle) {
    case "org_name":
      return org.name;
    case "address":
      return org.address;
    case "postal_code":
      return org.postalCode;
    case "city":
      return org.city;
    case "siret":
      return org.siret;
    case "legal_first_name":
      return org.legalFirstName;
    case "legal_last_name":
      return org.legalLastName;
    case "legal_appointed_at":
      return org.legalAppointedAt;
    case "contact_first_name":
      return contact?.firstName ?? null;
    case "contact_last_name":
      return contact?.lastName ?? null;
    case "contact_phone":
      return contact?.phone ?? null;
    case "contact_email":
      return contact?.email ?? null;
  }
}

/**
 * Les données manquantes pour que cet usager puisse déposer une demande. Vide = dossier
 * complet. `contact` null = aucun compte de dépôt connu : toutes ses données manquent.
 */
export function manquesDossier(org: DonneeOrganisation, contact: DonneeContact | null): Exigence[] {
  return exigencesPour(org.type).filter((e) => !rempli(valeur(e.cle, org, contact)));
}

/** Les manques limités à une seule source (pour valider un formulaire). */
export function manquesSur(
  cible: Exigence["cible"],
  org: DonneeOrganisation,
  contact: DonneeContact | null,
): Exigence[] {
  return manquesDossier(org, contact).filter((e) => e.cible === cible);
}

/** « Président(e) » pour une association, « Dirigeant(e) » pour une entreprise, sinon « Représentant légal ». */
export function qualiteRepresentant(type: string): string {
  if (type === "association") return "Président(e)";
  if (type === "entreprise") return "Dirigeant(e)";
  return "Représentant légal";
}

/** Le nom complet du représentant légal, ou null si non renseigné. */
export function nomRepresentant(o: {
  legalFirstName: string | null;
  legalLastName: string | null;
}): string | null {
  const s = `${o.legalFirstName ?? ""} ${o.legalLastName ?? ""}`.trim();
  return s || null;
}

/** Une phrase listant les manques : « Il manque : Téléphone du contact, Nom du président. » */
export function phraseManques(manques: Exigence[]): string {
  if (!manques.length) return "";
  return `Il manque : ${manques.map((m) => m.libelle.charAt(0).toLowerCase() + m.libelle.slice(1)).join(", ")}.`;
}

// ── Formulaire d'inscription ──

/**
 * Le code postal et la ville d'une adresse (« 1 place de la Libération, 92320 Châtillon »
 * → 92320, CHATILLON), pour pré-remplir l'inscription avec la commune de la collectivité.
 * Ville en capitales sans accents, comme sur une adresse postale. Null si introuvable.
 */
export function communeDeLAdresse(adresse: string): { codePostal: string; ville: string } | null {
  const m = /\b(\d{5})\s+([^,\d][^,]*)$/.exec(adresse.trim());
  if (!m) return null;
  const ville = m[2]
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  return ville ? { codePostal: m[1], ville } : null;
}

/** Les champs du formulaire d'inscription qui dépendent du type d'organisation. */
export const CHAMPS_INSCRIPTION = [
  "phone",
  "org_name",
  "address",
  "postal_code",
  "city",
  "siret",
  "rna",
  "legal_first_name",
  "legal_last_name",
  "legal_appointed_at",
] as const;
export type ChampInscription = (typeof CHAMPS_INSCRIPTION)[number];

export type RegleChamp = { visible: boolean; requis: boolean; libelle: string; aide: string };

/** Le champ du formulaire qui porte une exigence du dossier. */
const CHAMP_DE_L_EXIGENCE: Partial<Record<ExigenceCle, ChampInscription>> = {
  contact_phone: "phone",
  org_name: "org_name",
  address: "address",
  postal_code: "postal_code",
  city: "city",
  siret: "siret",
  legal_first_name: "legal_first_name",
  legal_last_name: "legal_last_name",
  legal_appointed_at: "legal_appointed_at",
};

/**
 * Pour chaque champ variable de l'inscription : affiché ou non, obligatoire ou non, libellé
 * et aide, selon le type choisi. Les données exigées avant toute demande sont obligatoires
 * dès l'inscription ; un champ sans objet pour ce type est masqué.
 */
export function reglesInscription(type: string): Record<ChampInscription, RegleChamp> {
  const asso = type === "association";
  const entreprise = type === "entreprise";
  const particulier = type === "particulier";
  const exiges = new Set(
    exigencesPour(type)
      .map((e) => CHAMP_DE_L_EXIGENCE[e.cle])
      .filter((c): c is ChampInscription => Boolean(c)),
  );
  const r = (visible: boolean, libelle: string, aide = ""): RegleChamp => ({
    visible,
    requis: false,
    libelle,
    aide,
  });
  const regles: Record<ChampInscription, RegleChamp> = {
    phone: r(true, "Téléphone mobile", "Pour la signature par SMS"),
    org_name: r(
      !particulier,
      asso ? "Nom de l'association" : entreprise ? "Raison sociale" : "Nom de l'organisation",
    ),
    address: r(true, particulier ? "Adresse" : "Adresse du siège"),
    postal_code: r(true, "Code postal"),
    city: r(true, "Ville"),
    siret: r(
      !particulier,
      "SIRET",
      entreprise ? "14 chiffres" : asso ? "Si l'association est employeuse" : "",
    ),
    rna: r(asso, "N° RNA", "W suivi de 9 chiffres"),
    legal_first_name: r(!particulier, "Prénom"),
    legal_last_name: r(!particulier, "Nom"),
    legal_appointed_at: r(asso, "Date de l'AG de nomination", "L'AG qui a élu la présidence"),
  };
  for (const c of CHAMPS_INSCRIPTION) regles[c].requis = regles[c].visible && exiges.has(c);
  return regles;
}

/**
 * Contrôle et nettoyage d'une inscription : les champs sans objet pour le type sont vidés,
 * les champs obligatoires absents sont listés par leur libellé.
 */
export function controlerInscription<T extends Partial<Record<ChampInscription, unknown>>>(
  type: string,
  valeurs: T,
): { valeurs: T; manques: string[] } {
  const regles = reglesInscription(type);
  const propres = { ...valeurs } as Record<string, unknown>;
  for (const c of CHAMPS_INSCRIPTION) if (!regles[c].visible) propres[c] = null;
  const manques = exigencesPour(type)
    .filter((e) => {
      const c = CHAMP_DE_L_EXIGENCE[e.cle];
      if (!c || !regles[c].requis) return false;
      const v = propres[c];
      return v instanceof Date ? Number.isNaN(v.getTime()) : !String(v ?? "").trim();
    })
    .map((e) => e.libelle);
  return { valeurs: propres as T, manques };
}
