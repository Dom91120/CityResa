/**
 * Les gestes du module ASSO (routes POST sous src/app/envoi/subventions) : dépôt,
 * modification, avis, transitions de statut, suppression.
 */
import { SUBVENTION_STATUS } from "@/lib/constantes";
import { estFiche } from "@/lib/dossier-subvention";
import { champ, champOuNull, idOuNull, parseInt_ } from "@/lib/forms-util";
import {
  changerStatutSubvention,
  donnerAvis,
  lireAvis,
  lireSubvention,
  lireTransition,
  modifierSubvention,
  peutDecider,
  REFUS_ELU,
  supprimerSubvention,
} from "@/modules/subventions/server";
import {
  changerStatutCampagne,
  creerCampagne,
  lireCampagne,
  modifierCampagne,
  supprimerCampagne,
} from "@/server/campagnes-subvention";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import type { CurrentUser } from "@/server/guards";
import { pasTrouve, redirection, redirigerAvecMessage, suite } from "@/server/http";
import {
  changerSecteur,
  contexteCampagne,
  creerBrouillon,
  demanderCodeDossier,
  deposerDossier,
  enregistrerFiche,
  lireCleFiche,
  renvoyerIncomplet,
  signerDossier,
} from "@/server/subventions-dossier";

function erreur(e: unknown, retour: string): Promise<Response> {
  if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
  throw e;
}

/** POST /subventions/[id]/modifier */
export async function modifier(user: CurrentUser, id: number, form: FormData): Promise<Response> {
  try {
    if (!peutDecider(user)) throw new UserFacingError(REFUS_ELU);
    await modifierSubvention(id, lireSubvention(form), user);
    return redirigerAvecMessage(`/subventions/${id}`, "Demande modifiée.", "success");
  } catch (e) {
    return erreur(e, `/subventions/${id}/modifier`);
  }
}

/** POST /subventions/[id]/avis */
export async function avis(user: CurrentUser, id: number, form: FormData): Promise<Response> {
  const retour = suite(form, `/subventions/${id}#avis`);
  try {
    await donnerAvis(id, lireAvis(form), user);
    return redirigerAvecMessage(retour, "Votre avis est enregistré.", "success");
  } catch (e) {
    return erreur(e, retour);
  }
}

/** POST /subventions/[id]/statut */
export async function statut(user: CurrentUser, id: number, form: FormData): Promise<Response> {
  const retour = suite(form, `/subventions/${id}`);
  try {
    if (!peutDecider(user)) throw new UserFacingError(REFUS_ELU);
    const { statut: nouveau, opts } = lireTransition(form);
    const s = await changerStatutSubvention(id, nouveau, user, opts);
    const messages: Record<string, string> = {
      instruction: `Demande ${s.numero} prise en instruction par ${user.name}.`,
      avis: `Demande ${s.numero} soumise aux avis des élus.`,
      votee: `Subvention ${s.numero} votée : l'association est prévenue.`,
      refusee: `Demande ${s.numero} refusée : l'association est prévenue.`,
      versee: `Subvention ${s.numero} marquée versée.`,
    };
    return redirigerAvecMessage(
      retour,
      messages[nouveau] ?? `Demande ${s.numero} : ${SUBVENTION_STATUS[nouveau]?.label ?? nouveau}.`,
      "success",
    );
  } catch (e) {
    return erreur(e, retour);
  }
}

/** POST /subventions/[id]/supprimer */
export async function supprimer(user: CurrentUser, id: number): Promise<Response> {
  try {
    const numero = await supprimerSubvention(id, user);
    return redirigerAvecMessage("/subventions", `Demande ${numero} supprimée.`, "success");
  } catch (e) {
    return erreur(e, `/subventions/${id}`);
  }
}

// ── Dossier de demande (fiches, signature, dépôt) ──

