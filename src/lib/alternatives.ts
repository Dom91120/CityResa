/**
 * Alternatives en cas de conflit : quand un créneau demandé est occupé (ou fermé), proposer
 * des créneaux équivalents libres : même espace à un autre horaire du même jour, même espace
 * aux mêmes heures un autre jour, autre espace de même nature aux mêmes heures.
 * Logique PURE : testée dans alternatives.test.ts. Les occupations sont fournies par l'appelant.
 */
import {
  conflits,
  conflitsCapacite,
  type HorairesPeriode,
  type Intervalle,
  type ReglesEspace,
  reglesAuCreneau,
  verifierRegles,
} from "@/lib/creneaux";
import { dateCourte, plageHoraire } from "@/lib/libelles";
import { addParisDays, parisWallToInstant, toParisWall } from "@/lib/paris-time";

export type GenreAlternative = "horaire" | "jour" | "espace";

export type Candidat = Intervalle & {
  espaceId: number;
  genre: GenreAlternative;
  /** Décalage en minutes (même jour) ou en jours (autre jour), en valeur absolue : le plus petit d'abord. */
  ecart: number;
};

export type EspaceCandidat = ReglesEspace & {
  id: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  capaciteSimultanee: number;
  periodes: readonly HorairesPeriode[];
};

export type OccupationCandidat = Intervalle & { genre: "reservation" | "blocage" };

/** Le créneau décalé de `minutes`, en heure murale de Paris (la durée ne change pas). */
export function decalerMinutes(i: Intervalle, minutes: number): Intervalle {
  return {
    startAt: new Date(i.startAt.getTime() + minutes * 60_000),
    endAt: new Date(i.endAt.getTime() + minutes * 60_000),
  };
}

/** Le créneau reporté de `jours` jours, aux mêmes heures murales de Paris. */
export function decalerJours(i: Intervalle, jours: number): Intervalle {
  const a = toParisWall(i.startAt);
  const b = toParisWall(i.endAt);
  const da = toParisWall(addParisDays(i.startAt, jours));
  const db = toParisWall(addParisDays(i.endAt, jours));
  return {
    startAt: parisWallToInstant(da.y, da.mo, da.da, a.min),
    endAt: parisWallToInstant(db.y, db.mo, db.da, b.min),
  };
}

/**
 * Les candidats, du plus proche au plus lointain : même jour par pas de `slotStepMin` jusqu'à
 * `maxPas` pas de chaque côté, puis les `maxJours` jours avant et après, puis les autres espaces.
 */
export function candidats(
  i: Intervalle,
  espace: { id: number; slotStepMin: number },
  autresEspaces: readonly { id: number }[],
  opts: { maxPas?: number; maxJours?: number } = {},
): Candidat[] {
  const pas = espace.slotStepMin || 30;
  const maxPas = opts.maxPas ?? Math.max(1, Math.round(240 / pas));
  const maxJours = opts.maxJours ?? 7;
  const out: Candidat[] = [];
  for (let k = 1; k <= maxPas; k++) {
    for (const signe of [1, -1]) {
      out.push({
        ...decalerMinutes(i, signe * k * pas),
        espaceId: espace.id,
        genre: "horaire",
        ecart: k * pas,
      });
    }
  }
  for (let j = 1; j <= maxJours; j++) {
    for (const signe of [1, -1]) {
      out.push({ ...decalerJours(i, signe * j), espaceId: espace.id, genre: "jour", ecart: j });
    }
  }
  for (const e of autresEspaces) out.push({ ...i, espaceId: e.id, genre: "espace", ecart: 0 });
  return out;
}

/** Un candidat est libre s'il respecte les règles de son espace et n'entre en conflit avec rien. */
export function estLibre(
  c: Candidat,
  espace: EspaceCandidat,
  occupations: readonly OccupationCandidat[],
  now: Date,
  opts: { ignorerDelai?: boolean } = {},
): boolean {
  if (c.startAt <= now) return false;
  const regles = reglesAuCreneau(espace, espace.periodes, c);
  if (verifierRegles(regles, c, now, opts).length) return false;
  const marges = { avantMin: espace.bufferBeforeMin, apresMin: espace.bufferAfterMin };
  if (
    conflits(
      [c],
      occupations.filter((o) => o.genre === "blocage"),
      marges,
    ).length
  )
    return false;
  return (
    conflitsCapacite(
      [c],
      occupations.filter((o) => o.genre === "reservation"),
      marges,
      espace.capaciteSimultanee,
    ).length === 0
  );
}

/**
 * Au plus `n` alternatives, variées : la plus proche de chaque genre d'abord (autre horaire,
 * autre jour, autre espace), puis les suivantes par proximité.
 */
export function choisir(libres: readonly Candidat[], n = 3): Candidat[] {
  const ordre: GenreAlternative[] = ["horaire", "jour", "espace"];
  const parGenre = new Map(ordre.map((g) => [g, libres.filter((c) => c.genre === g)]));
  const out: Candidat[] = [];
  for (const g of ordre) {
    const premier = parGenre.get(g)?.[0];
    if (premier && out.length < n) out.push(premier);
  }
  for (const c of libres) {
    if (out.length >= n) break;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** « Le même jour, 14h00 – 16h00 » / « Jeudi 12/12/2026, 10h00 – 12h00 » / « Salle B, le 05/12/2026, 10h00 – 12h00 ». */
export function decrire(c: Candidat, nomEspace: string): string {
  const heures = plageHoraire(c.startAt, c.endAt);
  if (c.genre === "horaire") return `Le même jour, ${heures}`;
  if (c.genre === "jour") return `Le ${dateCourte(c.startAt)}, ${heures}`;
  return `${nomEspace}, le ${dateCourte(c.startAt)}, ${heures}`;
}

/** Le texte d'un courriel : une ligne par alternative, vide s'il n'y en a pas. */
export function lignesCourriel(alternatives: readonly { texte: string }[]): string {
  if (!alternatives.length) return "";
  return `Créneaux de remplacement libres à ce jour : ${alternatives.map((a) => a.texte).join(" ; ")}.`;
}
