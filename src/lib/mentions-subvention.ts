/**
 * Les mentions du dossier de demande de subvention de la Ville qui ne sont pas des rubriques à
 * remplir : la mention pénale de l'attestation, le délai de retour du bilan, la notice sur les
 * données personnelles et les coordonnées du service qui accompagne les associations. Logique
 * PURE : testée dans mentions-subvention.test.ts.
 */

/** Sous l'attestation sur l'honneur, à l'écran et dans le PDF du dossier. */
export const MENTION_FAUSSE_DECLARATION =
  "Toute fausse déclaration est passible des peines d'emprisonnement et d'amendes prévues par les articles 441-6 et 441-7 du code pénal.";

/** Sur la fiche « Bilan » : l'obligation de l'article 10 de la loi n° 2000-321. */
export const DELAI_BILAN =
  "Le bilan des actions est à retourner dans les six mois qui suivent la fin de l'exercice au titre duquel la subvention a été accordée, avec le dernier rapport annuel d'activité et les comptes approuvés du dernier exercice clos (article 10 de la loi n° 2000-321 du 12 avril 2000).";

export type ReglagesService = {
  COLLECTIVITE_NOM: string;
  COLLECTIVITE_ADRESSE: string;
  COLLECTIVITE_EMAIL: string;
  COLLECTIVITE_TELEPHONE: string;
  SUBVENTIONS_SERVICE_NOM: string;
  SUBVENTIONS_SERVICE_EMAIL: string;
  SUBVENTIONS_SERVICE_TELEPHONE: string;
};

export type ContactService = { nom: string; email: string; telephone: string };

/**
 * Le service à contacter pour un dossier de subvention : ses propres coordonnées, à défaut
 * celles de la collectivité.
 */
export function contactService(cfg: ReglagesService): ContactService {
  return {
    nom: cfg.SUBVENTIONS_SERVICE_NOM.trim() || cfg.COLLECTIVITE_NOM.trim(),
    email: cfg.SUBVENTIONS_SERVICE_EMAIL.trim() || cfg.COLLECTIVITE_EMAIL.trim(),
    telephone: cfg.SUBVENTIONS_SERVICE_TELEPHONE.trim() || cfg.COLLECTIVITE_TELEPHONE.trim(),
  };
}

/** « Service de la vie associative · asso@… · 01 … » : le contact sur une ligne. */
export function ligneContact(c: ContactService): string {
  return [c.nom, c.email, c.telephone].filter(Boolean).join(" · ");
}

export type ParagrapheNotice = { titre: string; texte: string };

/**
 * La notice d'information sur les données personnelles recueillies par le dossier (règlement
 * européen 2016/679 et loi « informatique et libertés »), reprise du dossier de la Ville.
 */
export function noticeDonnees(cfg: ReglagesService): ParagrapheNotice[] {
  const service = contactService(cfg);
  const collectivite = cfg.COLLECTIVITE_NOM.trim();
  const adresse = [cfg.COLLECTIVITE_ADRESSE.trim(), cfg.COLLECTIVITE_EMAIL.trim()]
    .filter(Boolean)
    .join(", ");
  return [
    {
      titre: "Responsable du traitement",
      texte: `Les informations recueillies dans ce dossier sont enregistrées par la collectivité (${collectivite}) dans un fichier informatisé.`,
    },
    {
      titre: "Finalités",
      texte:
        "Elles servent à accompagner l'association dans sa démarche, à instruire sa demande de subvention et à lui notifier la réponse.",
    },
    {
      titre: "Base légale",
      texte: "Le traitement se fonde sur l'exécution d'une mission d'intérêt public.",
    },
    {
      titre: "Destinataires",
      texte: `Elles sont communiquées uniquement au service instructeur (${service.nom}) et aux élus appelés à donner un avis. Elles ne sont ni cédées, ni échangées, ni revendues à des tiers.`,
    },
    {
      titre: "Durée de conservation",
      texte:
        "Elles sont conservées pendant la durée nécessaire à l'instruction de la demande (un an), puis archivées selon les durées réglementaires.",
    },
    {
      titre: "Vos droits",
      texte: `Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation et d'opposition pour motifs légitimes. Ils s'exercent sur simple demande auprès de la collectivité (${[collectivite, adresse].filter(Boolean).join(", ")}). Si vous estimez, après cette demande, que vos droits ne sont pas respectés, vous pouvez saisir la CNIL.`,
    },
  ];
}