/** POST /subventions/nouvelle : commence le dossier d'une association (agent). */
export async function commencerDossier(user: CurrentUser, form: FormData): Promise<Response> {
  try {
    if (!peutDecider(user)) throw new UserFacingError(REFUS_ELU);
    const organisationId = idOuNull(form, "organisation_id");
    if (!organisationId) throw new UserFacingError("Choisissez l'association demandeuse.");
    const exercice = parseInt_(form.get("exercice"), null);
    if (!exercice || exercice < 2000 || exercice > 2100)
      throw new UserFacingError("Indiquez l'exercice de la subvention.");
    const campagne = await prisma.campagneSubvention.findUnique({ where: { exercice } });
    const nature = champ(form, "nature") === "premiere" ? "premiere" : "renouvellement";
    const s = await creerBrouillon(
      { organisationId, campagne, exercice, nature, parAgent: true },
      user,
    );
    return redirigerAvecMessage(
      `/subventions/${s.id}/dossier/presentation`,
      `Dossier ${s.exercice} de ${s.organisation.name} : remplissez les fiches puis déposez-le.`,
      "success",
    );
  } catch (e) {
    return erreur(e, "/subventions/nouvelle");
  }
}

/** Enregistre une fiche et poursuit (agent ou usager : l'appelant a vérifié les droits). */
export async function fiche(
  user: CurrentUser,
  id: number,
  ficheRaw: string,
  form: FormData,
  base: string,
): Promise<Response> {
  const retour = `${base}/${id}/dossier/${ficheRaw}`;
  try {
    const cle = lireCleFiche(ficheRaw);
    await enregistrerFiche(id, cle, form, user);
    const suiteFiche = champ(form, "suite");
    const vers = estFiche(suiteFiche) ? suiteFiche : cle;
    return redirigerAvecMessage(
      `${base}/${id}/dossier/${vers}`,
      vers === cle ? "Fiche enregistrée." : "Fiche enregistrée, passons à la suivante.",
      "success",
    );
  } catch (e) {
    return erreur(e, retour);
  }
}

/** POST /subventions/[id]/deposer : dépôt par un agent, dérogation hors période. */
export async function deposerAgent(
  user: CurrentUser,
  id: number,
  form: FormData,
): Promise<Response> {
  try {
    if (!peutDecider(user)) throw new UserFacingError(REFUS_ELU);
    const s = await deposerDossier(id, user, {
      parAgent: true,
      derogation: champOuNull(form, "derogation"),
    });
    return redirigerAvecMessage(
      `/subventions/${id}`,
      `Dossier ${s.numero} déposé pour ${s.organisation.name}.`,
      "success",
    );
  } catch (e) {
    return erreur(e, `/subventions/${id}/dossier/attestation`);
  }
}

/** POST /subventions/[id]/incomplet : renvoi à l'association. */
export async function incomplet(user: CurrentUser, id: number, form: FormData): Promise<Response> {
  try {
    if (!peutDecider(user)) throw new UserFacingError(REFUS_ELU);
    const s = await renvoyerIncomplet(id, champ(form, "motif"), user);
    return redirigerAvecMessage(
      `/subventions/${id}`,
      `Dossier ${s.numero} renvoyé à l'association comme incomplet.`,
      "success",
    );
  } catch (e) {
    return erreur(e, `/subventions/${id}`);
  }
}

/** POST /subventions/[id]/secteur : cadre réservé. */
export async function secteur(user: CurrentUser, id: number, form: FormData): Promise<Response> {
  try {
    await changerSecteur(id, form, user);
    return redirigerAvecMessage(`/subventions/${id}`, "Secteur enregistré.", "success");
  } catch (e) {
    return erreur(e, `/subventions/${id}`);
  }
}

// ── Campagnes ──

/** POST /subventions/campagnes/nouvelle */
export async function campagneNouvelle(user: CurrentUser, form: FormData): Promise<Response> {
  try {
    if (!peutDecider(user)) throw new UserFacingError(REFUS_ELU);
    const c = await creerCampagne(lireCampagne(form), user);
    return redirigerAvecMessage("/subventions/campagnes", `${c.label} créée.`, "success");
  } catch (e) {
    return erreur(e, "/subventions/campagnes");
  }
}

