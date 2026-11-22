/**
 * Les gestes d'écriture d'une campagne (back-office) : création, modification, changement
 * d'état, décisions sur les vœux, arbitrage automatique, courriel groupé, suppression.
 * Réservés aux agents qui écrivent sur les réservations.
 */
import { lireStatutCampagne, phraseBilanArbitrage } from "@/lib/campagnes";
import { STATUTS_DU_MOMENT } from "@/lib/circuits";
import { champ, champOuNull, coche, idOuNull, ids, parseDate, parseInt_ } from "@/lib/forms-util";
import { minutesDe } from "@/lib/paris-time";
import {
  arbitrerCampagne,
  attribuerVoeu,
  type CampagneEntree,
  changerStatutCampagne,
  chargerCampagne,
  creerCampagne,
  gereCampagne,
  modifierCampagne,
  notifierDecisions,
  refuserVoeu,
  remettreEnAttente,
  supprimerCampagne,
  type VoeuEntree,
} from "@/server/campagnes";
import { UserFacingError } from "@/server/errors";
import { enabledIn, require as requireFeature } from "@/server/features";
import { type CurrentUser, requireDelete, requireEdit } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage } from "@/server/http";

/**
 * La campagne saisie. Les espaces se limitent au périmètre de l'agent : s'il n'en coche aucun,
 * la campagne porte sur tous ceux de son périmètre (et non sur tous les espaces de la Ville).
 * Le service est l'un des siens ; un administrateur choisit librement.
 */
export function lireCampagne(form: FormData, user: CurrentUser): CampagneEntree {
  const saisonId = idOuNull(form, "saison_id");
  if (!saisonId) throw new UserFacingError("Choisissez la saison de la campagne.");
  const perimetre = user.espacesGeres;
  const coches = ids(form, "espace");
  const hors = coches.filter((e) => perimetre.length > 0 && !perimetre.includes(e));
  if (hors.length)
    throw new UserFacingError("Un des espaces cochés n'est pas dans votre périmètre.");
  const service = idOuNull(form, "service_id");
  if (service && !user.agitPour(service))
    throw new UserFacingError("Vous n'agissez pas pour ce service.");
  return {
    saisonId,
    label: champ(form, "label"),
    closeDate: parseDate(form.get("close_date")),
    consignes: champOuNull(form, "consignes"),
    espaceIds: coches.length ? coches : perimetre.filter((e) => e > 0),
    serviceId:
      enabledIn(user.settings, "processus") && (service || user.services.length !== 1)
        ? service
        : (user.services[0] ?? null),
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
    const id = await creerCampagne(lireCampagne(form, user), user.name);
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
  // Conduire la campagne (tout sauf décider d'un vœu) : son service et tous ses espaces.
  if (segments[0] !== "voeux" && !gereCampagne(user, c))
    return redirigerAvecMessage(
      fiche,
      c.serviceId && !user.agitPour(c.serviceId)
        ? `Cette campagne est conduite par ${c.service?.name ?? "un autre service"} : vous la consultez.`
        : "Cette campagne porte sur des espaces hors de votre périmètre : vous la consultez.",
      "danger",
    );
  try {
    switch (cle) {
      case "modifier":
        await modifierCampagne(id, lireCampagne(form, user), user.name);
        return redirigerAvecMessage(fiche, "Campagne modifiée.", "success");
      case "statut": {
        const nouveau = lireStatutCampagne(champ(form, "statut"));
        if (!nouveau) throw new UserFacingError("État inconnu.");
        await changerStatutCampagne(c, nouveau, user.name);
        if (nouveau === "instruction") {
          const { aiguillerCampagne } = await import("@/server/circuits-campagne");
          await aiguillerCampagne(id).catch((e) => console.error("[circuit campagne]", e));
        }
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
      case "etapes/basculer": {
        const { basculerVersion } = await import("@/server/circuits");
        const { porteurCampagneParId } = await import("@/server/circuits-campagne");
        const p = await porteurCampagneParId(id);
        if (!p) return pasTrouve();
        const b = await basculerVersion(p, user.name);
        return redirigerAvecMessage(
          `${fiche}#circuit`,
          `La campagne suit maintenant la version ${b.numero} de son circuit.`,
          "success",
        );
      }
      case "etapes/demander": {
        const { etatCircuit, ouvrirEtape } = await import("@/server/circuits");
        const { aiguillerCampagne, porteurCampagneParId } = await import(
          "@/server/circuits-campagne"
        );
        await aiguillerCampagne(id);
        const p = await porteurCampagneParId(id);
        const e = p
          ? (await etatCircuit(p))?.etapes.find((x) => x.cle === champ(form, "cle"))
          : null;
        if (!p || !e) throw new UserFacingError("Cette étape ne s'applique pas à cette campagne.");
        if (e.etat === "ouverte") throw new UserFacingError("Cette étape attend déjà une réponse.");
        if (!STATUTS_DU_MOMENT[e.moment].includes(p.status))
          throw new UserFacingError(
            "Le moment de cette étape est passé : elle ne se demande plus.",
          );
        await ouvrirEtape(p, e, user.name, champOuNull(form, "contexte"));
        return redirigerAvecMessage(
          `${fiche}#circuit`,
          `« ${e.libelle} » demandé à : ${e.libelleIntervenant}.`,
          "success",
        );
      }
      case "notifier": {
        // Le circuit de la campagne peut soumettre l'arbitrage à un visa avant l'envoi.
        const { verifierAvant } = await import("@/server/circuits");
        const { aiguillerCampagne, porteurCampagneParId } = await import(
          "@/server/circuits-campagne"
        );
        await aiguillerCampagne(id);
        const p = await porteurCampagneParId(id);
        try {
          // Rien à envoyer : inutile de solliciter l'élu.
          if (p && c.voeux.some((v) => v.status !== "en_attente" && !v.notifiedAt))
            await verifierAvant(p, "avant_notification", user, `Arbitrage soumis : ${p.detail}`);
        } catch (e) {
          if (e instanceof UserFacingError)
            return redirigerAvecMessage(`${fiche}#circuit`, e.message, "warning");
          throw e;
        }
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
