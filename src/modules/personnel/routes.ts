/**
 * Les actions d'écriture du module Personnel de service : personnes (création, modification,
 * activation, suppression, lien ICS, envoi du planning) et vacations (ajout avec répétition,
 * modification, suppression d'une vacation ou de sa série). Appelées depuis src/app/envoi/personnel.
 */
import { Prisma } from "@/generated/prisma/client";
import { lundiDe } from "@/lib/editions";
import { champ, idOuNull, parseInt_ } from "@/lib/forms-util";
import { isoParis } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { nomPersonne } from "@/lib/personnel";
import { fenetre, lireDate, lireVue } from "@/modules/planning/server";
import {
  affecterCreneaux,
  ecarterProposition,
  resumeBilan,
  reverifierAffectations,
  validerProposition,
} from "@/server/affectation";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireDelete, requireEdit } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, suite } from "@/server/http";
import { nouveauJeton } from "@/server/ics";
import {
  creerAbsence,
  creerVacations,
  envoyerPlanningPersonne,
  lireAbsence,
  lireContrat,
  lirePersonne,
  lireSitesPersonne,
  lireVacation,
  mettreAJourSites,
  modifierVacation,
  sitesDuPerimetre,
  supprimerAbsence,
  supprimerPersonne,
  supprimerVacation,
} from "@/server/personnel";

const CATEGORIE = "personnel";

/** Affecte ou propose le personnel sur les créneaux de la période et du site affichés. */
export async function affecter(form: FormData): Promise<Response> {
  const user = await requireEdit(CATEGORIE);
  const retour = suite(form, "/personnel");
  try {
    const fen = fenetre(
      lireVue(champ(form, "vue")) === "jour" ? "jour" : "semaine",
      lireDate(champ(form, "date")),
    );
    const sites = await sitesDuPerimetre(user);
    const siteId = parseInt_(form.get("site"), null, 1);
    const siteIds = siteId
      ? sites.filter((s) => s.id === siteId).map((s) => s.id)
      : sites.map((s) => s.id);
    if (!siteIds.length) throw new UserFacingError("Aucun site dans votre périmètre.");
    const bilan = await affecterCreneaux({ de: fen.de, a: fen.a, siteIds }, user.email);
    await auditRecord(
      "affectation personnel",
      `${fen.label} · ${resumeBilan(bilan)}`,
      CATEGORIE,
      user.email,
    );
    return redirigerAvecMessage(
      retour,
      resumeBilan(bilan),
      bilan.sansCandidat ? "warning" : "success",
    );
  } catch (err) {
    if (err instanceof UserFacingError) return redirigerAvecMessage(retour, err.message, "danger");
    throw err;
  }
}

export const ACTIONS_PROPOSITION = ["valider", "ecarter"];

export async function actionProposition(
  creneauId: number,
  action: string,
  form: FormData,
): Promise<Response> {
  const user = await requireEdit(CATEGORIE);
  const retour = suite(form, "/personnel?onglet=propositions");
  try {
    const c = await prisma.creneau.findUnique({
      where: { id: creneauId },
      select: { espaceId: true },
    });
    if (!c) return pasTrouve();
    if (!user.gereEspace(c.espaceId))
      throw new UserFacingError("Ce créneau n'est pas dans votre périmètre.");
    const message =
      action === "valider"
        ? await validerProposition(creneauId, idOuNull(form, "personnel_id"), user.email)
        : await ecarterProposition(creneauId, user.email);
    await auditRecord(
      `proposition ${action === "valider" ? "validee" : "ecartee"}`,
      message,
      CATEGORIE,
      user.email,
    );
    return redirigerAvecMessage(retour, message, "success");
  } catch (err) {
    if (err instanceof UserFacingError) return redirigerAvecMessage(retour, err.message, "danger");
    throw err;
  }
}

export async function ajouterVacation(form: FormData): Promise<Response> {
  const user = await requireEdit(CATEGORIE);
  const retour = suite(form, "/personnel");
  try {
    const e = lireVacation(form);
    const message = await creerVacations(e, user);
    await auditRecord("ajout vacation", message, CATEGORIE, user.email);
    const ou = retour.startsWith("/personnel")
      ? retour
      : `/personnel?date=${isoParis(e.intervalle.startAt).date}&site=${e.siteId}`;
    return redirigerAvecMessage(ou, message, "success");
  } catch (err) {
    if (err instanceof UserFacingError) return redirigerAvecMessage(retour, err.message, "danger");
    throw err;
  }
}

export const ACTIONS_VACATION = ["modifier", "supprimer", "supprimer_serie"];

export async function actionVacation(
  id: number,
  action: string,
  form: FormData,
): Promise<Response> {
  const user = await requireEdit(CATEGORIE);
  const v = await prisma.vacation.findUnique({ where: { id } });
  if (!v) return pasTrouve();
  const retour = suite(form, `/personnel?date=${isoParis(v.startAt).date}&site=${v.siteId}`);
  try {
    if (action === "supprimer" || action === "supprimer_serie") {
      const message = await supprimerVacation(id, action === "supprimer_serie");
      await auditRecord("suppression vacation", message, CATEGORIE, user.email);
      return redirigerAvecMessage(retour, message, "success");
    }
    const e = lireVacation(form);
    const message = await modifierVacation(id, e);
    await auditRecord("modification vacation", message, CATEGORIE, user.email);
    return redirigerAvecMessage(retour, message, "success");
  } catch (err) {
    if (err instanceof UserFacingError)
      return redirigerAvecMessage(`/personnel/vacations/${id}`, err.message, "danger");
    throw err;
  }
}

