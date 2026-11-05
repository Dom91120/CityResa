/**
 * Les gestes du planning : bloquer un créneau d'un espace (indisponibilité), le transformer en
 * fermeture exceptionnelle quand des réservations sont en place, et lever un blocage.
 * Réservés aux agents qui ont la main sur l'espace.
 */
import { phraseBilan } from "@/lib/fermetures";
import { champ, champOuNull, coche, idOuNull } from "@/lib/forms-util";
import { isoParis, plage } from "@/lib/libelles";
import {
  ajouterVue,
  ecrireVuesEnregistrees,
  lireVuesEnregistrees,
  retirerVue,
} from "@/lib/planning-vues";
import { lireCreneau } from "@/modules/reservations/formulaire";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { apercuFermeture, poserFermeture, urlApercuFermeture } from "@/server/fermetures";
import { requireEdit, requireView } from "@/server/guards";
import { pasTrouve, redirection, redirigerAvecMessage, suite } from "@/server/http";
import { constaterPresence, heuresSaisies } from "@/server/presences";

export async function bloquer(form: FormData): Promise<Response> {
  const user = await requireEdit("reservations");
  const retour = suite(form, "/planning");
  try {
    const espaceId = idOuNull(form, "espace_id");
    if (!espaceId) throw new UserFacingError("Choisissez l'espace à bloquer.");
    if (!user.gereEspace(espaceId))
      throw new UserFacingError("Cet espace n'est pas dans votre périmètre.");
    const espace = await prisma.espace.findUnique({ where: { id: espaceId } });
    if (!espace) return pasTrouve();
    const i = lireCreneau(form);
    const motif = champOuNull(form, "motif");
    const ou = `/planning?espace=${espaceId}&date=${isoParis(i.startAt).date}${champ(form, "vue") ? `&vue=${champ(form, "vue")}` : ""}`;
    // Des réservations en place : on passe par l'aperçu de fermeture exceptionnelle.
    if ((await apercuFermeture(espaceId, i.startAt, i.endAt)).length)
      return redirection(urlApercuFermeture({ espaceId, ...i, motif, next: ou }));
    await prisma.indisponibilite.create({
      data: {
        espaceId,
        startAt: i.startAt,
        endAt: i.endAt,
        motif: motif?.slice(0, 200) ?? null,
        createdBy: user.email,
      },
    });
    await auditRecord(
      "blocage espace",
      `${espace.name} · ${plage(i.startAt, i.endAt)}${motif ? ` · ${motif}` : ""}`,
      "planning",
      user.email,
    );
    return redirigerAvecMessage(
      ou,
      `Blocage posé sur ${espace.name} : ${plage(i.startAt, i.endAt)}.`,
      "success",
    );
  } catch (e) {
    if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
    throw e;
  }
}

/** POST /planning/fermer : confirme une fermeture exceptionnelle vue dans l'aperçu. */
export async function fermer(form: FormData): Promise<Response> {
  const user = await requireEdit("reservations");
  const retour = suite(form, "/planning");
  try {
    const espaceId = idOuNull(form, "espace_id");
    if (!espaceId) throw new UserFacingError("Choisissez l'espace à fermer.");
    if (!user.gereEspace(espaceId))
      throw new UserFacingError("Cet espace n'est pas dans votre périmètre.");
    const espace = await prisma.espace.findUnique({ where: { id: espaceId } });
    if (!espace) return pasTrouve();
    const startAt = new Date(champ(form, "debut"));
    const endAt = new Date(champ(form, "fin"));
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt)
      throw new UserFacingError("Période de fermeture invalide.");
    const motif = champOuNull(form, "motif");
    const b = await poserFermeture({
      espace,
      startAt,
      endAt,
      motif,
      annuler: coche(form, "annuler"),
      prevenir: coche(form, "prevenir"),
      vus: form.getAll("creneau").map(Number).filter(Number.isInteger),
      acteur: { email: user.email, name: user.name },
    });
    if (b === "apercu_perime")
      return redirigerAvecMessage(
        urlApercuFermeture({ espaceId, startAt, endAt, motif, next: retour }),
        "Les réservations ont changé depuis l'aperçu : vérifiez la liste à jour avant de confirmer.",
        "warning",
      );
    return redirigerAvecMessage(
      retour,
      phraseBilan(b, espace.name, plage(startAt, endAt)),
      b.entiers ? "warning" : "success",
    );
  } catch (e) {
    if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
    throw e;
  }
}

export async function supprimerBlocage(id: number, form: FormData): Promise<Response> {
  const user = await requireEdit("reservations");
  const retour = suite(form, "/planning");
  const b = await prisma.indisponibilite.findUnique({ where: { id }, include: { espace: true } });
  if (!b) return pasTrouve();
  if (!user.gereEspace(b.espaceId))
    return redirigerAvecMessage(retour, "Cet espace n'est pas dans votre périmètre.", "danger");
  await prisma.indisponibilite.delete({ where: { id } });
  await auditRecord(
    "levee blocage espace",
    `${b.espace.name} · ${plage(b.startAt, b.endAt)}`,
    "planning",
    user.email,
  );
  return redirigerAvecMessage(retour, `Blocage levé sur ${b.espace.name}.`, "success");
}

/** POST /planning/presences : constate la présence (ou l'absence) d'un créneau passé. */
export async function constater(form: FormData): Promise<Response> {
  const user = await requireEdit("reservations");
  const retour = suite(form, "/planning/presences");
  try {
    const creneauId = idOuNull(form, "creneau_id");
    if (!creneauId) return pasTrouve();
    const presence = champ(form, "presence");
    let message: string;
    if (presence === "presente" || presence === "absente") {
      const c = await prisma.creneau.findUnique({
        where: { id: creneauId },
        select: { startAt: true },
      });
      if (!c) return pasTrouve();
      message = await constaterPresence(user, creneauId, {
        presence,
        ...(presence === "presente"
          ? heuresSaisies(c, champ(form, "arrivee"), champ(form, "depart"))
          : { realStartAt: null, realEndAt: null }),
        note: champOuNull(form, "note"),
      });
    } else {
      message = await constaterPresence(user, creneauId, null);
    }
    return redirigerAvecMessage(retour, message, "success");
  } catch (e) {
    if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
    throw e;
  }
}

/** POST /planning/vues : enregistre (« enregistrer ») ou supprime (« supprimer ») une vue de l'agent. */
export async function vuesPlanning(form: FormData): Promise<Response> {
  const user = await requireView("planning");
  const retour = suite(form, "/planning");
  const vues = lireVuesEnregistrees(user.listPrefs);
  const action = champ(form, "action");
  const nom = champ(form, "nom");
  let apres: ReturnType<typeof retirerVue>;
  let message: string;
  if (action === "supprimer") {
    apres = retirerVue(vues, nom);
    message = `Vue « ${nom} » supprimée.`;
  } else {
    const r = ajouterVue(vues, nom, champ(form, "qs"));
    if (typeof r === "string") return redirigerAvecMessage(retour, r, "danger");
    apres = r;
    message = `Vue « ${nom.trim()} » enregistrée : retrouvez-la dans « Mes vues ».`;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { listPrefs: ecrireVuesEnregistrees(user.listPrefs, apres) },
  });
  return redirigerAvecMessage(retour, message, "success");
}
