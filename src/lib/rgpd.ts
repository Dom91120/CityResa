/**
 * RGPD : durées de conservation, anonymisation des comptes usagers inactifs (après un
 * préavis par courriel) ou à leur demande, purge des données personnelles des dossiers
 * archivés au-delà de la durée de conservation, et export des données d'un usager.
 * Logique PURE : testée dans rgpd.test.ts.
 */
import { STATUTS_OCCUPANTS } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";

export const JOUR_MS = 86_400_000;

export type ReglesRgpd = {
  /** Mois sans connexion avant anonymisation (0 = jamais). */
  inactiviteMois: number;
  /** Jours entre le préavis et l'anonymisation. */
  preavisJours: number;
  /** Années de conservation d'un dossier archivé (0 = jamais purgé). */
  conservationAnnees: number;
};

export function reglesDe(cfg: {
  RGPD_INACTIVITE_MOIS: number;
  RGPD_PREAVIS_JOURS: number;
  RGPD_CONSERVATION_ANNEES: number;
}): ReglesRgpd {
  return {
    inactiviteMois: Math.max(0, cfg.RGPD_INACTIVITE_MOIS || 0),
    preavisJours: Math.max(1, cfg.RGPD_PREAVIS_JOURS || 30),
    conservationAnnees: Math.max(0, cfg.RGPD_CONSERVATION_ANNEES || 0),
  };
}

export type CompteInactivite = {
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  inactivitePreavisAt: Date | null;
  anonymiseAt: Date | null;
};

/** La dernière activité connue : dernière connexion, sinon création du compte. */
export function derniereActivite(u: { createdAt: Date; lastLoginAt: Date | null }): Date {
  return u.lastLoginAt && u.lastLoginAt > u.createdAt ? u.lastLoginAt : u.createdAt;
}

/** `mois` mois avant `now`. */
export function seuilInactivite(mois: number, now: Date): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - mois);
  return d;
}

export type EtatInactivite =
  | "actif"
  | "a_prevenir"
  | "en_preavis"
  | "a_anonymiser"
  | "anonymise"
  | "jamais";

/**
 * Où en est un compte vis-à-vis de l'inactivité. Un compte désactivé par un agent est
 * anonymisé sans préavis (son titulaire ne peut plus se connecter) ; un compte actif reçoit
 * d'abord un courriel, puis est anonymisé `preavisJours` plus tard s'il ne s'est pas reconnecté.
 */
export function etatInactivite(
  u: CompteInactivite,
  regles: ReglesRgpd,
  now = new Date(),
): EtatInactivite {
  if (u.anonymiseAt) return "anonymise";
  if (!regles.inactiviteMois) return "jamais";
  if (derniereActivite(u) >= seuilInactivite(regles.inactiviteMois, now)) return "actif";
  if (!u.isActive) return "a_anonymiser";
  if (!u.inactivitePreavisAt) return "a_prevenir";
  const echeance = u.inactivitePreavisAt.getTime() + regles.preavisJours * JOUR_MS;
  return echeance <= now.getTime() ? "a_anonymiser" : "en_preavis";
}

/** La date à laquelle un compte prévenu aujourd'hui sera anonymisé. */
export function dateAnonymisation(preavisAt: Date, regles: ReglesRgpd): Date {
  return new Date(preavisAt.getTime() + regles.preavisJours * JOUR_MS);
}

/** Ce qui empêche d'anonymiser un compte maintenant (un seul libellé par obstacle). */
export function obstaclesAnonymisation(o: {
  dossiersEnCours: number;
  facturesImpayees: number;
}): string[] {
  const r: string[] = [];
  if (o.dossiersEnCours)
    r.push(
      o.dossiersEnCours === 1
        ? "un dossier de réservation est encore en cours"
        : `${o.dossiersEnCours} dossiers de réservation sont encore en cours`,
    );
  if (o.facturesImpayees)
    r.push(
      o.facturesImpayees === 1
        ? "une facture reste à payer"
        : `${o.facturesImpayees} factures restent à payer`,
    );
  return r;
}

export function phraseObstacles(obstacles: string[]): string {
  if (!obstacles.length) return "";
  const liste = obstacles.join(" et ");
  return `Impossible pour le moment : ${liste}.`;
}

/** Un dossier « en cours » retient le compte : il occupe ou va occuper un espace. */
export function dossierEnCours(r: { status: string; endAt: Date }, now = new Date()): boolean {
  if (["a_traiter", "en_traitement", "acceptee", "signee"].includes(r.status)) return true;
  return (STATUTS_OCCUPANTS as string[]).includes(r.status) && r.endAt > now;
}

