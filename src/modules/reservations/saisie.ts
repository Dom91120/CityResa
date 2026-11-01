/**
 * Les données d'un formulaire de réservation côté back-office : espaces du périmètre,
 * organisations actives, natures d'événement, options et matériel (avec stock
 * disponible) d'un espace.
 */
import type { Materiel, Option, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { enabledIn } from "@/server/features";
import type { CurrentUser } from "@/server/guards";
import { stockDisponible } from "@/server/reservations";

export type EspaceSaisie = Prisma.EspaceGetPayload<{
  include: { site: true; nature: true; tarifs: { include: { profil: true } } };
}>;

export type MaterielDispo = { materiel: Materiel; dispo: number };

export async function espacesSaisie(user: CurrentUser) {
  return prisma.espace.findMany({
    where: {
      isActive: true,
      ...(user.espacesGeres.length ? { id: { in: user.espacesGeres } } : {}),
    },
    include: { site: true },
    orderBy: [{ site: { position: "asc" } }, { position: "asc" }, { name: "asc" }],
  });
}

export async function organisationsSaisie() {
  return prisma.organisation.findMany({
    where: { isActive: true },
    include: { profil: true },
    orderBy: { name: "asc" },
  });
}

export async function naturesEvenement() {
  return prisma.referential.findMany({
    where: { kind: "evenement_nature", isActive: true },
    orderBy: [{ position: "asc" }, { label: "asc" }],
  });
}

export async function agentsActifs() {
  return prisma.user.findMany({
    where: { kind: "agent", isActive: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function espaceSaisie(id: number): Promise<EspaceSaisie | null> {
  return prisma.espace.findUnique({
    where: { id },
    include: {
      site: true,
      nature: true,
      tarifs: { include: { profil: true }, orderBy: [{ position: "asc" }, { montant: "asc" }] },
    },
  });
}

/** Les options proposées pour un espace : les siennes et les globales, actives ; plus celles déjà retenues (`conserver`). */
export async function optionsPour(espaceId: number, conserver: number[] = []): Promise<Option[]> {
  return prisma.option.findMany({
    where: {
      OR: [
        { isActive: true, OR: [{ espaceId }, { espaceId: null }] },
        ...(conserver.length ? [{ id: { in: conserver } }] : []),
      ],
    },
    orderBy: [{ espaceId: "desc" }, { position: "asc" }, { label: "asc" }],
  });
}

/**
 * Le matériel mobilisable et son stock disponible sur la fenêtre (stock total si la
 * fenêtre n'est pas encore connue). Vide si le module Matériel est coupé.
 */
export async function materielsPour(
  user: CurrentUser,
  fenetre: { de: Date; a: Date } | null,
  excludeReservationId: number | null = null,
  conserver: number[] = [],
): Promise<MaterielDispo[]> {
  if (!enabledIn(user.settings, "materiel")) return [];
  const materiels = await prisma.materiel.findMany({
    where: conserver.length
      ? { OR: [{ isActive: true }, { id: { in: conserver } }] }
      : { isActive: true },
    orderBy: [{ categorieId: "asc" }, { name: "asc" }],
  });
  return Promise.all(
    materiels.map(async (m) => ({
      materiel: m,
      dispo: fenetre
        ? await stockDisponible(m.id, fenetre.de, fenetre.a, excludeReservationId)
        : m.stockTotal,
    })),
  );
}
