/**
 * Le planning : fenêtre affichée (semaine, mois, jour) en heure de Paris, espaces du
 * périmètre, créneaux vivants et blocages sur la fenêtre, répartition par jour.
 */
import type { Prisma } from "@/generated/prisma/client";
import { STATUTS_OCCUPANTS } from "@/lib/constantes";
import { chevauche } from "@/lib/creneaux";
import { parseInt_ } from "@/lib/forms-util";
import { dateJourMois, dateLongue, moisAnnee } from "@/lib/libelles";
import { addParisDays, parisMidnight, parisParts, todayParisISO } from "@/lib/paris-time";
import { prisma } from "@/server/db";
import type { CurrentUser } from "@/server/guards";
import type { Params } from "@/server/paging";
import { param } from "@/server/paging";

export type Vue = "semaine" | "mois" | "jour";

export type Fenetre = {
  vue: Vue;
  /** La date d'ancrage « YYYY-MM-DD ». */
  date: string;
  /** Les jours affichés (clés « YYYY-MM-DD »). */
  jours: string[];
  de: Date;
  a: Date;
  label: string;
  precedent: string;
  suivant: string;
  /** Pour la vue mois : le mois « YYYY-MM » affiché. */
  mois: string;
};

export const HEURE_DEBUT_JOUR = 7;
export const HEURE_FIN_JOUR = 23;

function cle(d: Date): string {
  return parisParts(d).dateKey;
}

export function lireVue(v: string | undefined): Vue {
  return v === "mois" || v === "jour" ? v : "semaine";
}

export function lireDate(v: string | undefined): string {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parisMidnight(v).getTime())
    ? v
    : todayParisISO();
}

/** La fenêtre d'une vue ancrée sur une date. */
export function fenetre(vue: Vue, date: string): Fenetre {
  const ancre = parisMidnight(date);
  if (vue === "jour") {
    return {
      vue,
      date,
      jours: [date],
      de: ancre,
      a: addParisDays(ancre, 1),
      label: dateLongue(ancre).replace(/^./, (c) => c.toUpperCase()),
      precedent: cle(addParisDays(ancre, -1)),
      suivant: cle(addParisDays(ancre, 1)),
      mois: date.slice(0, 7),
    };
  }
  if (vue === "mois") {
    const premier = parisMidnight(`${date.slice(0, 7)}-01`);
    const [y, m] = date.split("-").map(Number);
    const moisSuivant = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const moisPrecedent = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
    const debutGrille = addParisDays(premier, -(parisParts(premier).weekday - 1));
    const finMois = parisMidnight(moisSuivant);
    const jours: string[] = [];
    let cur = debutGrille;
    // Des semaines entières jusqu'à couvrir la fin du mois.
    while (cur < finMois || jours.length % 7 !== 0) {
      jours.push(cle(cur));
      cur = addParisDays(cur, 1);
      if (jours.length >= 42) break;
    }
    return {
      vue,
      date,
      jours,
      de: debutGrille,
      a: cur,
      label: moisAnnee(premier),
      precedent: moisPrecedent,
      suivant: moisSuivant,
      mois: date.slice(0, 7),
    };
  }
  const lundi = addParisDays(ancre, -(parisParts(ancre).weekday - 1));
  const jours = Array.from({ length: 7 }, (_, i) => cle(addParisDays(lundi, i)));
  const dimanche = addParisDays(lundi, 6);
  return {
    vue,
    date,
    jours,
    de: lundi,
    a: addParisDays(lundi, 7),
    label: `Semaine du ${dateJourMois(lundi)} au ${dateJourMois(dimanche)} ${parisParts(dimanche).dateKey.slice(0, 4)}`,
    precedent: cle(addParisDays(lundi, -7)),
    suivant: cle(addParisDays(lundi, 7)),
    mois: date.slice(0, 7),
  };
}

export type FiltresPlanning = { site: number | null; espaces: number[] };

export function lireFiltresPlanning(params: Params): FiltresPlanning {
  const brut = params.espace;
  const liste = Array.isArray(brut) ? brut : brut ? [brut] : [];
  return {
    site: parseInt_(param(params, "site"), null, 1),
    espaces: liste.map((v) => parseInt_(v, null, 1)).filter((n): n is number => n !== null),
  };
}