/** Les valeurs qui remplacent l'identité d'un compte anonymisé (l'identifiant reste unique). */
export function valeursAnonymes(id: string, now = new Date()) {
  const suffixe = id.slice(-8);
  return {
    email: `anonyme-${suffixe}@anonymise.invalid`,
    emailVerified: false,
    name: "Usager anonymisé",
    firstName: "Usager",
    lastName: "anonymisé",
    phone: null,
    fonction: null,
    image: null,
    isActive: false,
    icsToken: null,
    dashboardPrefs: null,
    listPrefs: null,
    notifEmail: false,
    twoFactorEnabled: false,
    inactivitePreavisAt: null,
    anonymiseAt: now,
  };
}

/**
 * Ce qu'une organisation perd quand son dernier membre est anonymisé : les coordonnées
 * de personnes physiques. Un particulier est une personne : son nom et son adresse
 * disparaissent aussi ; une association ou une entreprise garde sa raison sociale.
 */
export function valeursOrganisationAnonyme(org: { id: number; type: string }) {
  const particulier = org.type === "particulier";
  return {
    legalFirstName: null,
    legalLastName: null,
    legalAppointedAt: null,
    phone: null,
    email: null,
    notes: null,
    isActive: false,
    ...(particulier
      ? { name: `Particulier anonymisé n°${org.id}`, address: null, postalCode: null, city: null }
      : {}),
  };
}

/** Un dossier archivé dont la conservation est échue : ses données personnelles sont à purger. */
export function dossierAPurger(
  r: { status: string; endAt: Date; purgeAt: Date | null },
  regles: ReglesRgpd,
  now = new Date(),
): boolean {
  if (r.purgeAt || !regles.conservationAnnees) return false;
  if (!["archivee", "terminee", "refusee", "annulee"].includes(r.status)) return false;
  const limite = new Date(now);
  limite.setFullYear(limite.getFullYear() - regles.conservationAnnees);
  return r.endAt < limite;
}

/** Les champs d'un dossier purgé : on garde l'espace, les dates et les montants (statistiques). */
export const CHAMPS_PURGES = {
  internalNotes: null,
  refusalReason: null,
  cancelReason: null,
  signerName: null,
  signerIp: null,
} as const;

/** La phrase d'information de l'usager sur son compte. */
export function decrireConservation(regles: ReglesRgpd): string {
  const parts: string[] = [];
  if (regles.inactiviteMois)
    parts.push(
      `Un compte sans connexion depuis ${regles.inactiviteMois} mois est anonymisé, après un courriel de préavis envoyé ${regles.preavisJours} jours avant.`,
    );
  else parts.push("Votre compte est conservé tant que vous ne demandez pas sa suppression.");
  if (regles.conservationAnnees)
    parts.push(
      `Les dossiers de réservation terminés sont conservés ${regles.conservationAnnees} an${regles.conservationAnnees > 1 ? "s" : ""} ; au-delà, les messages, pièces et notes qui s'y rattachent sont effacés.`,
    );
  return parts.join(" ");
}

// ── Export des données d'un usager ──

type Dossier = {
  numero: string;
  title: string;
  status: string;
  startAt: Date;
  endAt: Date;
  montantTtc: number;
  gratuit: boolean;
  createdAt: Date;
  espace: { name: string };
  creneaux: { startAt: Date; endAt: Date; status: string }[];
};

