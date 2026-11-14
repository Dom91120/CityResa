/**
 * La frise horaire d'une journée (vue Jour du planning de service) : où poser chaque élément sur
 * l'axe du temps, sur quel niveau quand deux se chevauchent, et quelles heures montrer.
 * Logique PURE : frise.test.ts.
 */
import type { PlageMinutes } from "@/lib/affectation";
import { parisParts } from "@/lib/paris-time";

/** Les heures montrées par défaut : de 7 h à minuit. */
export const FRISE_PAR_DEFAUT: PlageMinutes = { debutMin: 7 * 60, finMin: 24 * 60 };

/** La part d'un intervalle daté qui tombe sur un jour « YYYY-MM-DD », en minutes depuis minuit. */
export function minutesDuJour(
  i: { startAt: Date; endAt: Date },
  jour: string,
): PlageMinutes | null {
  const debut = parisParts(i.startAt);
  const fin = parisParts(new Date(i.endAt.getTime() - 1));
  if (i.endAt <= i.startAt || jour < debut.dateKey || jour > fin.dateKey) return null;
  return {
    debutMin: debut.dateKey === jour ? debut.min : 0,
    finMin: fin.dateKey === jour ? fin.min + 1 : 1440,
  };
}

/**
 * Les bornes de la frise : les heures par défaut, élargies à l'heure entière quand un élément
 * commence plus tôt (ou finit plus tard), pour que les journées se comparent d'un jour à l'autre.
 */
export function bornesFrise(
  plages: readonly PlageMinutes[],
  defaut: PlageMinutes = FRISE_PAR_DEFAUT,
): PlageMinutes {
  let { debutMin, finMin } = defaut;
  for (const p of plages) {
    if (p.finMin <= p.debutMin) continue;
    debutMin = Math.min(debutMin, Math.floor(p.debutMin / 60) * 60);
    finMin = Math.max(finMin, Math.ceil(p.finMin / 60) * 60);
  }
  return { debutMin: Math.max(0, debutMin), finMin: Math.min(1440, finMin) };
}

/** Les heures pleines à graduer, bornes comprises. */
export function graduations(bornes: PlageMinutes): number[] {
  const out: number[] = [];
  for (let m = Math.ceil(bornes.debutMin / 60) * 60; m <= bornes.finMin; m += 60) out.push(m);
  return out;
}

/** « 8h », « 0h » pour minuit. */
export function libelleHeure(min: number): string {
  return `${Math.floor(min / 60) % 24}h`;
}

/** La place d'une plage sur la frise, en pourcentage de sa largeur (rognée aux bornes). */
export function positionFrise(
  p: PlageMinutes,
  bornes: PlageMinutes,
): { gauche: number; largeur: number } {
  const total = bornes.finMin - bornes.debutMin;
  const debut = Math.min(Math.max(p.debutMin, bornes.debutMin), bornes.finMin);
  const fin = Math.min(Math.max(p.finMin, bornes.debutMin), bornes.finMin);
  const pct = (m: number) => Math.round(((m - bornes.debutMin) / total) * 10000) / 100;
  return { gauche: pct(debut), largeur: Math.round((pct(fin) - pct(debut)) * 100) / 100 };
}

/**
 * Le niveau de chaque élément d'une ligne : deux éléments qui se chevauchent ne partagent pas le
 * même niveau. Les éléments sont rendus par heure de début ; `niveaux` dit combien la ligne en empile.
 */
export function empiler<T extends PlageMinutes>(
  elements: readonly T[],
): { places: { element: T; niveau: number }[]; niveaux: number } {
  const tries = [...elements].sort((a, b) => a.debutMin - b.debutMin || a.finMin - b.finMin);
  const fins: number[] = [];
  const places = tries.map((element) => {
    let niveau = fins.findIndex((fin) => fin <= element.debutMin);
    if (niveau < 0) niveau = fins.length;
    fins[niveau] = element.finMin;
    return { element, niveau };
  });
  return { places, niveaux: Math.max(1, fins.length) };
}
