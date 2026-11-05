/**
 * Liste d'attente : inscription d'un usager sur un créneau occupé, retrait, et notification
 * quand un créneau de l'espace se libère (annulation, refus, option expirée, créneau annulé ou
 * déplacé). Règles pures dans src/lib/options.ts.
 */
import type { Intervalle } from "@/lib/creneaux";
import { isoParis, plage } from "@/lib/libelles";
import { entreesConcernees } from "@/lib/options";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import type { CurrentUser } from "@/server/guards";
import { envoyerDepuisModele } from "@/server/mailer";
import { notifier } from "@/server/notifications";

export async function inscrire(
  user: CurrentUser,
  espaceId: number,
  i: Intervalle,
  title: string | null,
): Promise<number> {
  const espace = await prisma.espace.findUnique({ where: { id: espaceId } });
  if (!espace?.isActive) throw new UserFacingError("Cet espace n'est pas disponible.");
  if (i.startAt < new Date()) throw new UserFacingError("Ce créneau est déjà passé.");
  const doublon = await prisma.listeAttente.findFirst({
    where: { userId: user.id, espaceId, startAt: i.startAt, endAt: i.endAt },
  });
  if (doublon) return doublon.id;
  const e = await prisma.listeAttente.create({
    data: {
      espaceId,
      organisationId: user.organisationId,
      userId: user.id,
      startAt: i.startAt,
      endAt: i.endAt,
      title: title?.slice(0, 160) ?? null,
    },
  });
  await auditRecord(
    "liste attente",
    `${espace.name} · ${plage(i.startAt, i.endAt)}`,
    "reservations",
    user.email,
  );
  return e.id;
}

export async function retirer(user: CurrentUser, id: number): Promise<void> {
  const e = await prisma.listeAttente.findUnique({ where: { id } });
  if (!e || e.userId !== user.id) throw new UserFacingError("Inscription introuvable.");
  await prisma.listeAttente.delete({ where: { id } });
}

/** Les inscriptions à venir d'un usager. */
export async function entreesDe(user: CurrentUser) {
  return prisma.listeAttente.findMany({
    where: { userId: user.id, endAt: { gt: new Date() } },
    include: { espace: { select: { id: true, name: true, shortName: true, slug: true } } },
    orderBy: { startAt: "asc" },
  });
}

/** Les inscriptions à venir sur un espace (back-office). */
export async function entreesEspace(espaceId: number) {
  return prisma.listeAttente.findMany({
    where: { espaceId, endAt: { gt: new Date() } },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      organisation: { select: { id: true, name: true } },
    },
    orderBy: { startAt: "asc" },
  });
}

/**
 * Des créneaux de l'espace viennent de se libérer : les inscrits concernés sont prévenus par
 * courriel (lien vers la demande pré-remplie) et notification, une seule fois.
 */
export async function notifierLiberation(espaceId: number, liberes: Intervalle[]): Promise<number> {
  if (!liberes.length) return 0;
  const entrees = await prisma.listeAttente.findMany({
    where: { espaceId, endAt: { gt: new Date() } },
    include: {
      user: { select: { id: true, email: true, firstName: true } },
      espace: { select: { name: true, slug: true } },
    },
  });
  const ids = new Set(entreesConcernees(entrees, espaceId, liberes));
  if (!ids.size) return 0;
  const cfg = await getSettings();
  for (const e of entrees.filter((x) => ids.has(x.id))) {
    const d = isoParis(e.startAt);
    const f = isoParis(e.endAt);
    const lien = `${cfg.APP_BASE_URL}/portail/reserver/${e.espace.slug}?date=${d.date}&heure_debut=${d.time}&heure_fin=${f.time}${e.title ? `&title=${encodeURIComponent(e.title)}` : ""}`;
    await envoyerDepuisModele("liste_attente_liberee", e.user.email, {
      prenom: e.user.firstName,
      espace: e.espace.name,
      creneau: plage(e.startAt, e.endAt),
      lien,
    });
    await notifier(
      e.user.id,
      "reservation",
      `${e.espace.name} : un créneau se libère`,
      plage(e.startAt, e.endAt),
      `/portail/reserver/${e.espace.slug}?date=${d.date}&heure_debut=${d.time}&heure_fin=${f.time}`,
    );
  }
  await prisma.listeAttente.updateMany({
    where: { id: { in: [...ids] } },
    data: { notifiedAt: new Date() },
  });
  return ids.size;
}
