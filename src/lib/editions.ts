/**
 * Éditions au format calendrier : projection d'occupations datées sur les jours d'une
 * semaine, plage horaire affichée, couloirs pour les chevauchements, et semaine type (les
 * séries hebdomadaires d'une saison ramenées sur une seule semaine).
 * Logique PURE : testée dans editions.test.ts.
 */

import { type Intervalle, lireRecurrence } from "@/lib/creneaux";
import { addDaysUtc, isoWeekdayUtc, parseYmdUtc, ymdUtc } from "@/lib/date-utc";
import { parisParts, parisWallToInstant, toParisWall } from "@/lib/paris-time";

export type EvtSemaine = {
  /** Rang du jour dans la semaine affichée (1 = première colonne). */
  jour: number;
  debutMin: number;
  finMin: number;
  titre: string;
  sousTitre: string;
  genre: "reservation" | "blocage";
  espaceId: number;
  href?: string;
};

export type OccupationDatee = Intervalle & {
  titre: string;
  sousTitre: string;
  genre: "reservation" | "blocage";
  espaceId: number;
  href?: string;
};

/** Le lundi « YYYY-MM-DD » de la semaine contenant ce jour. */
export function lundiDe(ymd: string): string {
  const d = parseYmdUtc(ymd);
  return ymdUtc(addDaysUtc(d, -(isoWeekdayUtc(d) - 1)));
}

/** Les sept jours « YYYY-MM-DD » à partir d'un lundi. */
export function joursDeLaSemaine(lundi: string): string[] {
  const d = parseYmdUtc(lundi);
  return [0, 1, 2, 3, 4, 5, 6].map((i) => ymdUtc(addDaysUtc(d, i)));
}

/**
 * Projette des occupations datées sur les jours donnés (heure de Paris) : un événement qui
 * court sur plusieurs jours apparaît sur chacun, découpé à minuit.
 */
export function projeter(
  items: readonly OccupationDatee[],
  jours: readonly string[],
): EvtSemaine[] {
  const out: EvtSemaine[] = [];
  for (const it of items) {
    const ps = parisParts(it.startAt);
    const pe = parisParts(new Date(it.endAt.getTime() - 1));
    jours.forEach((jour, i) => {
      if (jour < ps.dateKey || jour > pe.dateKey) return;
      out.push({
        jour: i + 1,
        debutMin: ps.dateKey === jour ? ps.min : 0,
        finMin: pe.dateKey === jour ? pe.min + 1 : 1440,
        titre: it.titre,
        sousTitre: it.sousTitre,
        genre: it.genre,
        espaceId: it.espaceId,
        href: it.href,
      });
    });
  }
  return out.sort((a, b) => a.jour - b.jour || a.debutMin - b.debutMin);
}

/** Les heures entières à afficher : au moins [defaut.debutH, defaut.finH[, élargies aux événements. */
export function plageAffichee(
  evts: readonly { debutMin: number; finMin: number }[],
  defaut = { debutH: 8, finH: 22 },
): { debutH: number; finH: number } {
  let debutH = defaut.debutH;
  let finH = defaut.finH;
  for (const e of evts) {
    debutH = Math.min(debutH, Math.floor(e.debutMin / 60));
    finH = Math.max(finH, Math.ceil(e.finMin / 60));
  }
  return { debutH: Math.max(0, debutH), finH: Math.min(24, Math.max(finH, debutH + 1)) };
}

export type AvecCouloir<T> = T & { couloir: number; nbCouloirs: number };

/**
 * Répartit en couloirs les événements qui se chevauchent (même colonne) : chaque groupe
 * d'événements liés par des recouvrements partage le même nombre de couloirs.
 */
