/**
 * Les campagnes annuelles de subventions : une par exercice, ouverte entre deux dates pour le
 * dépôt des dossiers sur le portail. Règles pures dans src/lib/campagne-subvention.ts.
 */
import type { CampagneSubvention } from "@/generated/prisma/client";
import {
  type CampagneRef,
  datesParDefaut,
  etatDepot,
  exerciceCampagne,
  labelCampagne,
  TRANSITIONS_CAMPAGNE_SUBVENTION,
} from "@/lib/campagne-subvention";
import { CAMPAGNE_SUBVENTION_STATUS } from "@/lib/constantes";
import { champ, champOuNull, parseDate, parseInt_ } from "@/lib/forms-util";
import { todayParisISO } from "@/lib/paris-time";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import type { CurrentUser } from "@/server/guards";

export function refCampagne(c: CampagneSubvention): CampagneRef {
  return {
    status: c.status,
    ouverture: c.ouvertureDate.toISOString().slice(0, 10),
    cloture: c.clotureDate.toISOString().slice(0, 10),
  };
}

/** La campagne « du moment » : ouverte et en période de dépôt, sinon la plus récente ouverte. */
export async function campagneCourante(now = new Date()): Promise<CampagneSubvention | null> {
  const ouvertes = await prisma.campagneSubvention.findMany({
    where: { status: "ouverte" },
    orderBy: { exercice: "desc" },
  });
  const jour = todayParisISO(now);
  return (
    ouvertes.find((c) => etatDepot(refCampagne(c), jour) === "ouvert") ??
    ouvertes.find((c) => etatDepot(refCampagne(c), jour) === "a_venir") ??
    ouvertes[0] ??
    null
  );
}

/** Le dépôt sur le portail est-il possible aujourd'hui pour cette campagne ? */
export function depotPortailOuvert(c: CampagneSubvention | null, now = new Date()): boolean {
  return Boolean(c && etatDepot(refCampagne(c), todayParisISO(now)) === "ouvert");
}

export async function chargerCampagnes(): Promise<
  (CampagneSubvention & { _count: { subventions: number } })[]
> {
  return prisma.campagneSubvention.findMany({
    include: { _count: { select: { subventions: true } } },
    orderBy: { exercice: "desc" },
  });
}

export type CampagneEntree = {
  exercice: number;
  label: string;
  ouverture: Date;
  cloture: Date;
  consignes: string | null;
};

export function lireCampagne(form: FormData): CampagneEntree {
  const exercice = parseInt_(form.get("exercice"), null);
  if (!exercice || exercice < 2000 || exercice > 2100)
    throw new UserFacingError("Indiquez l'exercice de la campagne.");
  const ouverture = parseDate(form.get("ouverture"));
  const cloture = parseDate(form.get("cloture"));
  if (!ouverture || !cloture)
    throw new UserFacingError("Indiquez les dates d'ouverture et de clôture.");
  if (cloture < ouverture) throw new UserFacingError("La clôture doit suivre l'ouverture.");
  return {
    exercice,
    label: champ(form, "label").slice(0, 120) || labelCampagne(exercice),
    ouverture,
    cloture,
    consignes: champOuNull(form, "consignes"),
  };
}

/** Les valeurs proposées pour une nouvelle campagne. */
export function campagneProposee(now = new Date()): CampagneEntree {
  const exercice = exerciceCampagne(now);
  const d = datesParDefaut(exercice);
  return {
    exercice,
    label: labelCampagne(exercice),
    ouverture: new Date(`${d.ouverture}T00:00:00Z`),
    cloture: new Date(`${d.cloture}T00:00:00Z`),
    consignes: null,
  };
}

export async function creerCampagne(
  e: CampagneEntree,
  acteur: CurrentUser,
): Promise<CampagneSubvention> {
  const existante = await prisma.campagneSubvention.findUnique({ where: { exercice: e.exercice } });
  if (existante)
    throw new UserFacingError(`Une campagne existe déjà pour l'exercice ${e.exercice}.`);
  const c = await prisma.campagneSubvention.create({
    data: {
      exercice: e.exercice,
      label: e.label,
      ouvertureDate: e.ouverture,
      clotureDate: e.cloture,
      consignes: e.consignes,
      createdBy: acteur.name,
    },
  });
  await auditRecord("création campagne subventions", c.label, "subventions", acteur.email);
  return c;
}

export async function modifierCampagne(
  id: number,
  e: CampagneEntree,
  acteur: CurrentUser,
): Promise<void> {
  const c = await prisma.campagneSubvention.findUnique({ where: { id } });
  if (!c) throw new UserFacingError("Campagne introuvable.");
  if (e.exercice !== c.exercice) {
    const autre = await prisma.campagneSubvention.findUnique({ where: { exercice: e.exercice } });
    if (autre) throw new UserFacingError(`Une campagne existe déjà pour l'exercice ${e.exercice}.`);
    const nb = await prisma.subvention.count({ where: { campagneId: id } });
    if (nb) throw new UserFacingError("Des dossiers sont rattachés : l'exercice ne change plus.");
  }
  await prisma.campagneSubvention.update({
    where: { id },
    data: {
      exercice: e.exercice,
      label: e.label,
      ouvertureDate: e.ouverture,
      clotureDate: e.cloture,
      consignes: e.consignes,
    },
  });
  await auditRecord("modification campagne subventions", e.label, "subventions", acteur.email);
}

export async function changerStatutCampagne(
  id: number,
  nouveau: string,
  acteur: CurrentUser,
): Promise<void> {
  const c = await prisma.campagneSubvention.findUnique({ where: { id } });
  if (!c) throw new UserFacingError("Campagne introuvable.");
  if (!(TRANSITIONS_CAMPAGNE_SUBVENTION[c.status] ?? []).includes(nouveau))
    throw new UserFacingError(
      `Passage de « ${CAMPAGNE_SUBVENTION_STATUS[c.status]?.label ?? c.status} » à « ${CAMPAGNE_SUBVENTION_STATUS[nouveau]?.label ?? nouveau} » impossible.`,
    );
  await prisma.campagneSubvention.update({ where: { id }, data: { status: nouveau } });
  await auditRecord(`campagne subventions ${nouveau}`, c.label, "subventions", acteur.email);
}

export async function supprimerCampagne(id: number, acteur: CurrentUser): Promise<void> {
  const c = await prisma.campagneSubvention.findUnique({
    where: { id },
    include: { _count: { select: { subventions: true } } },
  });
  if (!c) throw new UserFacingError("Campagne introuvable.");
  if (c._count.subventions)
    throw new UserFacingError("Des dossiers sont rattachés à cette campagne : clôturez-la plutôt.");
  await prisma.campagneSubvention.delete({ where: { id } });
  await auditRecord("suppression campagne subventions", c.label, "subventions", acteur.email);
}
