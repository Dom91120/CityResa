/**
 * Les gestes du module ASSO (routes POST sous src/app/envoi/subventions) : dépôt,
 * modification, avis, transitions de statut, suppression.
 */
import { SUBVENTION_STATUS } from "@/lib/constantes";
import {
  changerStatutSubvention,
  creerSubvention,
  donnerAvis,
  lireAvis,
  lireSubvention,
  lireTransition,
  modifierSubvention,
  peutDecider,
  REFUS_ELU,
  supprimerSubvention,
} from "@/modules/subventions/server";
import { UserFacingError } from "@/server/errors";
import type { CurrentUser } from "@/server/guards";
import { redirigerAvecMessage, suite } from "@/server/http";

function erreur(e: unknown, retour: string): Promise<Response> {
  if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
  throw e;
}

/** POST /subventions/nouvelle */
export async function deposer(user: CurrentUser, form: FormData): Promise<Response> {
  try {
    const s = await creerSubvention(lireSubvention(form), user);
    return redirigerAvecMessage(
      `/subventions/${s.id}`,
      `Demande ${s.numero} déposée pour ${s.organisation.name}.`,
      "success",
    );
  } catch (e) {
    return erreur(e, "/subventions/nouvelle");
  }
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
