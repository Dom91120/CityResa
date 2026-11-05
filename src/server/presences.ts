/**
 * Présences constatées : les créneaux passés à constater (planning › Présences), et
 * l'enregistrement d'un constat (présent avec heures réelles, ou absent sans prévenir).
 * Règles pures dans src/lib/presences.ts.
 */
import { isoParis, plage } from "@/lib/libelles";
import { parisDateTimeToInstant } from "@/lib/paris-time";
import {
  decrirePresence,
  estPasse,
  heuresAConserver,
  type SaisiePresence,
  verifierSaisie,
} from "@/lib/presences";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import type { CurrentUser } from "@/server/guards";
import { historiser } from "@/server/reservations";

/** Les dossiers dont les créneaux passés comptent (acquis, puis terminés ou archivés). */
export const STATUTS_CONSTATABLES = ["acceptee", "signee", "confirmee", "terminee", "archivee"];

export const INCLUDE_CONSTAT = {
  espace: { select: { id: true, name: true, shortName: true, site: { select: { name: true } } } },
  reservation: {
    select: {
      id: true,
      numero: true,
      title: true,
      status: true,
      organisation: { select: { id: true, name: true } },
      user: { select: { firstName: true, lastName: true } },
    },
  },
} as const;

/** Les créneaux prévus et passés d'une période (ou d'un dossier), dans le périmètre de l'agent. */
export async function creneauxAConstater(
  user: CurrentUser,
  f: { de?: Date; a?: Date; site?: number | null; espaces?: number[]; dossier?: number | null },
  now = new Date(),
) {
  const fin = f.a && f.a < now ? f.a : now;
  return prisma.creneau.findMany({
    where: {
      status: "prevu",
      endAt: { lte: fin, ...(f.de ? { gt: f.de } : {}) },
      reservation: {
        status: { in: STATUTS_CONSTATABLES },
        ...(f.dossier ? { id: f.dossier } : {}),
      },
      ...(user.espacesGeres.length ? { espaceId: { in: user.espacesGeres } } : {}),
      ...(f.espaces?.length ? { espaceId: { in: f.espaces } } : {}),
      ...(f.site ? { espace: { siteId: f.site } } : {}),
    },
    include: INCLUDE_CONSTAT,
    orderBy: [{ startAt: "asc" }, { espaceId: "asc" }],
  });
}

/** Lit les heures « HH:MM » saisies sur la date (Paris) du créneau ; un départ avant l'arrivée = le lendemain. */
export function heuresSaisies(
  c: { startAt: Date },
  arrivee: string,
  depart: string,
): { realStartAt: Date | null; realEndAt: Date | null } {
  const jour = isoParis(c.startAt).date;
  const realStartAt = arrivee ? parisDateTimeToInstant(jour, arrivee) : null;
  let realEndAt = depart ? parisDateTimeToInstant(jour, depart) : null;
  if (realStartAt && realEndAt && realEndAt <= realStartAt)
    realEndAt = new Date(realEndAt.getTime() + 86_400_000);
  return { realStartAt, realEndAt };
}

/** Enregistre (ou efface, avec `saisie` null) le constat d'un créneau passé. */
export async function constaterPresence(
  user: CurrentUser,
  creneauId: number,
  saisie: SaisiePresence | null,
  now = new Date(),
): Promise<string> {
  const c = await prisma.creneau.findUnique({
    where: { id: creneauId },
    include: { reservation: { select: { id: true, numero: true, status: true } } },
  });
  if (!c) throw new UserFacingError("Créneau introuvable.");
  if (!user.gereEspace(c.espaceId))
    throw new UserFacingError("Cet espace n'est pas dans votre périmètre.");
  if (c.status !== "prevu") throw new UserFacingError("Ce créneau est annulé.");
  if (!estPasse(c, now)) throw new UserFacingError("Ce créneau n'est pas encore passé.");
  if (!STATUTS_CONSTATABLES.includes(c.reservation.status))
    throw new UserFacingError("Ce dossier n'est pas acquis : rien à constater.");
  const libelle = plage(c.startAt, c.endAt);
  if (!saisie) {
    await prisma.creneau.update({
      where: { id: c.id },
      data: {
        presence: null,
        realStartAt: null,
        realEndAt: null,
        presenceNote: null,
        presenceBy: null,
        presenceAt: null,
      },
    });
    await historiser(c.reservation.id, "Constat de présence effacé", libelle, user.name);
    return `Constat du ${libelle} effacé.`;
  }
  const erreurs = verifierSaisie(c, saisie);
  if (erreurs.length) throw new UserFacingError(erreurs.join(" "));
  const heures = heuresAConserver(c, saisie);
  const maj = await prisma.creneau.update({
    where: { id: c.id },
    data: {
      presence: saisie.presence,
      ...heures,
      presenceNote: saisie.note?.slice(0, 200) ?? null,
      presenceBy: user.name,
      presenceAt: now,
    },
  });
  const texte = decrirePresence(maj);
  await historiser(
    c.reservation.id,
    "Présence constatée",
    `${libelle} : ${texte}${saisie.note ? ` · ${saisie.note}` : ""}`,
    user.name,
  );
  await auditRecord(
    "constat presence",
    `${c.reservation.numero} · ${libelle} · ${texte}`,
    "planning",
    user.email,
  );
  return `${libelle} : ${texte}.`;
}
