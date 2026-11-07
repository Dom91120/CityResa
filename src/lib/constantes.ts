/**
 * Constantes métier de CityRésa. Logique PURE : aucune I/O, partagée par le serveur,
 * les composants et les tests. Vocabulaire unique : un mot, une couleur, partout.
 */

/** Couleur de statut (vocabulaire Bootstrap) : danger / warning / info / success. */
export type Statut = "danger" | "warning" | "info" | "success";

// ── Droits ──
/** Catégories soumises aux permissions par rôle (Paramètres et Utilisateurs restent réservés aux administrateurs). */
export const PERMISSION_CATEGORIES = [
  "reservations",
  "planning",
  "espaces",
  "materiel",
  "usagers",
  "messages",
  "paiements",
  "subventions",
  "equipe",
  "personnel",
] as const;
export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<PermissionCategory, string> = {
  reservations: "Réservations",
  planning: "Planning",
  espaces: "Sites et espaces",
  materiel: "Matériel",
  usagers: "Usagers",
  messages: "Messages",
  paiements: "Paiements",
  subventions: "Subventions",
  equipe: "Mon équipe",
  personnel: "Personnel de service",
};
/** Niveaux : 0 aucun, 1 lecture, 2 écriture, 3 suppression (cumulatifs). */
export const PERMISSION_LEVELS: Record<number, string> = {
  0: "Aucun",
  1: "Lecture",
  2: "Écriture",
  3: "Suppression",
};

/** Rôles de départ (table role). */
export const ROLE_SEEDS: {
  name: string;
  label: string;
  description: string;
  isAdmin: boolean;
  isUsager: boolean;
  level: ((c: PermissionCategory) => number) | null;
}[] = [
  {
    name: "admin",
    label: "Administrateur",
    description: "Accès total : paramètres, utilisateurs, toutes les données.",
    isAdmin: true,
    isUsager: false,
    level: null,
  },
  {
    name: "gestionnaire",
    label: "Gestionnaire",
    description:
      "Traite les demandes, gère les espaces, le matériel, les usagers et les paiements.",
    isAdmin: false,
    isUsager: false,
    level: () => 3,
  },
  {
    name: "agent",
    label: "Agent",
    description: "Traite les demandes des espaces dont il a la charge ; pas de suppression.",
    isAdmin: false,
    isUsager: false,
    level: (c) => (c === "subventions" || c === "equipe" ? 1 : 2),
  },
  {
    name: "financier",
    label: "Financier",
    description: "Suit les factures et les paiements, consulte le reste.",
    isAdmin: false,
    isUsager: false,
    level: (c) => (c === "paiements" ? 3 : 1),
  },
  {
    name: "elu",
    label: "Élu",
    description: "Consulte l'activité et donne un avis sur les demandes de subvention.",
    isAdmin: false,
    isUsager: false,
    level: (c) => (c === "subventions" ? 2 : 1),
  },
  {
    name: "lecteur",
    label: "Lecteur",
    description: "Lecture seule.",
    isAdmin: false,
    isUsager: false,
    level: () => 1,
  },
  {
    name: "usager",
    label: "Usager",
    description: "Compte du portail : dépose et suit ses demandes.",
    isAdmin: false,
    isUsager: true,
    level: () => 0,
  },
];

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_SEEDS.map((r) => [r.name, r.label]),
);

// ── Réservations ──
export type ReservationStatus =
  | "brouillon"
  | "a_traiter"
  | "en_traitement"
  | "acceptee"
  | "signee"
  | "confirmee"
  | "terminee"
  | "refusee"
  | "annulee"
  | "archivee";

/** Libellé, teinte de la pastille et description de chaque statut d'une demande. */
export const RESERVATION_STATUS: Record<
  ReservationStatus,
  { label: string; teinte: string; aide: string; actif: boolean }
