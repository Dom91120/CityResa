/**
 * Affectation du personnel de service aux créneaux réservés : disponibilité d'une personne
 * (contrat, cycle hebdomadaire d'horaires, absences, rattachement aux sites, affectations déjà
 * posées ailleurs), classement des candidats, périodes travaillées d'un jour, décision selon le
 * mode du site (automatique ou proposition).
 * Logique PURE : testée dans affectation.test.ts.
 */
import { chevauche, dansHoraires, type Horaires, type Intervalle } from "@/lib/creneaux";
import { minutesDe, parisParts } from "@/lib/paris-time";

export type PersonneAffectable = {
  id: number;
  firstName: string;
  lastName: string;
  isActive: boolean;
  quotite: number;
  heuresHebdo: number | null;
  /** « YYYY-MM-DD » ou null. */
  contratDebut: string | null;
  contratFin: string | null;
  horaires: Horaires | null;
  /** Les sites où la personne intervient, avec le principal. */
  sites: { siteId: number; principal: boolean }[];
};

export type AbsenceRef = Intervalle & { id: number; personnelId: number; motif: string | null };

/** Une occupation déjà posée : créneau affecté ou vacation, avec son site. */
export type OccupationRef = Intervalle & {
  personnelId: number;
  siteId: number;
  creneauId?: number;
};

export type CreneauAffectable = Intervalle & {
  id: number;
  reservationId: number;
  siteId: number;
};

export type MotifIndisponible =
  | "inactive"
  | "hors_site"
  | "hors_contrat"
  | "hors_horaires"
  | "absente"
  | "occupee";

export const MOTIFS_INDISPONIBLE: Record<MotifIndisponible, string> = {
  inactive: "plus en service",
  hors_site: "non rattachée au site",
  hors_contrat: "hors période de contrat",
  hors_horaires: "hors horaires de travail",
  absente: "absente",
  occupee: "déjà affectée ailleurs",
};

export type ContexteDisponibilite = {
  absences: readonly AbsenceRef[];
  occupations: readonly OccupationRef[];
};

/** La personne est en poste sur tout l'intervalle (sans horaires : à toute heure). */
export function travaille(horaires: Horaires | null, i: Intervalle): boolean {
  return dansHoraires(horaires, i);
}

/** Le total hebdomadaire des plages d'un cycle d'horaires, en heures. */
export function heuresDuCycle(horaires: Horaires | null): number {
  if (!horaires) return 0;
  let minutes = 0;
  for (const plages of Object.values(horaires)) {
    for (const [de, a] of plages) {
      const d = minutesDe(de);
      const f = minutesDe(a);
      if (d === null || f === null) continue;
      minutes += (f === 0 ? 1440 : f) - d;
    }
  }
  return Math.round((minutes / 60) * 10) / 10;
}

/** Les heures attendues d'après la quotité (base 35 h), ou la durée de référence saisie. */
export function heuresAttendues(p: { quotite: number; heuresHebdo: number | null }): number {
  if (p.heuresHebdo !== null) return p.heuresHebdo;
  return Math.round(((35 * p.quotite) / 100) * 10) / 10;
}

export function absente(absences: readonly AbsenceRef[], personnelId: number, i: Intervalle) {
  return absences.some((a) => a.personnelId === personnelId && chevauche(a, i));
}

/** Entre le début et la fin de contrat (jour de Paris, bornes incluses). */
export function enContrat(p: PersonneAffectable, i: Intervalle): boolean {
  const debut = parisParts(i.startAt).dateKey;
  const fin = parisParts(new Date(i.endAt.getTime() - 1)).dateKey;
  if (p.contratDebut && debut < p.contratDebut) return false;
  if (p.contratFin && fin > p.contratFin) return false;
  return true;
}