/** POST /subventions/campagnes/[id]/[action] : modifier, ouvrir, cloturer, reprendre, supprimer. */
export async function campagneAction(
  user: CurrentUser,
  id: number,
  action: string,
  form: FormData,
): Promise<Response> {
  const retour = "/subventions/campagnes";
  try {
    if (!peutDecider(user)) throw new UserFacingError(REFUS_ELU);
    if (action === "modifier") {
      await modifierCampagne(id, lireCampagne(form), user);
      return redirigerAvecMessage(retour, "Campagne modifiée.", "success");
    }
    if (action === "supprimer") {
      await supprimerCampagne(id, user);
      return redirigerAvecMessage(retour, "Campagne supprimée.", "success");
    }
    const statut: Record<string, string> = {
      ouvrir: "ouverte",
      cloturer: "cloturee",
      reprendre: "brouillon",
    };
    const nouveau = statut[action];
    if (!nouveau) return pasTrouve();
    await changerStatutCampagne(id, nouveau, user);
    return redirigerAvecMessage(
      retour,
      nouveau === "ouverte"
        ? "Campagne ouverte : les associations peuvent déposer pendant la période."
        : nouveau === "cloturee"
          ? "Campagne clôturée : plus de dépôt sur le portail."
          : "Campagne remise en préparation.",
      "success",
    );
  } catch (e) {
    return erreur(e, retour);
  }
}

// ── Portail ──

async function dossierDeLOrganisation(user: CurrentUser, id: number) {
  const s = await prisma.subvention.findFirst({
    where: { id, organisationId: user.organisationId ?? -1 },
    select: { id: true, status: true, exercice: true },
  });
  if (!s) throw new UserFacingError("Dossier introuvable.");
  return s;
}

/** POST /portail/mes-subventions/nouvelle : commence (ou reprend) le dossier de la campagne. */
export async function portailCommencer(user: CurrentUser): Promise<Response> {
  const retour = "/portail/mes-subventions";
  try {
    if (!user.organisationId)
      throw new UserFacingError("Votre compte n'est rattaché à aucune organisation.");
    const { campagne, depotOuvert } = await contexteCampagne();
    if (!campagne || !depotOuvert)
      throw new UserFacingError("Le dépôt des dossiers n'est pas ouvert actuellement.");
    const s = await creerBrouillon(
      {
        organisationId: user.organisationId,
        campagne,
        exercice: campagne.exercice,
        nature: "renouvellement",
        parAgent: false,
      },
      user,
    );
    return redirection(`/portail/mes-subventions/${s.id}/dossier/presentation`);
  } catch (e) {
    return erreur(e, retour);
  }
}

/** POST /portail/mes-subventions/[id]/dossier/[fiche] */
export async function portailFiche(
  user: CurrentUser,
  id: number,
  ficheRaw: string,
  form: FormData,
): Promise<Response> {
  try {
    await dossierDeLOrganisation(user, id);
    return await fiche(user, id, ficheRaw, form, "/portail/mes-subventions");
  } catch (e) {
    return erreur(e, "/portail/mes-subventions");
  }
}

/** POST /portail/mes-subventions/[id]/signature/code */
export async function portailCode(
  user: CurrentUser,
  id: number,
  form: FormData,
): Promise<Response> {
  const retour = `/portail/mes-subventions/${id}/dossier/attestation`;
  try {
    await dossierDeLOrganisation(user, id);
    const canal = await demanderCodeDossier(
      id,
      champOuNull(form, "telephone"),
      user.email,
      user.firstName || user.name,
    );
    return redirigerAvecMessage(
      retour,
      canal === "sms" ? "Code envoyé par SMS." : `Code envoyé par courriel à ${user.email}.`,
      "success",
    );
  } catch (e) {
    return erreur(e, retour);
  }
}

/** POST /portail/mes-subventions/[id]/signature/signer */
export async function portailSigner(
  user: CurrentUser,
  id: number,
  form: FormData,
  ip: string,
): Promise<Response> {
  const retour = `/portail/mes-subventions/${id}/dossier/attestation`;
  try {
    await dossierDeLOrganisation(user, id);
    await signerDossier(id, champ(form, "code"), ip);
    return redirigerAvecMessage(
      retour,
      "Attestation signée. Vérifiez les manques éventuels puis déposez le dossier.",
      "success",
    );
  } catch (e) {
    return erreur(e, retour);
  }
}

/** POST /portail/mes-subventions/[id]/deposer */
export async function portailDeposer(user: CurrentUser, id: number): Promise<Response> {
  const retour = `/portail/mes-subventions/${id}/dossier/attestation`;
  try {
    await dossierDeLOrganisation(user, id);
    const s = await deposerDossier(id, user, { parAgent: false });
    return redirigerAvecMessage(
      `/portail/mes-subventions/${id}`,
      `Dossier ${s.numero} déposé : un accusé de réception vous est envoyé par courriel.`,
      "success",
    );
  } catch (e) {
    return erreur(e, retour);
  }
}
