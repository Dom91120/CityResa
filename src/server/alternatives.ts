/**
 * Alternatives en cas de conflit : pour un créneau occupé ou fermé, les créneaux équivalents
 * libres (même espace à un autre horaire, un autre jour, ou autre espace de même nature).
 * Règles pures dans src/lib/alternatives.ts ; ici le chargement des espaces et des occupations.
 */
import {
  type Candidat,
  candidats,
  choisir,
  decrire,
  type EspaceCandidat,
  estLibre,
} from "@/lib/alternatives";
import { bornes, type Intervalle } from "@/lib/creneaux";
import { isoParis } from "@/lib/libelles";
import { prisma } from "@/server/db";
import { horairesSaisonDe } from "@/server/horaires";
import { occupants } from "@/server/reservations";

export type Alternative = Candidat & {
  espace: { id: number; name: string; slug: string };
  texte: string;
  /** Lien vers la demande pré-remplie du portail, et vers la saisie du back-office. */
  lienPortail: string;
  lienSaisie: string;
};

const SELECT_ESPACE = {
  id: true,
  name: true,
  slug: true,
  siteId: true,
  natureId: true,
  isPublic: true,
  capacityStanding: true,
  capacitySeated: true,
  slotStepMin: true,
  minDurationMin: true,
  maxDurationMin: true,
  delayMinDays: true,
  horizonMaxDays: true,
  openHours: true,
  bufferBeforeMin: true,
  bufferAfterMin: true,
  capaciteSimultanee: true,
} as const;

/**
 * Jusqu'à `n` alternatives libres pour `i` sur l'espace `espaceId`. Les autres espaces
 * proposés ont la même nature, sont actifs (et publics pour le portail), hors de la famille de
 * l'espace demandé, et peuvent accueillir `participants` ; ceux du même site d'abord.
 */
export async function alternativesPour(opts: {
  espaceId: number;
  i: Intervalle;
  participants?: number | null;
  excludeReservationId?: number | null;
  portail?: boolean;
  ignorerDelai?: boolean;
  /** Une fermeture pas encore posée sur l'espace demandé : rien n'y est proposé. */
  fermeture?: Intervalle | null;
  n?: number;
  now?: Date;
}): Promise<Alternative[]> {
  const now = opts.now ?? new Date();
  const espace = await prisma.espace.findUnique({
    where: { id: opts.espaceId },
    select: { ...SELECT_ESPACE, parentId: true, enfants: { select: { id: true } } },
  });
  if (!espace) return [];
  const famille = new Set([
    espace.id,
    ...(espace.parentId ? [espace.parentId] : []),
    ...espace.enfants.map((e) => e.id),
  ]);
  const autres = espace.natureId
    ? (
        await prisma.espace.findMany({
          where: {
            natureId: espace.natureId,
            isActive: true,
            id: { notIn: [...famille] },
            ...(opts.portail ? { isPublic: true } : {}),
          },
          select: SELECT_ESPACE,
          orderBy: [{ siteId: "asc" }, { position: "asc" }, { name: "asc" }],
        })
      )
        .filter((e) => {
          if (!opts.participants) return true;
          const cap = Math.max(e.capacityStanding ?? 0, e.capacitySeated ?? 0);
          return !cap || cap >= opts.participants;
        })
        .sort((a, b) => Number(b.siteId === espace.siteId) - Number(a.siteId === espace.siteId))
        .slice(0, 6)
    : [];
  const liste = candidats(opts.i, espace, autres);
  if (!liste.length) return [];

  // Les occupations de chaque espace sur la fenêtre de ses candidats (marges comprises).
  const parEspace = new Map<number, typeof espace | (typeof autres)[number]>([
    [espace.id, espace],
    ...autres.map((e) => [e.id, e] as const),
  ]);
  const regles = new Map<number, EspaceCandidat>();
  const occupations = new Map<number, Awaited<ReturnType<typeof occupants>>>();
  for (const [id, e] of parEspace) {
    const miens = liste.filter((c) => c.espaceId === id);
    if (!miens.length) continue;
    const b = bornes(miens);
    const marge = Math.max(e.bufferBeforeMin, e.bufferAfterMin) * 60_000 + 1;
    const [periodes, occ] = await Promise.all([
      horairesSaisonDe(id),
      occupants(
        id,
        new Date(b.startAt.getTime() - marge),
        new Date(b.endAt.getTime() + marge),
        opts.excludeReservationId ?? null,
      ),
    ]);
    regles.set(id, { ...e, periodes });
    occupations.set(
      id,
      id === espace.id && opts.fermeture
        ? [
            ...occ,
            {
              ...opts.fermeture,
              id: 0,
              reservationId: null,
              libelle: "Fermeture",
              genre: "blocage" as const,
              espaceId: id,
            },
          ]
        : occ,
    );
  }
  const libres = liste.filter((c) => {
    const e = regles.get(c.espaceId);
    return e
      ? estLibre(c, e, occupations.get(c.espaceId) ?? [], now, { ignorerDelai: opts.ignorerDelai })
      : false;
  });
  return choisir(libres, opts.n ?? 3).map((c) => {
    const e = parEspace.get(c.espaceId) ?? espace;
    const d = isoParis(c.startAt);
    const f = isoParis(c.endAt);
    return {
      ...c,
      espace: { id: e.id, name: e.name, slug: e.slug },
      texte: decrire(c, e.name),
      lienPortail: `/portail/reserver/${e.slug}?date=${d.date}&heure_debut=${d.time}&heure_fin=${f.time}`,
      lienSaisie: `/reservations/nouvelle?espace=${e.id}&date=${d.date}&heure_debut=${d.time}&heure_fin=${f.time}`,
    };
  });
}