/** Déjà affectée au même moment sur un AUTRE site (le même site reste compatible). */
export function occupeeAilleurs(
  occupations: readonly OccupationRef[],
  personnelId: number,
  c: CreneauAffectable,
): boolean {
  return occupations.some(
    (o) =>
      o.personnelId === personnelId &&
      o.siteId !== c.siteId &&
      o.creneauId !== c.id &&
      chevauche(o, c),
  );
}

export type Disponibilite = { ok: true } | { ok: false; motif: MotifIndisponible };

export function disponible(
  p: PersonneAffectable,
  c: CreneauAffectable,
  ctx: ContexteDisponibilite,
): Disponibilite {
  if (!p.isActive) return { ok: false, motif: "inactive" };
  if (!p.sites.some((s) => s.siteId === c.siteId)) return { ok: false, motif: "hors_site" };
  if (!enContrat(p, c)) return { ok: false, motif: "hors_contrat" };
  if (!travaille(p.horaires, c)) return { ok: false, motif: "hors_horaires" };
  if (absente(ctx.absences, p.id, c)) return { ok: false, motif: "absente" };
  if (occupeeAilleurs(ctx.occupations, p.id, c)) return { ok: false, motif: "occupee" };
  return { ok: true };
}

export type Candidat = {
  personne: PersonneAffectable;
  principal: boolean;
  /** Heures déjà affectées (créneaux) sur la semaine du créneau. */
  heuresSemaine: number;
};

export type Ecarte = { personne: PersonneAffectable; motif: MotifIndisponible };

/** Le lundi « YYYY-MM-DD » de la semaine de Paris contenant l'instant. */
function lundiDe(d: Date): string {
  const p = parisParts(d);
  const [y, m, j] = p.dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, j - (p.weekday - 1)));
  return date.toISOString().slice(0, 10);
}

function heuresAffecteesSemaine(
  occupations: readonly OccupationRef[],
  personnelId: number,
  c: CreneauAffectable,
): number {
  const lundi = lundiDe(c.startAt);
  let minutes = 0;
  for (const o of occupations) {
    if (o.personnelId !== personnelId || o.creneauId === undefined || o.creneauId === c.id)
      continue;
    if (lundiDe(o.startAt) !== lundi) continue;
    minutes += (o.endAt.getTime() - o.startAt.getTime()) / 60_000;
  }
  return Math.round((minutes / 60) * 10) / 10;
}

/**
 * Les candidats d'un créneau, du meilleur au moins bon : site principal d'abord, puis la plus
 * faible charge de la semaine (équité), puis le nom. Les indisponibles sont rendus à part avec
 * leur motif.
 */
export function candidats(
  c: CreneauAffectable,
  personnes: readonly PersonneAffectable[],
  ctx: ContexteDisponibilite,
): { retenus: Candidat[]; ecartes: Ecarte[] } {
  const retenus: Candidat[] = [];
  const ecartes: Ecarte[] = [];
  for (const personne of personnes) {
    const d = disponible(personne, c, ctx);
    if (!d.ok) {
      ecartes.push({ personne, motif: d.motif });
      continue;
    }
    retenus.push({
      personne,
      principal: personne.sites.some((s) => s.siteId === c.siteId && s.principal),
      heuresSemaine: heuresAffecteesSemaine(ctx.occupations, personne.id, c),
    });
  }
  retenus.sort(
    (a, b) =>
      Number(b.principal) - Number(a.principal) ||
      a.heuresSemaine - b.heuresSemaine ||
      `${a.personne.lastName} ${a.personne.firstName}`.localeCompare(
        `${b.personne.lastName} ${b.personne.firstName}`,
        "fr",
      ),
  );
  return { retenus, ecartes };
}

export type Decision =
  | { action: "affecter"; personnelId: number }
  | { action: "proposer"; personnelId: number }
  | { action: "aucun" };

