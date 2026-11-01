/**
 * Le catalogue public : les espaces visibles sur le portail, leur photo principale, le
 * profil tarifaire de l'usager connecté, les restrictions d'accès, le calendrier de
 * disponibilité d'un mois (calculé côté serveur depuis `occupants()` et les horaires
 * d'ouverture) et l'image de fond du bandeau d'accueil.
 */
import type { Prisma } from "@/generated/prisma/client";
import { type Horaires, type Intervalle, lireHoraires } from "@/lib/creneaux";
import { pad2 } from "@/lib/date-utc";
import {
  addParisDays,
  minutesDe,
  parisMidnight,
  parisParts,
  todayParisISO,
} from "@/lib/paris-time";
import { prisma } from "@/server/db";
import type { CurrentUser } from "@/server/guards";
import { occupants } from "@/server/reservations";

export const INCLUDE_ESPACE_PORTAIL = {
  site: true,
  nature: true,
  tarifs: { orderBy: { position: "asc" as const } },
  equipements: { include: { equipement: true } },
  documents: {
    where: { isPublic: true },
    orderBy: [{ position: "asc" as const }, { createdAt: "desc" as const }],
  },
} satisfies Prisma.EspaceInclude;

export type EspacePortail = Prisma.EspaceGetPayload<{ include: typeof INCLUDE_ESPACE_PORTAIL }>;

/** Ce qui rend un espace visible sur le portail. */
export const WHERE_ESPACE_PUBLIC: Prisma.EspaceWhereInput = {
  isActive: true,
  isPublic: true,
  status: "actif",
  site: { isActive: true },
};