export type SourcesExport = {
  user: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    fonction: string | null;
    createdAt: Date;
    lastLoginAt: Date | null;
    acceptedCguAt: Date | null;
    notifEmail: boolean;
  };
  organisation: {
    name: string;
    type: string;
    siret: string | null;
    rna: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    email: string | null;
    phone: string | null;
    legalFirstName: string | null;
    legalLastName: string | null;
  } | null;
  reservations: Dossier[];
  messages: { createdAt: Date; body: string; reservation: { numero: string } }[];
  documents: { filename: string; kind: string; title: string | null; createdAt: Date }[];
  voeux: {
    createdAt: Date;
    title: string;
    status: string;
    espace: { name: string };
    campagne: { label: string };
  }[];
  listeAttente: { createdAt: Date; startAt: Date; endAt: Date; espace: { name: string } }[];
  factures: {
    numero: string;
    libelle: string;
    montantTtc: number;
    status: string;
    createdAt: Date;
  }[];
  subventions: { numero: string; exercice: number; objet: string; status: string }[];
  notifications: { createdAt: Date; title: string }[];
  courriels: { sentAt: Date; subject: string }[];
  journal: { createdAt: Date; action: string; detail: string | null }[];
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Le document remis à l'usager (article 15 et 20 du RGPD) : lisible, sans identifiants techniques. */
export function construireExport(s: SourcesExport, now = new Date()) {
  return {
    exporte_le: now.toISOString(),
    compte: {
      courriel: s.user.email,
      prenom: s.user.firstName,
      nom: s.user.lastName,
      telephone: s.user.phone,
      fonction: s.user.fonction,
      cree_le: iso(s.user.createdAt),
      derniere_connexion: iso(s.user.lastLoginAt),
      conditions_acceptees_le: iso(s.user.acceptedCguAt),
      notifications_par_courriel: s.user.notifEmail,
    },
    organisation: s.organisation
      ? {
          nom: s.organisation.name,
          type: s.organisation.type,
          siret: s.organisation.siret,
          rna: s.organisation.rna,
          adresse: [
            s.organisation.address,
            [s.organisation.postalCode, s.organisation.city].filter(Boolean).join(" "),
          ]
            .filter(Boolean)
            .join(", "),
          courriel: s.organisation.email,
          telephone: s.organisation.phone,
          representant: [s.organisation.legalFirstName, s.organisation.legalLastName]
            .filter(Boolean)
            .join(" "),
        }
      : null,
    reservations: s.reservations.map((r) => ({
      numero: r.numero,
      objet: r.title,
      espace: r.espace.name,
      statut: r.status,
      du: iso(r.startAt),
      au: iso(r.endAt),
      montant_ttc: r.gratuit ? 0 : r.montantTtc,
      gratuit: r.gratuit,
      deposee_le: iso(r.createdAt),
      creneaux: r.creneaux.map((c) => ({
        debut: iso(c.startAt),
        fin: iso(c.endAt),
        statut: c.status,
      })),
    })),
    messages: s.messages.map((m) => ({
      dossier: m.reservation.numero,
      le: iso(m.createdAt),
      texte: m.body,
    })),
    pieces_deposees: s.documents.map((d) => ({
      fichier: d.filename,
      nature: d.kind,
      titre: d.title,
      le: iso(d.createdAt),
    })),
    voeux: s.voeux.map((v) => ({
      campagne: v.campagne.label,
      espace: v.espace.name,
      activite: v.title,
      statut: v.status,
      le: iso(v.createdAt),
    })),
    liste_attente: s.listeAttente.map((l) => ({
      espace: l.espace.name,
      debut: iso(l.startAt),
      fin: iso(l.endAt),
      inscrit_le: iso(l.createdAt),
    })),
    factures: s.factures.map((f) => ({
      numero: f.numero,
      libelle: f.libelle,
      montant_ttc: f.montantTtc,
      statut: f.status,
      le: iso(f.createdAt),
    })),
    subventions: s.subventions.map((x) => ({
      numero: x.numero,
      exercice: x.exercice,
      objet: x.objet,
      statut: x.status,
    })),
    notifications: s.notifications.map((n) => ({ le: iso(n.createdAt), titre: n.title })),
    courriels_recus: s.courriels.map((c) => ({ le: iso(c.sentAt), objet: c.subject })),
    journal: s.journal.map((j) => ({ le: iso(j.createdAt), action: j.action, detail: j.detail })),
  };
}

/** Nom du fichier d'export : « mes-donnees-cityresa-2026-11-05.json ». */
export function nomFichierExport(now = new Date()): string {
  return `mes-donnees-cityresa-${now.toISOString().slice(0, 10)}.json`;
}

export function libelleEtat(etat: EtatInactivite, u: CompteInactivite, regles: ReglesRgpd): string {
  switch (etat) {
    case "anonymise":
      return `Anonymisé le ${dateCourte(u.anonymiseAt)}`;
    case "en_preavis":
      return u.inactivitePreavisAt
        ? `Préavis envoyé, anonymisation le ${dateCourte(dateAnonymisation(u.inactivitePreavisAt, regles))}`
        : "Préavis envoyé";
    case "a_anonymiser":
      return "Inactif, anonymisation à la prochaine tâche";
    case "a_prevenir":
      return "Inactif, préavis à venir";
    default:
      return "";
  }
}