/** Automatique sur le site → affecter le premier candidat ; sinon le proposer. */
export function decisionAffectation(
  site: { affectationAuto: boolean },
  retenus: readonly Candidat[],
  forcerProposition = false,
): Decision {
  const premier = retenus[0];
  if (!premier) return { action: "aucun" };
  return site.affectationAuto && !forcerProposition
    ? { action: "affecter", personnelId: premier.personne.id }
    : { action: "proposer", personnelId: premier.personne.id };
}

// ── Périodes travaillées d'un jour ──

export type PlageMinutes = { debutMin: number; finMin: number };

/** Les plages de travail d'un jour ISO (minutes depuis minuit), vides un jour de repos. */
export function plagesDuJour(horaires: Horaires | null, weekday: number): PlageMinutes[] {
  if (!horaires) return [];
  const plages = horaires[String(weekday)] ?? [];
  return plages
    .map(([de, a]) => {
      const d = minutesDe(de);
      const f = minutesDe(a);
      if (d === null || f === null) return null;
      return { debutMin: d, finMin: f === 0 ? 1440 : f };
    })
    .filter((p): p is PlageMinutes => p !== null && p.finMin > p.debutMin);
}

/** Retire des plages les minutes couvertes par des intervalles (absences du jour). */
export function soustraire(plages: PlageMinutes[], trous: PlageMinutes[]): PlageMinutes[] {
  let out = plages;
  for (const t of trous) {
    const suivant: PlageMinutes[] = [];
    for (const p of out) {
      if (t.finMin <= p.debutMin || t.debutMin >= p.finMin) {
        suivant.push(p);
        continue;
      }
      if (t.debutMin > p.debutMin) suivant.push({ debutMin: p.debutMin, finMin: t.debutMin });
      if (t.finMin < p.finMin) suivant.push({ debutMin: t.finMin, finMin: p.finMin });
    }
    out = suivant;
  }
  return out;
}

/** Les absences d'une personne projetées sur un jour « YYYY-MM-DD », en minutes du jour. */
export function absencesDuJour(
  absences: readonly AbsenceRef[],
  personnelId: number,
  jour: string,
): (PlageMinutes & { motif: string | null })[] {
  const out: (PlageMinutes & { motif: string | null })[] = [];
  for (const a of absences) {
    if (a.personnelId !== personnelId) continue;
    const ps = parisParts(a.startAt);
    const pe = parisParts(new Date(a.endAt.getTime() - 1));
    if (jour < ps.dateKey || jour > pe.dateKey) continue;
    out.push({
      debutMin: ps.dateKey === jour ? ps.min : 0,
      finMin: pe.dateKey === jour ? pe.min + 1 : 1440,
      motif: a.motif,
    });
  }
  return out;
}

/**
 * Ce que la personne travaille réellement un jour donné : ses plages du cycle, moins ses
 * absences. `repos` quand le cycle ne prévoit rien ce jour-là ; sans cycle, « libre ».
 */
export function periodesTravaillees(
  p: Pick<PersonneAffectable, "id" | "horaires" | "contratDebut" | "contratFin">,
  jour: string,
  absences: readonly AbsenceRef[],
): { etat: "libre" | "repos" | "hors_contrat" | "travail"; plages: PlageMinutes[] } {
  if ((p.contratDebut && jour < p.contratDebut) || (p.contratFin && jour > p.contratFin))
    return { etat: "hors_contrat", plages: [] };
  const weekday = ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  const trous = absencesDuJour(absences, p.id, jour);
  if (!p.horaires)
    return { etat: "libre", plages: soustraire([{ debutMin: 0, finMin: 1440 }], trous) };
  const plages = plagesDuJour(p.horaires, weekday);
  if (!plages.length) return { etat: "repos", plages: [] };
  return { etat: "travail", plages: soustraire(plages, trous) };
}

/** « 8h00 – 12h00 · 13h30 – 17h00 ». */
export function libellePlages(plages: readonly PlageMinutes[]): string {
  const h = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
  return plages.map((p) => `${h(p.debutMin)} – ${h(p.finMin === 1440 ? 0 : p.finMin)}`).join(" · ");
}
