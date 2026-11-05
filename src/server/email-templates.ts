/**
 * Modèles de courriel : valeurs de départ (semées en base, modifiables depuis Paramètres)
 * et rendu des {{variables}}. Le corps est du HTML simple ; les variables sont échappées.
 */

export type ModeleSeed = {
  key: string;
  label: string;
  subject: string;
  body: string;
  aide: string;
};

const SIGNATURE = "<p>Cordialement,<br>{{collectivite}}</p>";

export const EMAIL_TEMPLATE_SEEDS: ModeleSeed[] = [
  {
    key: "reservation_recue",
    label: "Demande reçue (usager)",
    subject: "Votre demande de réservation {{numero}} a bien été reçue",
    body:
      '<p>Bonjour {{prenom}},</p><p>Nous avons bien reçu votre demande de réservation <strong>{{numero}}</strong> pour <strong>{{espace}}</strong> ({{dates}}).</p><p>Elle sera examinée dans les meilleurs délais. Vous pouvez suivre son avancement et échanger avec nos services depuis votre espace : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Envoyé à l'usager dès le dépôt de sa demande.",
  },
  {
    key: "reservation_nouvelle_agent",
    label: "Nouvelle demande (agents)",
    subject: "Nouvelle demande {{numero}} · {{espace}} · {{dates}}",
    body: '<p>Une nouvelle demande de réservation vient d\'être déposée.</p><ul><li>Dossier : <strong>{{numero}}</strong></li><li>Espace : {{espace}}</li><li>Dates : {{dates}}</li><li>Demandeur : {{demandeur}} ({{organisation}})</li><li>Objet : {{titre}}</li></ul><p><a href="{{lien}}">Traiter la demande</a></p>',
    aide: "Envoyé aux agents en charge de l'espace.",
  },
  {
    key: "reservation_infos",
    label: "Informations demandées (usager)",
    subject: "Votre demande {{numero}} : des précisions sont nécessaires",
    body:
      '<p>Bonjour {{prenom}},</p><p>Pour instruire votre demande <strong>{{numero}}</strong> ({{espace}}, {{dates}}), nous avons besoin de précisions :</p><blockquote>{{message}}</blockquote><p>Répondez directement depuis votre espace : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Envoyé quand un agent passe la demande « en traitement » avec un message.",
  },
  {
    key: "reservation_acceptee",
    label: "Demande acceptée (usager)",
    subject: "Votre demande {{numero}} est acceptée",
    body:
      '<p>Bonjour {{prenom}},</p><p>Bonne nouvelle : votre demande <strong>{{numero}}</strong> pour <strong>{{espace}}</strong> ({{dates}}) est acceptée.</p><p>{{suite}}</p><p>Retrouvez votre dossier : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "La variable {{suite}} indique l'étape suivante (signature, paiement ou rien).",
  },
  {
    key: "convention_a_signer",
    label: "Convention à signer (usager)",
    subject: "Convention à signer pour la réservation {{numero}}",
    body:
      '<p>Bonjour {{prenom}},</p><p>La convention de mise à disposition de <strong>{{espace}}</strong> ({{dates}}) est prête. Merci de la lire puis de la signer électroniquement depuis votre espace : <a href="{{lien}}">{{lien}}</a></p><p>Votre code de signature vous sera adressé au moment de la signature.</p>' +
      SIGNATURE,
    aide: "Envoyé à l'acceptation quand la signature électronique est active.",
  },
  {
    key: "signature_code",
    label: "Code de signature (usager)",
    subject: "Votre code de signature : {{code}}",
    body:
      "<p>Bonjour {{prenom}},</p><p>Votre code pour signer la convention <strong>{{numero}}</strong> est : <strong style=\"font-size:1.4em;letter-spacing:.2em\">{{code}}</strong></p><p>Il est valable {{validite}}. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>" +
      SIGNATURE,
    aide: "Code à usage unique, envoyé par courriel si le SMS n'est pas disponible.",
  },
  {
    key: "reservation_signee",
    label: "Convention signée (usager)",
    subject: "Convention {{numero}} signée",
    body:
      '<p>Bonjour {{prenom}},</p><p>Votre convention pour <strong>{{espace}}</strong> ({{dates}}) a bien été signée le {{date_signature}}. Vous la retrouverez dans votre espace : <a href="{{lien}}">{{lien}}</a></p><p>{{suite}}</p>' +
      SIGNATURE,
    aide: "Accusé de signature.",
  },
  {
    key: "reservation_confirmee",
    label: "Réservation confirmée (usager)",
    subject: "Réservation {{numero}} confirmée : {{espace}}, {{dates}}",
    body:
      '<p>Bonjour {{prenom}},</p><p>Votre réservation <strong>{{numero}}</strong> est confirmée.</p><ul><li>Espace : {{espace}}</li><li>Dates : {{dates}}</li><li>Consignes : {{consignes}}</li></ul><p>Dossier : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Tout est en ordre : l'espace est réservé.",
  },
  {
    key: "reservation_refusee",
    label: "Demande refusée (usager)",
    subject: "Votre demande {{numero}} n'a pas pu être acceptée",
    body:
      "<p>Bonjour {{prenom}},</p><p>Nous sommes au regret de ne pas pouvoir donner suite à votre demande <strong>{{numero}}</strong> pour <strong>{{espace}}</strong> ({{dates}}).</p><p>Motif : {{motif}}</p><p>N'hésitez pas à déposer une nouvelle demande sur un autre créneau ou un autre espace.</p>" +
      SIGNATURE,
    aide: "Le motif saisi par l'agent est repris dans {{motif}}.",
  },
  {
    key: "reservation_annulee",
    label: "Réservation annulée",
    subject: "Réservation {{numero}} annulée",
    body:
      "<p>Bonjour {{prenom}},</p><p>La réservation <strong>{{numero}}</strong> ({{espace}}, {{dates}}) est annulée.</p><p>Motif : {{motif}}</p>" +
      SIGNATURE,
    aide: "Envoyé à l'usager, qu'il soit ou non à l'origine de l'annulation.",
  },
  {
    key: "fermeture_exceptionnelle",
    label: "Fermeture exceptionnelle (usager)",
    subject: "Fermeture exceptionnelle de {{espace}} : votre réservation {{numero}}",
    body:
      '<p>Bonjour {{prenom}},</p><p>{{espace}} sera exceptionnellement fermé ({{fermeture}}). Motif : {{motif}}.</p><p>Votre réservation <strong>{{numero}}</strong> est concernée : {{occurrences}}.</p><p>{{suite}}</p><p>Pour convenir d\'un report, répondez-nous depuis votre dossier : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Envoyé aux usagers dont des créneaux tombent pendant une fermeture exceptionnelle. {{occurrences}} liste les créneaux concernés, {{suite}} dit s'ils sont annulés.",
  },
  {
    key: "creneaux_modifies",
    label: "Créneaux modifiés (usager)",
    subject: "Réservation {{numero}} : nouveaux horaires",
    body:
      '<p>Bonjour {{prenom}},</p><p>Les horaires de votre réservation <strong>{{numero}}</strong> ({{titre}}, {{espace}}) ont été modifiés par nos services : {{modifications}}.</p><p>{{suite}}</p><p>Votre dossier à jour : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Envoyé à l'usager quand un agent déplace un ou plusieurs créneaux de son dossier. {{modifications}} liste les anciens et nouveaux horaires, {{suite}} dit si le montant change.",
  },
  {
    key: "avenant_a_signer",
    label: "Avenant à signer (usager)",
    subject: "Avenant {{avenant}} à votre convention {{numero}}",
    body:
      '<p>Bonjour {{prenom}},</p><p>Les créneaux de votre réservation <strong>{{numero}}</strong> ({{titre}}, {{espace}}) ont changé après la signature de la convention. L\'avenant {{avenant}} ci-joint formalise cette modification : {{objet}}.</p><p>{{suite}}</p><p>Votre dossier : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Envoyé avec le PDF de l'avenant quand les créneaux d'une convention signée sont modifiés, puis en relance. {{objet}} décrit la modification, {{suite}} explique comment signer.",
  },
  {
    key: "avenant_code",
    label: "Code de signature d'un avenant (usager)",
    subject: "Votre code de signature : {{code}}",
    body:
      "<p>Bonjour {{prenom}},</p><p>Votre code pour signer l'avenant {{avenant}} à la convention <strong>{{numero}}</strong> est : <strong style=\"font-size:1.4em;letter-spacing:.2em\">{{code}}</strong></p><p>Il est valable {{validite}}. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>" +
      SIGNATURE,
    aide: "Code à usage unique pour un avenant, envoyé par courriel si le SMS n'est pas disponible.",
  },
  {
    key: "avenant_signe",
    label: "Avenant signé (usager)",
    subject: "Avenant {{avenant}} à la convention {{numero}} signé",
    body:
      '<p>Bonjour {{prenom}},</p><p>L\'avenant {{avenant}} à la convention <strong>{{numero}}</strong> est signé le {{date_signature}}. Le document signé est disponible dans votre dossier : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Confirmation envoyée après la signature d'un avenant, en ligne ou sur papier.",
  },
  {
    key: "campagne_decisions",
    label: "Campagne de créneaux : décisions (usager)",
    subject: "{{campagne}} : réponse à vos vœux de créneaux",
    body:
      '<p>Bonjour {{prenom}},</p><p>La collectivité a arbitré les vœux de créneaux déposés par {{organisation}} pour la campagne <strong>{{campagne}}</strong>.</p><p style="white-space:pre-line">{{attribues}}</p><p style="white-space:pre-line">{{refuses}}</p><p>{{suite}}</p><p>Vos réservations : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Un seul courriel par organisation, envoyé depuis la campagne une fois les décisions prises. {{attribues}} et {{refuses}} listent les créneaux (une ligne par vœu, avec le dossier ou le motif), {{suite}} dit quoi faire ensuite.",
  },
  {
    key: "message_recu",
    label: "Nouveau message",
    subject: "Nouveau message sur la réservation {{numero}}",
    body:
      '<p>Bonjour {{prenom}},</p><p>{{auteur}} vous a écrit au sujet de la réservation <strong>{{numero}}</strong> :</p><blockquote>{{message}}</blockquote><p>Répondre : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Envoyé à l'autre partie à chaque message du fil de discussion.",
  },
  {
    key: "rappel_j7",
    label: "Rappel J-7 (usager)",
    subject: "Dans 7 jours : {{espace}}, {{dates}}",
    body:
      '<p>Bonjour {{prenom}},</p><p>Votre réservation <strong>{{numero}}</strong> approche : <strong>{{espace}}</strong>, {{dates}}.</p><p>Consignes d\'accès : {{consignes}}</p><p>Dossier : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Rappel une semaine avant l'événement.",
  },
  {
    key: "rappel_j1",
    label: "Rappel J-1 (usager)",
    subject: "C'est demain : {{espace}}, {{dates}}",
    body:
      "<p>Bonjour {{prenom}},</p><p>Petit rappel : votre réservation <strong>{{numero}}</strong> a lieu demain, <strong>{{espace}}</strong>, {{dates}}.</p><p>Consignes d'accès : {{consignes}}</p>" +
      SIGNATURE,
    aide: "Rappel la veille de l'événement.",
  },
  {
    key: "facture_emise",
    label: "Facture émise (usager)",
    subject: "{{type_facture}} {{numero_facture}} · réservation {{numero}}",
    body:
      '<p>Bonjour {{prenom}},</p><p>Une {{type_facture}} d\'un montant de <strong>{{montant}}</strong> a été émise pour votre réservation <strong>{{numero}}</strong> ({{espace}}, {{dates}}). Échéance : {{echeance}}.</p><p>Modalités de règlement : {{modalites}}</p><p>Dossier : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Envoyé à l'émission d'une facture.",
  },
  {
    key: "paiement_recu",
    label: "Paiement reçu (usager)",
    subject: "Paiement reçu pour {{numero_facture}}",
    body:
      "<p>Bonjour {{prenom}},</p><p>Nous avons bien reçu votre règlement de <strong>{{montant}}</strong> ({{numero_facture}}). Merci.</p>" +
      SIGNATURE,
    aide: "Accusé de paiement.",
  },
  {
    key: "compte_cree",
    label: "Compte créé (usager)",
    subject: "Bienvenue sur l'espace réservation de {{collectivite}}",
    body:
      '<p>Bonjour {{prenom}},</p><p>Votre compte est créé. Vous pouvez dès maintenant consulter les espaces disponibles et déposer vos demandes : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Envoyé à l'inscription sur le portail ou à la création par un agent.",
  },
  {
    key: "compte_valide",
    label: "Organisation validée (usager)",
    subject: "Votre organisation {{organisation}} est validée",
    body:
      "<p>Bonjour {{prenom}},</p><p>La fiche de <strong>{{organisation}}</strong> a été validée par nos services. Vous bénéficiez désormais des conditions et tarifs de votre profil.</p>" +
      SIGNATURE,
    aide: "Envoyé quand un agent valide une organisation.",
  },
  {
    key: "subvention_recue",
    label: "Demande de subvention reçue",
    subject: "Votre demande de subvention {{numero}} est enregistrée",
    body:
      "<p>Bonjour {{prenom}},</p><p>Votre demande de subvention <strong>{{numero}}</strong> ({{objet}}, {{montant}}) est bien enregistrée pour l'exercice {{exercice}}. Vous serez informé de son instruction.</p>" +
      SIGNATURE,
    aide: "Module ASSO.",
  },
  {
    key: "subvention_decision",
    label: "Décision sur une subvention",
    subject: "Décision sur votre demande de subvention {{numero}}",
    body:
      "<p>Bonjour {{prenom}},</p><p>Votre demande <strong>{{numero}}</strong> ({{objet}}) a fait l'objet d'une décision : <strong>{{decision}}</strong>. {{montant_accorde}}</p><p>{{note}}</p>" +
      SIGNATURE,
    aide: "Module ASSO : vote ou refus.",
  },
  {
    key: "digest_agents",
    label: "Récapitulatif quotidien (agents)",
    subject: "CityRésa · {{date}} : {{nb_a_traiter}} demande(s) à traiter",
    body: '<p>Bonjour,</p><p>Au {{date}} :</p><ul><li>{{nb_a_traiter}} demande(s) à traiter</li><li>{{nb_messages}} message(s) sans réponse</li><li>{{nb_signatures}} convention(s) en attente de signature</li><li>{{nb_factures}} facture(s) à encaisser</li><li>{{nb_aujourdhui}} réservation(s) aujourd\'hui</li></ul><p><a href="{{lien}}">Ouvrir le tableau de bord</a></p>',
    aide: "Envoyé chaque matin aux agents qui ont choisi de le recevoir.",
  },
  {
    key: "piece_expiration",
    label: "Pièce justificative à renouveler (usager)",
    subject: "{{piece}} : {{echeance}}",
    body:
      '<p>Bonjour,</p><p>La pièce <strong>{{piece}}</strong> de <strong>{{organisation}}</strong> {{echeance_phrase}}.</p><p>Merci de déposer la nouvelle version depuis votre espace : <a href="{{lien}}">{{lien}}</a></p>' +
      SIGNATURE,
    aide: "Envoyé à l'approche de la fin de validité d'une pièce datée (attestation d'assurance…), puis le jour de son expiration.",
  },
  {
    key: "mot_de_passe",
    label: "Réinitialisation du mot de passe",
    subject: "Réinitialisation de votre mot de passe",
    body:
      "<p>Bonjour {{prenom}},</p><p>Pour choisir un nouveau mot de passe, suivez ce lien (valable une heure) : <a href=\"{{lien}}\">{{lien}}</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>" +
      SIGNATURE,
    aide: "Lien de réinitialisation.",
  },
];

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Remplace les {{variables}} (valeurs échappées ; `{{{brut}}}` pour du HTML de confiance). */
export function rendre(
  modele: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return modele
    .replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, (_, k: string) => String(vars[k] ?? ""))
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => escapeHtml(String(vars[k] ?? "")));
}

/** Le texte brut d'un corps HTML (version alternative des courriels). */
export function versTexte(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|blockquote|h\d)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_, h: string, t: string) =>
      t === h ? h : `${t} (${h})`,
    )
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
