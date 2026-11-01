/**
 * Les chiffres du tableau de bord et des statistiques : indicateurs sur une période,
 * occupation par espace, répartition des usagers, revenus par mois, à traiter.
 */
import { STATUTS_FERMES, STATUTS_OCCUPANTS } from "@/lib/constantes";
import { type Horaires, lireHoraires } from "@/lib/creneaux";
import { minutesDe, parisParts } from "@/lib/paris-time";
import { prisma } from "@/server/db";
import type { CurrentUser } from "@/server/guards";

export type Periode = { de: Date; a: Date; label: string };

/** Heures d'ouverture hebdomadaires d'un espace (défaut 14 h × 7). */
function heuresOuvertureHebdo(h: Horaires | null): number {
  if (!h) return 14 * 7;
  let total = 0;
  for (const plages of Object.values(h))
    for (const [o, f] of plages) {
      const a = minutesDe(o);
      const b = minutesDe(f);
      if (a !== null && b !== null) total += ((b === 0 ? 1440 : b) - a) / 60;
    }
  return total || 14 * 7;
}

export async function indicateurs(p: Periode, prec: Periode) {
  const compter = async (q: Periode) => {
    const [demandes, confirmees, annulees, revenus] = await Promise.all([
      prisma.reservation.count({ where: { createdAt: { gte: q.de, lt: q.a } } }),
      prisma.reservation.count({
        where: {
          status: { in: ["confirmee", "terminee", "signee"] },
          startAt: { gte: q.de, lt: q.a },
        },
      }),
      prisma.reservation.count({
        where: { status: { in: ["annulee", "refusee"] }, updatedAt: { gte: q.de, lt: q.a } },
      }),
      prisma.facture.aggregate({
        where: { status: "payee", paidAt: { gte: q.de, lt: q.a }, type: { not: "caution" } },
        _sum: { montantTtc: true },
      }),
    ]);
    return { demandes, confirmees, annulees, revenus: revenus._sum.montantTtc ?? 0 };
  };
  const [actuel, precedent, espaces, a_traiter, signatures, factures, messages] = await Promise.all(
    [
      compter(p),
      compter(prec),
      prisma.espace.count({ where: { isActive: true, isPublic: true, status: "actif" } }),
      prisma.reservation.count({ where: { status: { in: ["a_traiter", "en_traitement"] } } }),
      prisma.reservation.count({ where: { status: "acceptee", signedAt: null } }),
      prisma.facture.count({ where: { status: "a_payer" } }),
      prisma.message.count({ where: { readAt: null, authorKind: "usager", isInternal: false } }),
    ],
  );
  const delta = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);
  return {
    espaces,
    demandes: { valeur: actuel.demandes, delta: delta(actuel.demandes, precedent.demandes) },
    confirmees: {
      valeur: actuel.confirmees,
      delta: delta(actuel.confirmees, precedent.confirmees),
    },
    annulees: { valeur: actuel.annulees, delta: delta(actuel.annulees, precedent.annulees) },
    revenus: { valeur: actuel.revenus, delta: delta(actuel.revenus, precedent.revenus) },
    a_traiter,
    signatures,
    factures,
    messages,
  };
}