export async function nouvellePersonne(form: FormData): Promise<Response> {
  const user = await requireEdit(CATEGORIE);
  const retour = suite(form, "/personnel/personnes");
  try {
    const p = await prisma.personnel.create({ data: lirePersonne(form) });
    await auditRecord("creation personnel", nomPersonne(p), CATEGORIE, user.email);
    return redirigerAvecMessage(
      `/personnel/personnes/${p.id}`,
      `${nomPersonne(p)} ajouté au personnel de service.`,
      "success",
    );
  } catch (err) {
    if (err instanceof UserFacingError) return redirigerAvecMessage(retour, err.message, "danger");
    throw err;
  }
}

export const ACTIONS_PERSONNE = [
  "modifier",
  "desactiver",
  "reactiver",
  "supprimer",
  "ics_generer",
  "ics_revoquer",
  "envoyer_planning",
  "absences_ajouter",
  "absences_supprimer",
];

export async function actionPersonne(
  id: number,
  action: string,
  form: FormData,
): Promise<Response> {
  const fiche = `/personnel/personnes/${id}`;
  try {
    if (action === "supprimer") {
      const user = await requireDelete(CATEGORIE);
      const message = await supprimerPersonne(id);
      await auditRecord("suppression personnel", `#${id}`, CATEGORIE, user.email);
      return redirigerAvecMessage("/personnel/personnes", message, "success");
    }
    const user = await requireEdit(CATEGORIE);
    const p = await prisma.personnel.findUnique({ where: { id } });
    if (!p) return pasTrouve();
    const nom = nomPersonne(p);
    switch (action) {
      case "modifier": {
        const contrat = lireContrat(form);
        const m = await prisma.personnel.update({
          where: { id },
          data: {
            ...lirePersonne(form),
            ...contrat,
            horaires: contrat.horaires ?? Prisma.DbNull,
          },
        });
        await mettreAJourSites(id, lireSitesPersonne(form));
        await auditRecord("modification personnel", nomPersonne(m), CATEGORIE, user.email);
        const retires = await reverifierAffectations(id, user.email);
        return redirigerAvecMessage(
          fiche,
          retires
            ? `Fiche modifiée ; ${retires} affectation${retires > 1 ? "s" : ""} à venir retirée${retires > 1 ? "s" : ""} (plus disponible) et remise${retires > 1 ? "s" : ""} en affectation.`
            : "Fiche modifiée.",
          "success",
        );
      }
      case "absences_ajouter": {
        const e = lireAbsence(form);
        const message = await creerAbsence(id, e, user);
        await auditRecord("ajout absence personnel", `${nom} · ${message}`, CATEGORIE, user.email);
        const retires = await reverifierAffectations(id, user.email);
        return redirigerAvecMessage(
          fiche,
          retires
            ? `${message} ${retires} affectation${retires > 1 ? "s" : ""} retirée${retires > 1 ? "s" : ""} sur la période et remise${retires > 1 ? "s" : ""} en affectation.`
            : message,
          "success",
        );
      }
      case "absences_supprimer": {
        const absenceId = idOuNull(form, "absence_id");
        if (!absenceId) return pasTrouve();
        const message = await supprimerAbsence(absenceId, id);
        await auditRecord(
          "suppression absence personnel",
          `${nom} · ${message}`,
          CATEGORIE,
          user.email,
        );
        return redirigerAvecMessage(fiche, message, "success");
      }
      case "desactiver":
      case "reactiver": {
        const isActive = action === "reactiver";
        await prisma.personnel.update({ where: { id }, data: { isActive } });
        if (!isActive) await reverifierAffectations(id, user.email);
        await auditRecord(
          isActive ? "reactivation personnel" : "desactivation personnel",
          nom,
          CATEGORIE,
          user.email,
        );
        return redirigerAvecMessage(
          fiche,
          isActive
            ? `${nom} est de nouveau en service.`
            : `${nom} n'est plus en service : ses vacations restent consultables.`,
          "success",
        );
      }
      case "ics_generer": {
        await prisma.personnel.update({ where: { id }, data: { icsToken: nouveauJeton() } });
        await auditRecord("generation lien ICS personnel", nom, CATEGORIE, user.email);
        return redirigerAvecMessage(
          fiche,
          "Lien ICS généré : transmettez-le à la personne pour son agenda.",
          "success",
        );
      }
      case "ics_revoquer": {
        await prisma.personnel.update({ where: { id }, data: { icsToken: null } });
        await auditRecord("revocation lien ICS personnel", nom, CATEGORIE, user.email);
        return redirigerAvecMessage(fiche, "Lien ICS révoqué.", "success");
      }
      case "envoyer_planning": {
        if (!p.email) throw new UserFacingError("Cette personne n'a pas d'adresse de courriel.");
        const date = champ(form, "date");
        const lundi = lundiDe(/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayParisISO());
        const ok = await envoyerPlanningPersonne(p, lundi, await getSettings());
        if (!ok)
          throw new UserFacingError(
            "Envoi impossible : le modèle « Planning de service (personnel) » est inactif ou la messagerie a échoué.",
          );
        await auditRecord("envoi planning personnel", `${nom} · ${lundi}`, CATEGORIE, user.email);
        return redirigerAvecMessage(
          fiche,
          `Planning de la semaine du ${lundi.split("-").reverse().join("/")} envoyé à ${p.email}.`,
          "success",
        );
      }
      default:
        return pasTrouve();
    }
  } catch (err) {
    if (err instanceof UserFacingError) return redirigerAvecMessage(fiche, err.message, "danger");
    throw err;
  }
}
