/**
 * Les actions d'écriture du module Personnel de service : personnes (création, modification,
 * activation, suppression, lien ICS, envoi du planning) et vacations (ajout avec répétition,
 * modification, suppression d'une vacation ou de sa série). Appelées depuis src/app/envoi/personnel.
 */
import { lundiDe } from "@/lib/editions";
import { champ } from "@/lib/forms-util";
import { isoParis } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { nomPersonne } from "@/lib/personnel";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireDelete, requireEdit } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, suite } from "@/server/http";
import { nouveauJeton } from "@/server/ics";
import {
  creerVacations,
  envoyerPlanningPersonne,
  lirePersonne,
  lireVacation,
  modifierVacation,
  supprimerPersonne,
  supprimerVacation,
} from "@/server/personnel";

const CATEGORIE = "personnel";

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
        const m = await prisma.personnel.update({ where: { id }, data: lirePersonne(form) });
        await auditRecord("modification personnel", nomPersonne(m), CATEGORIE, user.email);
        return redirigerAvecMessage(fiche, "Fiche modifiée.", "success");
      }
      case "desactiver":
      case "reactiver": {
        const isActive = action === "reactiver";
        await prisma.personnel.update({ where: { id }, data: { isActive } });
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