export function couloirs<T extends { debutMin: number; finMin: number }>(
  evts: readonly T[],
): AvecCouloir<T>[] {
  const tries = [...evts].sort((a, b) => a.debutMin - b.debutMin || a.finMin - b.finMin);
  const out: AvecCouloir<T>[] = [];
  let groupe: AvecCouloir<T>[] = [];
  let finGroupe = -1;
  let finsCouloirs: number[] = [];
  const clore = () => {
    for (const g of groupe) g.nbCouloirs = finsCouloirs.length;
    groupe = [];
    finsCouloirs = [];
  };
  for (const e of tries) {
    if (groupe.length && e.debutMin >= finGroupe) clore();
    let couloir = finsCouloirs.findIndex((fin) => fin <= e.debutMin);
    if (couloir === -1) {
      couloir = finsCouloirs.length;
      finsCouloirs.push(e.finMin);
    } else finsCouloirs[couloir] = e.finMin;
    const place = { ...e, couloir, nbCouloirs: 1 } as AvecCouloir<T>;
    groupe.push(place);
    out.push(place);
    finGroupe = Math.max(finGroupe, e.finMin);
  }
  clore();
  return out;
}

// ── Semaine type ──

export type SerieHebdo = {
  reservationId: number;
  numero: string;
  titre: string;
  qui: string;
  espaceId: number;
  /** Jour ISO 1-7. */
  jour: number;
  debutMin: number;
  finMin: number;
  /** Occurrences prévues ce jour-là sur la saison. */
  nb: number;
  horsVacances: boolean;
};

export type DossierSerie = {
  id: number;
  numero: string;
  title: string;
  qui: string;
  espaceId: number;
  recurrence: unknown;
  creneaux: readonly { startAt: Date; endAt: Date; status: string }[];
};

/**
 * La semaine type : pour chaque dossier à récurrence hebdomadaire, une ligne par jour de la
 * semaine occupé, aux heures du premier créneau prévu ce jour-là.
 */
export function semaineType(dossiers: readonly DossierSerie[]): SerieHebdo[] {
  const out: SerieHebdo[] = [];
  for (const d of dossiers) {
    const rec = lireRecurrence(d.recurrence);
    if (rec?.freq !== "weekly") continue;
    const prevus = d.creneaux
      .filter((c) => c.status === "prevu")
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    if (!prevus.length) continue;
    const parJour = new Map<number, typeof prevus>();
    for (const c of prevus) {
      const j = parisParts(c.startAt).weekday;
      parJour.set(j, [...(parJour.get(j) ?? []), c]);
    }
    for (const [jour, liste] of [...parJour].sort((a, b) => a[0] - b[0])) {
      const premier = liste[0];
      const debutMin = toParisWall(premier.startAt).min;
      const duree = Math.round((premier.endAt.getTime() - premier.startAt.getTime()) / 60_000);
      out.push({
        reservationId: d.id,
        numero: d.numero,
        titre: d.title,
        qui: d.qui,
        espaceId: d.espaceId,
        jour,
        debutMin,
        finMin: Math.min(1440, debutMin + duree),
        nb: liste.length,
        horsVacances: Boolean(rec.horsVacances),
      });
    }
  }
  return out.sort((a, b) => a.espaceId - b.espaceId || a.jour - b.jour || a.debutMin - b.debutMin);
}

/** Une série hebdomadaire ramenée sur la semaine d'un lundi donné (instants de Paris). */
export function surSemaine(
  s: { jour: number; debutMin: number; finMin: number },
  lundi: string,
): Intervalle {
  const d = addDaysUtc(parseYmdUtc(lundi), s.jour - 1);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const da = d.getUTCDate();
  return {
    startAt: parisWallToInstant(y, mo, da, s.debutMin),
    endAt: parisWallToInstant(y, mo, da, s.finMin),
  };
}

/** « 18h00 – 20h00 » */
export function plageMinutes(debutMin: number, finMin: number): string {
  const h = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
  return `${h(debutMin)} – ${h(Math.min(finMin, 1440) === 1440 ? 1440 : finMin).replace("24h00", "24h00")}`;
}