/** Taux d'occupation par espace sur la période (heures réservées / heures ouvertes). */
export async function occupationParEspace(p: Periode) {
  const espaces = await prisma.espace.findMany({
    where: { isActive: true },
    include: { site: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  const creneaux = await prisma.creneau.findMany({
    where: {
      status: "prevu",
      startAt: { lt: p.a },
      endAt: { gt: p.de },
      reservation: { status: { in: STATUTS_FERMES } },
    },
    select: { espaceId: true, startAt: true, endAt: true },
  });
  const semaines = Math.max(1, (p.a.getTime() - p.de.getTime()) / (7 * 86_400_000));
  return espaces.map((e) => {
    const heures = creneaux
      .filter((c) => c.espaceId === e.id)
      .reduce(
        (s, c) =>
          s +
          (Math.min(c.endAt.getTime(), p.a.getTime()) -
            Math.max(c.startAt.getTime(), p.de.getTime())) /
            36e5,
        0,
      );
    const ouvertes = heuresOuvertureHebdo(lireHoraires(e.openHours)) * semaines;
    return {
      id: e.id,
      name: e.name,
      shortName: e.shortName,
      site: e.site.name,
      color: e.color,
      heures: Math.round(heures * 10) / 10,
      taux: Math.min(100, Math.round((heures / ouvertes) * 1000) / 10),
      nb: creneaux.filter((c) => c.espaceId === e.id).length,
    };
  });
}

/** Répartition des réservations par type d'usager. */
export async function repartitionUsagers(p: Periode) {
  const rows = await prisma.reservation.findMany({
    where: {
      startAt: { gte: p.de, lt: p.a },
      status: { in: STATUTS_OCCUPANTS.concat(["terminee"]) },
    },
    select: { organisation: { select: { type: true } } },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const t = r.organisation?.type ?? "particulier";
    counts[t] = (counts[t] ?? 0) + 1;
  }
  return counts;
}

/** Revenus encaissés par mois sur les 12 derniers mois. */
export async function revenusParMois(a: Date) {
  const de = new Date(a.getTime());
  de.setMonth(de.getMonth() - 11, 1);
  de.setHours(0, 0, 0, 0);
  const paiements = await prisma.paiement.findMany({
    where: { paidAt: { gte: de, lt: a }, facture: { type: { not: "caution" } } },
    select: { paidAt: true, montant: true },
  });
  const demandes = await prisma.reservation.findMany({
    where: { createdAt: { gte: de, lt: a } },
    select: { createdAt: true },
  });
  const mois: { cle: string; label: string; revenus: number; demandes: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(de.getTime());
    d.setMonth(d.getMonth() + i);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    mois.push({
      cle,
      label: d.toLocaleDateString("fr-FR", {
        month: "short",
        year: "2-digit",
        timeZone: "Europe/Paris",
      }),
      revenus: 0,
      demandes: 0,
    });
  }
  for (const pm of paiements) {
    const k = parisParts(pm.paidAt).dateKey.slice(0, 7);
    const m = mois.find((x) => x.cle === k);
    if (m) m.revenus += pm.montant;
  }
  for (const r of demandes) {
    const k = parisParts(r.createdAt).dateKey.slice(0, 7);
    const m = mois.find((x) => x.cle === k);
    if (m) m.demandes += 1;
  }
  return mois.map((m) => ({ ...m, revenus: Math.round(m.revenus * 100) / 100 }));
}

/** Les demandes à traiter d'un agent (son périmètre), les plus anciennes en tête. */
export async function aTraiterPour(user: CurrentUser, limite = 8) {
  return prisma.reservation.findMany({
    where: {
      status: { in: ["a_traiter", "en_traitement"] },
      ...(user.espacesGeres.length ? { espaceId: { in: user.espacesGeres } } : {}),
    },
    include: {
      espace: { select: { name: true, shortName: true, color: true } },
      organisation: { select: { name: true, type: true } },
      user: { select: { firstName: true, lastName: true } },
      _count: { select: { creneaux: true } },
    },
    orderBy: { createdAt: "asc" },
    take: limite,
  });
}

/** Les réservations du jour et des prochains jours. */
export async function prochainement(de: Date, jours: number, limite = 10) {
  const a = new Date(de.getTime() + jours * 86_400_000);
  return prisma.creneau.findMany({
    where: {
      status: "prevu",
      startAt: { gte: de, lt: a },
      reservation: { status: { in: STATUTS_FERMES } },
    },
    include: {
      espace: { select: { name: true, shortName: true, color: true } },
      reservation: {
        select: {
          id: true,
          numero: true,
          title: true,
          status: true,
          organisation: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { startAt: "asc" },
    take: limite,
  });
}