/** Les espaces du catalogue, triés par position puis par nom. */
export async function espacesPublics(): Promise<EspacePortail[]> {
  return prisma.espace.findMany({
    where: WHERE_ESPACE_PUBLIC,
    include: INCLUDE_ESPACE_PORTAIL,
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

/** Un espace du catalogue par son slug (null s'il n'est pas visible). */
export async function espacePublic(slug: string): Promise<EspacePortail | null> {
  return prisma.espace.findFirst({
    where: { slug, ...WHERE_ESPACE_PUBLIC },
    include: INCLUDE_ESPACE_PORTAIL,
  });
}

/** Les photos publiques d'un espace, la première est la principale. */
export function photos<D extends { kind: string; isPublic: boolean; id: number }>(e: {
  documents: D[];
}): D[] {
  return e.documents.filter((d) => d.kind === "photo" && d.isPublic);
}

export function photoPrincipale<D extends { kind: string; isPublic: boolean; id: number }>(e: {
  documents: D[];
}): D | null {
  return photos(e)[0] ?? null;
}

/** Les documents publics (règlement, plan…) d'un espace. */
export function documentsPublics(e: EspacePortail) {
  return e.documents.filter((d) => d.kind !== "photo" && d.isPublic);
}

/** Le profil tarifaire de l'organisation d'un usager (id et code), ou null. */
export async function profilDe(
  user: CurrentUser | null,
): Promise<{ id: number; code: string | null; label: string } | null> {
  if (!user?.organisationId) return null;
  const org = await prisma.organisation.findUnique({
    where: { id: user.organisationId },
    select: { profil: { select: { id: true, code: true, label: true } } },
  });
  return org?.profil ?? null;
}

/** L'organisation d'un usager (avec son profil), ou null. */
export async function organisationDe(user: CurrentUser | null) {
  if (!user?.organisationId) return null;
  return prisma.organisation.findUnique({
    where: { id: user.organisationId },
    include: { profil: true },
  });
}

/** L'espace est-il ouvert à ce profil ? (liste vide = tous). */
export function profilAutorise(allowedProfiles: string[], code: string | null): boolean {
  if (!allowedProfiles.length) return true;
  return Boolean(code && allowedProfiles.includes(code));
}

/** « Réservé aux associations de la commune, services de la collectivité ». */
export function libelleReserveA(
  allowedProfiles: string[],
  profils: { code: string | null; label: string }[],
): string {
  const noms = allowedProfiles.map(
    (c) => profils.find((p) => p.code === c)?.label.toLowerCase() ?? c,
  );
  return `Réservé aux ${noms.join(", ")}`;
}

/** L'image de fond du bandeau d'accueil : la première photo publique d'un site ou d'un espace. */
export async function imageAccueil(): Promise<{ id: number } | null> {
  const d = await prisma.document.findFirst({
    where: {
      kind: "photo",
      isPublic: true,
      OR: [{ siteId: { not: null } }, { espace: WHERE_ESPACE_PUBLIC }],
    },
    orderBy: [{ siteId: "desc" }, { position: "asc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  return d;
}

// ── Calendrier de disponibilité ──

export type EtatJour = "libre" | "partiel" | "occupe" | "ferme" | "passe";

export type JourDispo = { date: string; jour: number; etat: EtatJour };

export type MoisDispo = {
  /** « YYYY-MM » */
  cle: string;
  annee: number;
  mois: number;
  /** Jour ISO du 1er du mois (1 = lundi). */
  premierJourIso: number;
  jours: JourDispo[];
  precedent: string;
  suivant: string;
};

/** « YYYY-MM » valide, sinon le mois courant (Paris). */
export function moisDemande(raw: string | undefined, now = new Date()): string {
  if (raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  return todayParisISO(now).slice(0, 7);
}

function decalerMois(annee: number, mois: number, n: number): string {
  const d = new Date(Date.UTC(annee, mois - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/** Les plages ouvertes d'un jour ISO, en minutes depuis minuit. */
function plagesDuJour(horaires: Horaires | null, weekday: number): [number, number][] {
  if (!horaires) return [[0, 1440]];
  const plages = horaires[String(weekday)] ?? [];
  const out: [number, number][] = [];
  for (const [o, f] of plages) {
    const a = minutesDe(o);
    const b = minutesDe(f);
    if (a === null || b === null) continue;
    out.push([a, b === 0 ? 1440 : b]);
  }
  return out;
}

/** Minutes du jour (Paris) couvertes par l'intervalle, bornées à [0, 1440]. */
function minutesDansJour(i: Intervalle, debutJour: Date, finJour: Date): [number, number] | null {
  const a = i.startAt > debutJour ? i.startAt : debutJour;
  const b = i.endAt < finJour ? i.endAt : finJour;
  if (b <= a) return null;
  const ma = Math.round((a.getTime() - debutJour.getTime()) / 60_000);
  const mb = Math.round((b.getTime() - debutJour.getTime()) / 60_000);
  return [Math.max(0, ma), Math.min(1440, mb)];
}

/**
 * Le calendrier d'un mois pour un espace : chaque jour est libre, partiellement occupé,
 * entièrement occupé (sur ses heures d'ouverture), fermé (aucun horaire ce jour-là) ou
 * passé (avant aujourd'hui + délai minimal de réservation).
 */
export async function calendrierMois(
  espace: { id: number; openHours: unknown; delayMinDays: number; horizonMaxDays: number },
  cle: string,
  now = new Date(),
): Promise<MoisDispo> {
  const [annee, mois] = cle.split("-").map(Number);
  const nbJours = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  const debut = parisMidnight(`${annee}-${pad2(mois)}-01`);
  const fin = addParisDays(parisMidnight(`${annee}-${pad2(mois)}-${pad2(nbJours)}`), 1);
  const occ = await occupants(espace.id, debut, fin);
  const horaires = lireHoraires(espace.openHours);
  const premierOuvert = addParisDays(parisMidnight(todayParisISO(now)), espace.delayMinDays);
  const dernierOuvert = addParisDays(parisMidnight(todayParisISO(now)), espace.horizonMaxDays);
  const jours: JourDispo[] = [];
  for (let j = 1; j <= nbJours; j++) {
    const date = `${annee}-${pad2(mois)}-${pad2(j)}`;
    const debutJour = parisMidnight(date);
    const finJour = addParisDays(debutJour, 1);
    const weekday = parisParts(debutJour).weekday;
    let etat: EtatJour;
    const plages = plagesDuJour(horaires, weekday);
    if (debutJour < premierOuvert || debutJour > dernierOuvert) etat = "passe";
    else if (!plages.length) etat = "ferme";
    else {
      const ouvert = plages.reduce((s, [a, b]) => s + Math.max(0, b - a), 0);
      // Minutes d'ouverture couvertes par au moins une occupation (union des segments).
      const segments: [number, number][] = [];
      for (const o of occ) {
        const m = minutesDansJour(o, debutJour, finJour);
        if (!m) continue;
        for (const [a, b] of plages) {
          const x = Math.max(a, m[0]);
          const y = Math.min(b, m[1]);
          if (y > x) segments.push([x, y]);
        }
      }
      segments.sort((p, q) => p[0] - q[0]);
      let couvert = 0;
      let curA = -1;
      let curB = -1;
      for (const [a, b] of segments) {
        if (a > curB) {
          if (curB > curA) couvert += curB - curA;
          curA = a;
          curB = b;
        } else if (b > curB) curB = b;
      }
      if (curB > curA) couvert += curB - curA;
      etat = couvert <= 0 ? "libre" : couvert >= ouvert - 1 ? "occupe" : "partiel";
    }
    jours.push({ date, jour: j, etat });
  }
  return {
    cle,
    annee,
    mois,
    premierJourIso: parisParts(debut).weekday,
    jours,
    precedent: decalerMois(annee, mois, -1),
    suivant: decalerMois(annee, mois, 1),
  };
}

/** Les espaces entièrement bloqués un jour donné (pour le filtre « date souhaitée »). */
export async function espacesBloquesLe(
  espaces: { id: number; openHours: unknown; delayMinDays: number; horizonMaxDays: number }[],
  date: string,
): Promise<Set<number>> {
  const cle = date.slice(0, 7);
  const bloques = new Set<number>();
  await Promise.all(
    espaces.map(async (e) => {
      const m = await calendrierMois(e, cle);
      const j = m.jours.find((x) => x.date === date);
      if (j && (j.etat === "occupe" || j.etat === "ferme" || j.etat === "passe")) bloques.add(e.id);
    }),
  );
  return bloques;
}
