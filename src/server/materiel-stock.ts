/**
 * Matériel : mouvements de stock. Sortie et retour (avec manquants) du matériel d'un dossier,
 * panne ou perte, remise en service, contrôle périodique ; journal par matériel et contrôles
 * en retard pour le tableau de bord. Règles pures dans src/lib/materiel-stock.ts.
 */
import {
  controleEnRetard,
  verifierPanne,
  verifierRemise,
  verifierRetour,
} from "@/lib/materiel-stock";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import type { CurrentUser } from "@/server/guards";
import { historiser } from "@/server/reservations";

async function ligne(reservationId: number, materielId: number) {
  const l = await prisma.reservationMateriel.findUnique({
    where: { reservationId_materielId: { reservationId, materielId } },
    include: { materiel: true, reservation: { select: { numero: true } } },
  });
  if (!l) throw new UserFacingError("Ce matériel n'est pas sur ce dossier.");
  return l;
}

/** Le matériel d'un dossier est remis à l'usager. */
export async function sortirMateriel(user: CurrentUser, reservationId: number, materielId: number) {
  const l = await ligne(reservationId, materielId);
  if (l.sortieAt) throw new UserFacingError("Ce matériel est déjà sorti.");
  const now = new Date();
  await prisma.$transaction([
    prisma.reservationMateriel.update({
      where: { reservationId_materielId: { reservationId, materielId } },
      data: { sortieAt: now, retourAt: null, manquants: 0 },
    }),
    prisma.mouvementMateriel.create({
      data: {
        materielId,
        reservationId,
        kind: "sortie",
        quantite: l.quantite,
        createdBy: user.name,
      },
    }),
  ]);
  await historiser(
    reservationId,
    "Matériel sorti",
    `${l.quantite} × ${l.materiel.name}`,
    user.name,
  );
  return `${l.quantite} × ${l.materiel.name} : sortie enregistrée.`;
}

/** Le matériel revient ; les unités manquantes sont signalées et retirées du stock utilisable. */
export async function retournerMateriel(
  user: CurrentUser,
  reservationId: number,
  materielId: number,
  rendus: number,
  note: string | null,
) {
  const l = await ligne(reservationId, materielId);
  const v = verifierRetour(l, rendus);
  if (!v.ok) throw new UserFacingError(v.erreur);
  const now = new Date();
  const detail = note?.slice(0, 300) ?? null;
  await prisma.$transaction([
    prisma.reservationMateriel.update({
      where: { reservationId_materielId: { reservationId, materielId } },
      data: { retourAt: now, manquants: v.manquants },
    }),
    prisma.mouvementMateriel.create({
      data: {
        materielId,
        reservationId,
        kind: "retour",
        quantite: rendus,
        note: detail,
        createdBy: user.name,
      },
    }),
    ...(v.manquants
      ? [
          prisma.mouvementMateriel.create({
            data: {
              materielId,
              reservationId,
              kind: "perte",
              quantite: v.manquants,
              note: detail ?? `Manquant au retour du dossier ${l.reservation.numero}`,
              createdBy: user.name,
            },
          }),
          prisma.materiel.update({
            where: { id: materielId },
            data: { horsService: { increment: v.manquants } },
          }),
        ]
      : []),
  ]);
  const texte = v.manquants
    ? `${rendus} rendu(s) sur ${l.quantite}, ${v.manquants} manquant(s)`
    : `${rendus} rendu(s) sur ${l.quantite}`;
  await historiser(
    reservationId,
    v.manquants ? "Matériel rendu avec manquants" : "Matériel rendu",
    `${l.materiel.name} : ${texte}${detail ? ` · ${detail}` : ""}`,
    user.name,
  );
  if (v.manquants)
    await auditRecord(
      "materiel manquant",
      `${l.materiel.name} · ${v.manquants} · dossier ${l.reservation.numero}`,
      "materiel",
      user.email,
    );
  return `${l.materiel.name} : ${texte}.`;
}

/** Une panne ou une perte constatée hors dossier retire des unités du stock utilisable. */
export async function signalerPanne(
  user: CurrentUser,
  materielId: number,
  quantite: number,
  note: string | null,
) {
  const m = await prisma.materiel.findUnique({ where: { id: materielId } });
  if (!m) throw new UserFacingError("Matériel introuvable.");
  const erreur = verifierPanne(m, quantite);
  if (erreur) throw new UserFacingError(erreur);
  await prisma.$transaction([
    prisma.materiel.update({
      where: { id: materielId },
      data: { horsService: { increment: quantite } },
    }),
    prisma.mouvementMateriel.create({
      data: {
        materielId,
        kind: "panne",
        quantite,
        note: note?.slice(0, 300) ?? null,
        createdBy: user.name,
      },
    }),
  ]);
  await auditRecord(
    "materiel panne",
    `${m.name} · ${quantite}${note ? ` · ${note}` : ""}`,
    "materiel",
    user.email,
  );
  return `${quantite} unité(s) de ${m.name} hors service : stock utilisable ${m.stockTotal - m.horsService - quantite}.`;
}

/** Des unités réparées ou retrouvées reviennent au stock. */
export async function remettreEnService(
  user: CurrentUser,
  materielId: number,
  quantite: number,
  note: string | null,
) {
  const m = await prisma.materiel.findUnique({ where: { id: materielId } });
  if (!m) throw new UserFacingError("Matériel introuvable.");
  const erreur = verifierRemise(m, quantite);
  if (erreur) throw new UserFacingError(erreur);
  await prisma.$transaction([
    prisma.materiel.update({
      where: { id: materielId },
      data: { horsService: { decrement: quantite } },
    }),
    prisma.mouvementMateriel.create({
      data: {
        materielId,
        kind: "reparation",
        quantite,
        note: note?.slice(0, 300) ?? null,
        createdBy: user.name,
      },
    }),
  ]);
  await auditRecord("materiel remis en service", `${m.name} · ${quantite}`, "materiel", user.email);
  return `${quantite} unité(s) de ${m.name} remise(s) en service.`;
}

/** Le contrôle périodique est fait aujourd'hui. */
export async function controlerMateriel(
  user: CurrentUser,
  materielId: number,
  note: string | null,
) {
  const m = await prisma.materiel.findUnique({ where: { id: materielId } });
  if (!m) throw new UserFacingError("Matériel introuvable.");
  const now = new Date();
  await prisma.$transaction([
    prisma.materiel.update({ where: { id: materielId }, data: { dernierControleAt: now } }),
    prisma.mouvementMateriel.create({
      data: {
        materielId,
        kind: "controle",
        quantite: m.stockTotal,
        note: note?.slice(0, 300) ?? null,
        createdBy: user.name,
      },
    }),
  ]);
  await auditRecord(
    "materiel controle",
    `${m.name}${note ? ` · ${note}` : ""}`,
    "materiel",
    user.email,
  );
  return `Contrôle de ${m.name} enregistré.`;
}

/** Le journal d'un matériel, le plus récent d'abord. */
export async function mouvementsDe(materielId: number, limite = 50) {
  return prisma.mouvementMateriel.findMany({
    where: { materielId },
    include: { reservation: { select: { id: true, numero: true } } },
    orderBy: { createdAt: "desc" },
    take: limite,
  });
}

/** Les matériels actifs dont le contrôle périodique est échu. */
export async function controlesEnRetard(now = new Date()) {
  const liste = await prisma.materiel.findMany({
    where: { isActive: true, controleMois: { not: null } },
    select: { id: true, name: true, controleMois: true, dernierControleAt: true, createdAt: true },
  });
  return liste.filter((m) => controleEnRetard(m, now));
}