> = {
  brouillon: { label: "Brouillon", teinte: "slate", aide: "Demande non envoyée.", actif: false },
  a_traiter: {
    label: "À traiter",
    teinte: "amber",
    aide: "Demande reçue, en attente d'une décision.",
    actif: true,
  },
  en_traitement: {
    label: "En traitement",
    teinte: "sky",
    aide: "Des informations ont été demandées à l'usager.",
    actif: true,
  },
  acceptee: {
    label: "Acceptée",
    teinte: "rose",
    aide: "Demande approuvée : convention à signer.",
    actif: true,
  },
  signee: {
    label: "Signée",
    teinte: "violet",
    aide: "Convention signée : paiement ou confirmation en attente.",
    actif: true,
  },
  confirmee: {
    label: "Confirmée",
    teinte: "emerald",
    aide: "Tout est en ordre : l'espace est réservé.",
    actif: true,
  },
  terminee: { label: "Terminée", teinte: "slate", aide: "L'événement a eu lieu.", actif: false },
  refusee: { label: "Refusée", teinte: "red", aide: "Demande déclinée.", actif: false },
  annulee: {
    label: "Annulée",
    teinte: "red",
    aide: "Annulée par l'usager ou la collectivité.",
    actif: false,
  },
  archivee: { label: "Archivée", teinte: "slate", aide: "Dossier clos et archivé.", actif: false },
};

/** Statuts qui occupent l'espace (bloquent le créneau pour les autres). */
export const STATUTS_OCCUPANTS: ReservationStatus[] = [
  "a_traiter",
  "en_traitement",
  "acceptee",
  "signee",
  "confirmee",
];
/** Statuts fermement acquis (l'usager peut compter dessus). */
export const STATUTS_FERMES: ReservationStatus[] = ["acceptee", "signee", "confirmee"];

/** Transitions admises depuis chaque statut (le reste est refusé par le serveur). */
export const TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  brouillon: ["a_traiter", "annulee"],
  a_traiter: ["en_traitement", "acceptee", "confirmee", "refusee", "annulee"],
  en_traitement: ["a_traiter", "acceptee", "confirmee", "refusee", "annulee"],
  acceptee: ["signee", "confirmee", "annulee", "en_traitement"],
  signee: ["confirmee", "annulee"],
  confirmee: ["terminee", "annulee"],
  terminee: ["archivee"],
  refusee: ["archivee", "a_traiter"],
  annulee: ["archivee"],
  archivee: [],
};

/** Les étapes du suivi (frise d'avancement) : la position d'un statut sur la frise. */
export const ETAPES: { cle: string; label: string; statuts: ReservationStatus[] }[] = [
  { cle: "demande", label: "Demande", statuts: ["brouillon", "a_traiter", "en_traitement"] },
  { cle: "signature", label: "Signature", statuts: ["acceptee"] },
  { cle: "confirmation", label: "Confirmée", statuts: ["signee", "confirmee"] },
  { cle: "terminee", label: "Terminée", statuts: ["terminee", "archivee"] },
];

export const RESERVATION_SOURCES: Record<string, string> = {
  portail: "Portail",
  backoffice: "Back-office",
};

// ── Usagers ──
export const ORGANISATION_TYPES: Record<string, string> = {
  association: "Association",
  entreprise: "Entreprise",
  particulier: "Particulier",
  service_interne: "Service de la collectivité",
  collectivite: "Autre collectivité",
  autre: "Autre",
};
export const ORGANISATION_TYPE_TEINTES: Record<string, string> = {
  association: "emerald",
  entreprise: "sky",
  particulier: "amber",
  service_interne: "violet",
  collectivite: "rose",
  autre: "slate",
};

// ── Tarifs, options, matériel ──
export const TARIF_UNITES: Record<string, string> = {
  heure: "Par heure",
  demi_journee: "Demi-journée",
  journee: "Journée",
  soiree: "Soirée",
  weekend: "Week-end",
  forfait: "Forfait",
};
export const OPTION_UNITES: Record<string, string> = {
  forfait: "Forfait",
  heure: "Par heure",
  unite: "Par unité",
};
export const MATERIEL_UNITES: Record<string, string> = {
  gratuit: "Gratuit",
  forfait: "Forfait",
  unite: "Par unité",
  jour: "Par unité et par jour",
};