export const INCLUDE_ESPACE_PLANNING = {
  site: true,
  nature: true,
  documents: { where: { kind: "photo" }, orderBy: { position: "asc" as const }, take: 1 },
} satisfies Prisma.EspaceInclude;

export type EspacePlanning = Prisma.EspaceGetPayload<{ include: typeof INCLUDE_ESPACE_PLANNING }>;

export type EvtResa = {
  id: number;
  reservationId: number;
  numero: string;
  titre: string;
  status: string;
  qui: string;
  espaceId: number;
  startAt: Date;
  endAt: Date;
};

export type Blocage = {
  id: number;
  espaceId: number;
  startAt: Date;
  endAt: Date;
  motif: string | null;
};

/** Les espaces visibles par l'agent (périmètre, site, sélection). */
export async function espacesPlanning(
  user: CurrentUser,
  f: FiltresPlanning,
): Promise<EspacePlanning[]> {
  const and: Prisma.EspaceWhereInput[] = [{ isActive: true }];
  if (user.espacesGeres.length) and.push({ id: { in: user.espacesGeres } });
  if (f.site) and.push({ siteId: f.site });
  if (f.espaces.length) and.push({ id: { in: f.espaces } });
  return prisma.espace.findMany({
    where: { AND: and },
    include: INCLUDE_ESPACE_PLANNING,
    orderBy: [{ site: { position: "asc" } }, { position: "asc" }, { name: "asc" }],
  });
}

/** Tous les espaces du périmètre (pour le filtre), sans tenir compte de la sélection. */
export async function espacesDuPerimetre(user: CurrentUser) {
  return prisma.espace.findMany({
    where: {
      isActive: true,
      ...(user.espacesGeres.length ? { id: { in: user.espacesGeres } } : {}),
    },
    include: { site: true },
    orderBy: [{ site: { position: "asc" } }, { position: "asc" }, { name: "asc" }],
  });
}

/** Créneaux vivants et blocages des espaces sur la fenêtre. */
export async function occupationsPlanning(
  espaceIds: number[],
  fen: Fenetre,
): Promise<{ creneaux: EvtResa[]; blocages: Blocage[] }> {
  if (!espaceIds.length) return { creneaux: [], blocages: [] };
  const [creneaux, blocages] = await Promise.all([
    prisma.creneau.findMany({
      where: {
        espaceId: { in: espaceIds },
        status: "prevu",
        startAt: { lt: fen.a },
        endAt: { gt: fen.de },
        reservation: { status: { in: STATUTS_OCCUPANTS } },
      },
      include: {
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
    }),
    prisma.indisponibilite.findMany({
      where: { espaceId: { in: espaceIds }, startAt: { lt: fen.a }, endAt: { gt: fen.de } },
      orderBy: { startAt: "asc" },
    }),
  ]);
  return {
    creneaux: creneaux.map((c) => ({
      id: c.id,
      reservationId: c.reservation.id,
      numero: c.reservation.numero,
      titre: c.reservation.title,
      status: c.reservation.status,
      qui:
        c.reservation.organisation?.name ??
        (c.reservation.user
          ? `${c.reservation.user.firstName} ${c.reservation.user.lastName}`.trim()
          : ""),
      espaceId: c.espaceId,
      startAt: c.startAt,
      endAt: c.endAt,
    })),
    blocages: blocages.map((b) => ({
      id: b.id,
      espaceId: b.espaceId,
      startAt: b.startAt,
      endAt: b.endAt,
      motif: b.motif,
    })),
  };
}

/** Les bornes d'un jour calendaire de Paris. */
export function bornesJour(jour: string): { startAt: Date; endAt: Date } {
  const startAt = parisMidnight(jour);
  return { startAt, endAt: addParisDays(startAt, 1) };
}

/** Les éléments qui touchent un jour (un créneau sur plusieurs jours apparaît chaque jour). */
export function duJour<T extends { startAt: Date; endAt: Date }>(items: T[], jour: string): T[] {
  const b = bornesJour(jour);
  return items.filter((i) => chevauche(i, b));
}

export function estWeekend(jour: string): boolean {
  const w = parisParts(parisMidnight(jour)).weekday;
  return w === 6 || w === 7;
}
