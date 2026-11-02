/**
 * Les alertes du tableau de bord : ce qui réclame une action et qui n'est pas une simple
 * demande à traiter. Chaque alerte porte un compteur et le lien vers la liste filtrée
 * correspondante ; elle n'est montrée qu'aux agents qui ont le droit de voir le domaine.
 */
import { parseYmdUtc } from "@/lib/date-utc";
import { addParisDays, parisMidnight, todayParisISO } from "@/lib/paris-time";
import { etatValidite, type PieceJugee } from "@/lib/pieces";
import type { AppSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { allFlagsIn } from "@/server/features";
import type { CurrentUser } from "@/server/guards";

export type Alerte = {
  cle: string;
  niveau: "danger" | "warning" | "info";
  icone: string;
  titre: string;
  detail: string;
  nb: number;
  href: string;
};

/** Les documents datés des organisations actives, pour juger leurs pièces. */
export async function piecesDatees(): Promise<(PieceJugee & { organisationId: number })[]> {
  const rows = await prisma.document.findMany({
    where: {
      organisationId: { not: null },
      validUntil: { not: null },
      organisation: { isActive: true },
    },
    select: { kind: true, validUntil: true, organisationId: true },
  });
  return rows.map((r) => ({
    kind: r.kind,
    validUntil: r.validUntil,
    organisationId: r.organisationId as number,
  }));
}

/** Les organisations (ids) ayant au moins une pièce expirée, et celles qui expirent bientôt. */
export function organisationsParEtat(
  pieces: (PieceJugee & { organisationId: number })[],
  today: string,
  seuil: number,
): { expirees: Set<number>; bientot: Set<number> } {
  const expirees = new Set<number>();
  const bientot = new Set<number>();
  for (const p of pieces) {
    const e = etatValidite(p.validUntil, today, seuil);
    if (e === "expiree") expirees.add(p.organisationId);
    else if (e === "bientot") bientot.add(p.organisationId);
  }
  for (const id of expirees) bientot.delete(id);
  return { expirees, bientot };
}

export async function alertes(
  user: CurrentUser,
  cfg: AppSettings,
  now = new Date(),
): Promise<Alerte[]> {
  const features = allFlagsIn(cfg);
  const today = todayParisISO(now);
  const minuit = parisMidnight(today);
  const seuil = cfg.ALERTE_PIECES_JOURS ?? 30;
  const out: Alerte[] = [];
  const pluriel = (n: number, s: string, p: string) => (n > 1 ? p : s);

  if (features.documents && user.canView("usagers")) {
    const { expirees, bientot } = organisationsParEtat(await piecesDatees(), today, seuil);
    if (expirees.size)
      out.push({
        cle: "pieces_expirees",
        niveau: "danger",
        icone: "triangle-alert",
        titre: `${expirees.size} ${pluriel(expirees.size, "usager a une pièce expirée", "usagers ont une pièce expirée")}`,
        detail: "Attestation d'assurance ou autre pièce datée à renouveler.",
        nb: expirees.size,
        href: "/usagers?type=pieces",
      });
    if (bientot.size)
      out.push({
        cle: "pieces_bientot",
        niveau: "warning",
        icone: "clock",
        titre: `${bientot.size} ${pluriel(bientot.size, "pièce expire", "pièces expirent")} dans moins de ${seuil} jours`,
        detail: "Les usagers concernés sont prévenus par courriel.",
        nb: bientot.size,
        href: "/usagers?type=pieces",
      });
  }

  if (features.paiements && user.canView("paiements")) {
    const n = await prisma.facture.count({
      where: { status: "a_payer", dueAt: { lt: parseYmdUtc(today) } },
    });
    if (n)
      out.push({
        cle: "factures_echues",
        niveau: "danger",
        icone: "receipt",
        titre: `${n} facture${n > 1 ? "s" : ""} échue${n > 1 ? "s" : ""} non réglée${n > 1 ? "s" : ""}`,
        detail: "Échéance dépassée : relance ou encaissement à saisir.",
        nb: n,
        href: "/paiements?statut=retard",
      });
  }

  if (features.signature && user.canView("reservations")) {
    const limite = addParisDays(minuit, -(cfg.RELANCE_SIGNATURE_JOURS || 3));
    const n = await prisma.reservation.count({
      where: { status: "acceptee", signedAt: null, signatureSentAt: { lt: limite } },
    });
    if (n)
      out.push({
        cle: "signatures_retard",
        niveau: "warning",
        icone: "file-signature",
        titre: `${n} convention${n > 1 ? "s" : ""} en attente de signature depuis plus de ${cfg.RELANCE_SIGNATURE_JOURS || 3} jours`,
        detail: "L'usager n'a pas signé malgré la relance.",
        nb: n,
        href: "/reservations?statut=acceptee",
      });
  }

  if (user.canView("reservations")) {
    const n = await prisma.reservation.count({
      where: {
        status: { in: ["a_traiter", "en_traitement"] },
        createdAt: { lt: addParisDays(minuit, -7) },
        ...(user.espacesGeres.length ? { espaceId: { in: user.espacesGeres } } : {}),
      },
    });
    if (n)
      out.push({
        cle: "demandes_anciennes",
        niveau: "warning",
        icone: "clock",
        titre: `${n} demande${n > 1 ? "s" : ""} sans réponse depuis plus de 7 jours`,
        detail: "Les usagers attendent une décision.",
        nb: n,
        href: "/reservations?statut=a_traiter",
      });
  }

  if (user.canView("usagers")) {
    const n = await prisma.organisation.count({ where: { validatedAt: null, isActive: true } });
    if (n)
      out.push({
        cle: "usagers_a_valider",
        niveau: "info",
        icone: "badge-check",
        titre: `${n} fiche${n > 1 ? "s" : ""} d'usager à valider`,
        detail: "Sans validation, l'usager n'accède pas aux tarifs de son profil.",
        nb: n,
        href: "/usagers?type=a_valider",
      });
  }

  if (user.canView("messages")) {
    const n = await prisma.message.count({
      where: { readAt: null, authorKind: "usager", isInternal: false },
    });
    if (n)
      out.push({
        cle: "messages",
        niveau: "info",
        icone: "message-circle",
        titre: `${n} message${n > 1 ? "s" : ""} d'usager sans réponse`,
        detail: "Fil de discussion d'un dossier.",
        nb: n,
        href: "/messages",
      });
  }

  const ordre = { danger: 0, warning: 1, info: 2 };
  return out.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
}