// ── Facturation ──
export const FACTURE_TYPES: Record<string, string> = {
  acompte: "Acompte",
  solde: "Solde",
  caution: "Caution",
  avoir: "Avoir",
  frais: "Frais d'annulation",
};
export const FACTURE_STATUS: Record<string, { label: string; teinte: string }> = {
  a_payer: { label: "À payer", teinte: "amber" },
  payee: { label: "Payée", teinte: "emerald" },
  annulee: { label: "Annulée", teinte: "slate" },
  remboursee: { label: "Remboursée", teinte: "sky" },
};
export const PAIEMENT_MODES: Record<string, string> = {
  regie: "Régie (sur place)",
  virement: "Virement",
  cheque: "Chèque",
  cb: "Carte bancaire",
  mandat: "Mandat administratif",
  gratuit: "Gratuité",
};

// ── Subventions ──
export const SUBVENTION_TYPES: Record<string, string> = {
  fonctionnement: "Fonctionnement",
  projet: "Projet",
  exceptionnelle: "Exceptionnelle",
  investissement: "Investissement",
};
export const SUBVENTION_STATUS: Record<string, { label: string; teinte: string }> = {
  brouillon: { label: "Brouillon", teinte: "slate" },
  deposee: { label: "Déposée", teinte: "amber" },
  instruction: { label: "En instruction", teinte: "sky" },
  avis: { label: "Avis des élus", teinte: "violet" },
  votee: { label: "Votée", teinte: "emerald" },
  refusee: { label: "Refusée", teinte: "red" },
  versee: { label: "Versée", teinte: "emerald" },
};
export const AVIS_LABELS: Record<string, { label: string; teinte: string }> = {
  favorable: { label: "Favorable", teinte: "emerald" },
  reserve: { label: "Avec réserve", teinte: "amber" },
  defavorable: { label: "Défavorable", teinte: "red" },
};

// ── Pièces jointes ──
export const DOCUMENT_KINDS: Record<string, string> = {
  photo: "Photo",
  reglement: "Règlement",
  plan: "Plan",
  piece: "Pièce justificative",
  convention: "Convention",
  avenant: "Avenant",
  facture: "Facture",
  etat_des_lieux: "État des lieux",
  attestation: "Attestation de valorisation",
  statuts: "Statuts",
  assurance: "Attestation d'assurance",
  autre: "Autre",
};
/** Parent → (colonne de rattachement, catégorie de droits). */
export const DOCUMENT_PARENTS: Record<string, [string, PermissionCategory]> = {
  site: ["siteId", "espaces"],
  espace: ["espaceId", "espaces"],
  materiel: ["materielId", "materiel"],
  organisation: ["organisationId", "usagers"],
  reservation: ["reservationId", "reservations"],
  subvention: ["subventionId", "subventions"],
  etat_des_lieux: ["etatDesLieuxId", "reservations"],
};

// ── Espaces ──
export const ESPACE_STATUS: Record<string, { label: string; teinte: string }> = {
  actif: { label: "Actif", teinte: "emerald" },
  inactif: { label: "Inactif", teinte: "slate" },
  maintenance: { label: "En travaux", teinte: "amber" },
};
export const JOURS_ISO: { iso: number; court: string; long: string }[] = [
  { iso: 1, court: "Lun.", long: "Lundi" },
  { iso: 2, court: "Mar.", long: "Mardi" },
  { iso: 3, court: "Mer.", long: "Mercredi" },
  { iso: 4, court: "Jeu.", long: "Jeudi" },
  { iso: 5, court: "Ven.", long: "Vendredi" },
  { iso: 6, court: "Sam.", long: "Samedi" },
  { iso: 7, court: "Dim.", long: "Dimanche" },
];
export const COULEURS_ESPACE = [
  "#e8336d",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
];

