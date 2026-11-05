/**
 * Les gestes d'écriture d'une campagne (back-office) : création, modification, changement
 * d'état, décisions sur les vœux, arbitrage automatique, courriel groupé, suppression.
 * Réservés aux agents qui écrivent sur les réservations.
 */
import { lireStatutCampagne, phraseBilanArbitrage } from "@/lib/campagnes";
import { champ, champOuNull, coche, idOuNull, ids, parseDate, parseInt_ } from "@/lib/forms-util";
import { minutesDe } from "@/lib/paris-time";
import {
  arbitrerCampagne,
  attribuerVoeu,
  type CampagneEntree,
  changerStatutCampagne,
  chargerCampagne,
  creerCampagne,
  modifierCampagne,
  notifierDecisions,
  refuserVoeu,
  remettreEnAttente,
  supprimerCampagne,
  type VoeuEntree,
} from "@/server/campagnes";
import { UserFacingError } from "@/server/errors";
import { require as requireFeature } from "@/server/features";
import { type CurrentUser, requireDelete, requireEdit } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage } from "@/server/http";

export function lireCampagne(form: FormData): CampagneEntree {
  const saisonId = idOuNull(form, "saison_id");
  if (!saisonId) throw new UserFacingError("Choisissez la saison de la campagne.");
  return {
    saisonId,
    label: champ(form, "label"),
    closeDate: parseDate(form.get("close_date")),
    consignes: champOuNull(form, "consignes"),
    espaceIds: ids(form, "espace"),
  };
}

/** Un vœu saisi sur le portail : espace, jour, heures (Paris), activité, participants, hors vacances. */
export function lireVoeu(form: FormData): VoeuEntree {
  const espaceId = idOuNull(form, "espace_id");
  if (!espaceId) throw new UserFacingError("Choisissez l'espace souhaité.");
  const weekday = parseInt_(form.get("weekday"), 0, 1) ?? 0;
  const startMin = minutesDe(champ(form, "heure_debut"));
  const endMin = minutesDe(champ(form, "heure_fin"));
  if (startMin === null || endMin === null)
    throw new UserFacingError("Indiquez l'heure de début et l'heure de fin.");
  return {
    espaceId,
    title: champ(form, "title"),
    participants: parseInt_(form.get("participants"), null, 0),
    description: champOuNull(form, "description"),
    weekday,
    startMin,
    endMin,
    horsVacances: coche(form, "hors_vacances"),
  };
}

export async function creer(form: FormData): Promise<Response> {
  await requireFeature("campagnes");
  const user = await requireEdit("reservations");
  try {
    const id = await creerCampagne(lireCampagne(form), user.name);
    return redirigerAvecMessage(
      `/campagnes/${id}`,
      "Campagne créée : elle reste en brouillon jusqu'à l'ouverture du dépôt.",
      "success",
    );
  } catch (e) {
    if (e instanceof UserFacingError)
      return redirigerAvecMessage("/campagnes", e.message, "danger");
    throw e;
  }
}

/** Aiguille POST /campagnes/<id>/<action…>. */
export async function actionCampagne(
  id: number,
  segments: string[],
  form: FormData,
): Promise<Response> {
  await requireFeature("campagnes");
  const cle = segments.join("/");
  const user: CurrentUser =
    cle === "supprimer" ? await requireDelete("reservations") : await requireEdit("reservations");
  const c = await chargerCampagne(id);
  if (!c) return pasTrouve();
  const fiche = `/campagnes/${id}`;
  const acteur = { name: user.name, email: user.email };
  try {
    switch (cle) {
      case "modifier":
        await modifierCampagne(id, lireCampagne(form), user.name);
        return redirigerAvecMessage(fiche, "Campagne modifiée.", "success");
      case "statut": {
        const nouveau = lireStatutCampagne(champ(form, "statut"));
        if (!nouveau) throw new UserFacingError("État inconnu.");
        await changerStatutCampagne(c, nouveau, user.name);
        return redirigerAvecMessage(
          fiche,
          nouveau === "ouverte"
            ? "Dépôt des vœux ouvert : les usagers peuvent déposer depuis « Mes vœux »."
            : nouveau === "instruction"
              ? "Dépôt clos : arbitrez les vœux, puis prévenez les demandeurs."
              : nouveau === "cloturee"
                ? "Campagne clôturée."
                : "Campagne repassée en brouillon.",
          "success",
        );
      }
      case "arbitrer": {
        const b = await arbitrerCampagne(c, acteur);
        return redirigerAvecMessage(
          fiche,
          phraseBilanArbitrage(b),
          b.erreurs ? "warning" : "success",
        );
      }
      case "notifier": {
        const n = await notifierDecisions(c, acteur);
        return redirigerAvecMessage(
          fiche,
          n ? `${n} organisation(s) prévenue(s) par courriel.` : "Aucune décision à communiquer.",
          n ? "success" : "info",
        );
      }
      case "supprimer":
        await supprimerCampagne(c, user.email);
        return redirigerAvecMessage("/campagnes", `Campagne « ${c.label} » supprimée.`, "success");
      default: {
        if (segments[0] === "voeux" && segments.length === 3) {
          const vid = parseInt_(segments[1], null, 1);
          if (!vid) return pasTrouve();
          if (!c.voeux.some((v) => v.id === vid && user.gereEspace(v.espaceId)))
            return redirigerAvecMessage(
              fiche,
              "Ce vœu porte sur un espace hors de votre périmètre.",
              "danger",
            );
          if (segments[2] === "attribuer") {
            const numero = await attribuerVoeu(c, vid, acteur);
            return redirigerAvecMessage(fiche, `Vœu attribué : dossier ${numero} créé.`, "success");
          }
          if (segments[2] === "refuser") {
            await refuserVoeu(c, vid, champOuNull(form, "note"), acteur);
            return redirigerAvecMessage(fiche, "Vœu refusé.", "success");
          }
          if (segments[2] === "attente") {
            await remettreEnAttente(c, vid);
            return redirigerAvecMessage(fiche, "Vœu remis en attente.", "success");
          }
        }
        return pasTrouve();
      }
    }
  } catch (e) {
    if (e instanceof UserFacingError) return redirigerAvecMessage(fiche, e.message, "danger");
    throw e;
  }
}