// ── Référentiels ──
export const REFERENTIAL_KINDS: Record<string, string> = {
  espace_nature: "Natures d'espace",
  evenement_nature: "Natures d'événement",
  equipement: "Équipements d'un espace",
  profil: "Profils tarifaires",
  materiel_categorie: "Catégories de matériel",
  doc_categorie: "Catégories de pièces",
  contrat_type: "Types de contrat du personnel",
  absence_motif: "Motifs d'absence du personnel",
};
export const REFERENTIAL_SEEDS: Record<string, { label: string; code?: string; icon?: string }[]> =
  {
    espace_nature: [
      { label: "Salle de réunion", icon: "users" },
      { label: "Salle polyvalente", icon: "door-open" },
      { label: "Salle des fêtes", icon: "party-popper" },
      { label: "Auditorium", icon: "theater" },
      { label: "Gymnase", icon: "dumbbell" },
      { label: "Stade / terrain", icon: "flag" },
      { label: "Piscine", icon: "waves" },
      { label: "Dojo", icon: "dumbbell" },
      { label: "Salle de danse", icon: "music" },
      { label: "Atelier", icon: "wrench" },
      { label: "Bureau", icon: "building-2" },
      { label: "Espace extérieur", icon: "trees" },
      { label: "Chapiteau / barnum", icon: "store" },
    ],
    evenement_nature: [
      { label: "Réunion" },
      { label: "Assemblée générale" },
      { label: "Formation" },
      { label: "Activité sportive" },
      { label: "Activité culturelle" },
      { label: "Spectacle" },
      { label: "Fête familiale" },
      { label: "Séminaire" },
      { label: "Conférence" },
      { label: "Exposition" },
      { label: "Vide-grenier / brocante" },
      { label: "Autre" },
    ],
    equipement: [
      { label: "Wi-Fi", icon: "wifi" },
      { label: "Vidéoprojecteur", icon: "projector" },
      { label: "Écran", icon: "tv" },
      { label: "Sonorisation", icon: "speaker" },
      { label: "Micro", icon: "mic" },
      { label: "Cuisine", icon: "utensils" },
      { label: "Réfrigérateur", icon: "snowflake" },
      { label: "Tables", icon: "table" },
      { label: "Chaises", icon: "armchair" },
      { label: "Scène", icon: "theater" },
      { label: "Vestiaires", icon: "door-open" },
      { label: "Douches", icon: "waves" },
      { label: "Parking", icon: "car" },
      { label: "Accès PMR", icon: "accessibility" },
      { label: "Climatisation", icon: "snowflake" },
      { label: "Chauffage", icon: "flame" },
      { label: "Tableau blanc", icon: "clipboard" },
      { label: "Piano", icon: "music" },
    ],
    profil: [
      { label: "Particulier de la commune", code: "particulier_commune" },
      { label: "Particulier extérieur", code: "particulier_exterieur" },
      { label: "Association de la commune", code: "association_commune" },
      { label: "Association extérieure", code: "association_exterieure" },
      { label: "Entreprise", code: "entreprise" },
      { label: "Service de la collectivité", code: "service_interne" },
      { label: "Autre collectivité", code: "collectivite" },
    ],
    materiel_categorie: [
      { label: "Mobilier", icon: "armchair" },
      { label: "Vaisselle", icon: "utensils" },
      { label: "Électronique", icon: "plug-zap" },
      { label: "Véhicule", icon: "car" },
      { label: "Signalétique", icon: "flag" },
      { label: "Autre", icon: "package" },
    ],
    doc_categorie: [
      { label: "Attestation d'assurance" },
      { label: "Statuts" },
      { label: "Pièce d'identité" },
      { label: "Justificatif de domicile" },
      { label: "Convention" },
      { label: "Facture" },
      { label: "Règlement intérieur" },
      { label: "Plan" },
      { label: "Programme de l'événement" },
      { label: "Autre" },
    ],
    contrat_type: [
      { label: "Fonctionnaire titulaire", code: "titulaire" },
      { label: "Fonctionnaire stagiaire", code: "stagiaire" },
      { label: "Contractuel CDD", code: "cdd" },
      { label: "Contractuel CDI", code: "cdi" },
      { label: "Vacataire", code: "vacataire" },
      { label: "Apprenti", code: "apprenti" },
      { label: "Mis à disposition", code: "mad" },
    ],
    absence_motif: [
      { label: "Congés annuels", code: "conges", icon: "sun" },
      { label: "RTT", code: "rtt", icon: "calendar-minus" },
      { label: "Maladie", code: "maladie", icon: "thermometer" },
      { label: "Formation", code: "formation", icon: "graduation-cap" },
      { label: "Récupération", code: "recuperation", icon: "clock" },
      { label: "Autre", code: "autre" },
    ],
  };

/** Ordre d'affichage des listes : le plus critique en premier, le sain en dernier. */
export const STATUS_RANK: Record<string, number> = { danger: 0, warning: 1, info: 2, success: 3 };
export function statusRank(status: string | null | undefined): number {
  return status != null && status in STATUS_RANK ? STATUS_RANK[status] : 4;
}
