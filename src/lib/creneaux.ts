/**
 * Créneaux : chevauchements, récurrences, horaires d'ouverture et règles de délai.
 * Logique PURE (aucune I/O) : testée unitairement (creneaux.test.ts).
 *
 * Un créneau est un intervalle d'instants [startAt, endAt[. Les récurrences se
 * calculent en HEURE MURALE de Paris : « tous les mercredis 18h-20h » reste à 18h
 * après le passage à l'heure d'été.
 */
import { pad2 } from "@/lib/date-utc";
import { minutesDe, parisParts, parisWallToInstant, toParisWall } from "@/lib/paris-time";

export type Intervalle = { startAt: Date; endAt: Date };

/** Deux intervalles se chevauchent-ils (bornes exclues : 10h-12h et 12h-14h ne se touchent pas) ? */
export function chevauche(a: Intervalle, b: Intervalle): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

/** L'intervalle élargi des temps de montage / démontage (minutes). */
export function avecMarges(i: Intervalle, avantMin: number, apresMin: number): Intervalle {
  return {
    startAt: new Date(i.startAt.getTime() - avantMin * 60_000),
    endAt: new Date(i.endAt.getTime() + apresMin * 60_000),
  };
}

export function dureeMinutes(i: Intervalle): number {
  return Math.round((i.endAt.getTime() - i.startAt.getTime()) / 60_000);
}

// ── Récurrences ──

export type Recurrence = {
  /** daily | weekly | monthly */
  freq: "daily" | "weekly" | "monthly";
  /** Toutes les N unités (1 = chaque semaine, 2 = une semaine sur deux). */
  interval?: number;
  /** Jours ISO (1 = lundi … 7 = dimanche) pour une récurrence hebdomadaire ; vide = le jour du premier créneau. */
  byWeekday?: number[];
  /** Dernière date incluse « YYYY-MM-DD » (heure de Paris). */
  until?: string;
  /** Ou un nombre d'occurrences. */
  count?: number;
  /** Dates exclues « YYYY-MM-DD » saisies à la main. */
  except?: string[];
  /** Sauter les vacances scolaires du calendrier des saisons. */
  horsVacances?: boolean;
  /** Sauter les jours fériés. */
  horsFeries?: boolean;
};

export const MAX_OCCURRENCES = 200;

/** La récurrence s'appuie-t-elle sur le calendrier (vacances ou jours fériés à sauter) ? */
export function utiliseCalendrier(rec: Recurrence | null): boolean {
  return !!rec && (!!rec.horsVacances || !!rec.horsFeries);
}

/** Lit une récurrence depuis un JSON quelconque (null si absente ou invalide). */
export function lireRecurrence(json: unknown): Recurrence | null {
  if (!json || typeof json !== "object") return null;
  const r = json as Record<string, unknown>;
  if (r.freq !== "daily" && r.freq !== "weekly" && r.freq !== "monthly") return null;
  const out: Recurrence = { freq: r.freq };
  if (typeof r.interval === "number" && r.interval >= 1) out.interval = Math.floor(r.interval);
  if (Array.isArray(r.byWeekday))
    out.byWeekday = r.byWeekday.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  if (typeof r.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.until)) out.until = r.until;
  if (typeof r.count === "number" && r.count >= 1) out.count = Math.floor(r.count);
  if (Array.isArray(r.except))
    out.except = r.except.filter((x) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x));
  if (r.horsVacances === true) out.horsVacances = true;
  if (r.horsFeries === true) out.horsFeries = true;
  return out;
}

function cleDate(y: number, mo: number, da: number): string {
  return `${y}-${pad2(mo)}-${pad2(da)}`;
}

/**
 * Les jours « YYYY-MM-DD » (heure de Paris) entre lesquels une récurrence peut produire des
 * occurrences : du premier créneau à la date de fin, ou à un an au plus sans date de fin.
 */
export function bornesRecurrence(
  premier: Intervalle,
  rec: Recurrence | null,
): { debut: string; fin: string } {
  const debut = toParisWall(premier.startAt);
  const debutCle = cleDate(debut.y, debut.mo, debut.da);
  if (!rec) return { debut: debutCle, fin: debutCle };
  const unAn = new Date(Date.UTC(debut.y + 1, debut.mo - 1, debut.da));
  return {
    debut: debutCle,
    fin: rec.until ?? cleDate(unAn.getUTCFullYear(), unAn.getUTCMonth() + 1, unAn.getUTCDate()),
  };
}

/**
 * Développe un premier créneau selon sa récurrence : la liste des occurrences, premier
 * créneau compris, bornée à MAX_OCCURRENCES. La durée de chaque occurrence est celle du
 * premier créneau ; les heures sont celles de Paris. `exclusAuto` : les jours du calendrier
 * (vacances, fériés) à sauter en plus des dates exclues à la main — fournis par l'appelant,
 * qui les lit en base selon `horsVacances` / `horsFeries`.
 */
export function developperRecurrence(
  premier: Intervalle,
  rec: Recurrence | null,
  exclusAuto: Iterable<string> = [],
): Intervalle[] {
  if (!rec) return [premier];
  const interval = Math.max(1, rec.interval ?? 1);
  const duree = premier.endAt.getTime() - premier.startAt.getTime();
  const debut = toParisWall(premier.startAt);
  const max = Math.min(MAX_OCCURRENCES, rec.count ?? MAX_OCCURRENCES);
  const except = new Set([...(rec.except ?? []), ...exclusAuto]);
  const out: Intervalle[] = [];
  const borne = bornesRecurrence(premier, rec).fin;

  const pousser = (y: number, mo: number, da: number) => {
    const cle = cleDate(y, mo, da);
    if (cle > borne) return false;
    if (!except.has(cle)) {
      const startAt = parisWallToInstant(y, mo, da, debut.min);
      out.push({ startAt, endAt: new Date(startAt.getTime() + duree) });
    }
    return out.length < max;
  };

  if (rec.freq === "daily") {
    const cur = new Date(Date.UTC(debut.y, debut.mo - 1, debut.da));
    for (let i = 0; i < 2000; i++) {
      if (!pousser(cur.getUTCFullYear(), cur.getUTCMonth() + 1, cur.getUTCDate())) break;
      cur.setUTCDate(cur.getUTCDate() + interval);
    }
  } else if (rec.freq === "weekly") {
    const premierJour = parisParts(premier.startAt).weekday;
    const jours = (rec.byWeekday?.length ? rec.byWeekday : [premierJour]).slice().sort();
    // Lundi de la semaine du premier créneau.
    const lundi = new Date(Date.UTC(debut.y, debut.mo - 1, debut.da));
    lundi.setUTCDate(lundi.getUTCDate() - (premierJour - 1));
    let continuer = true;
    for (let semaine = 0; semaine < 600 && continuer; semaine += interval) {
      for (const j of jours) {
        const d = new Date(lundi.getTime());
        d.setUTCDate(d.getUTCDate() + semaine * 7 + (j - 1));
        const cle = cleDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (cle < cleDate(debut.y, debut.mo, debut.da)) continue;
        if (!pousser(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())) {
          continuer = false;
          break;
        }
      }
      if (
        cleDate(
          lundi.getUTCFullYear(),
          lundi.getUTCMonth() + 1,
          lundi.getUTCDate() + (semaine + interval) * 7,
        ) > borne
      )
        break;
    }
  } else {
    for (let i = 0; i < 240; i++) {
      const mois = debut.mo - 1 + i * interval;
      const y = debut.y + Math.floor(mois / 12);
      const mo = (mois % 12) + 1;
      const dernierJour = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      if (!pousser(y, mo, Math.min(debut.da, dernierJour))) break;
    }
  }
  return out;
}

/** Une phrase pour une récurrence : « Chaque semaine le mercredi, jusqu'au 30/06/2026 ». */
export function decrireRecurrence(rec: Recurrence | null): string {
  if (!rec) return "";
  const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  const n = rec.interval ?? 1;
  let base: string;
  if (rec.freq === "daily") base = n === 1 ? "Chaque jour" : `Tous les ${n} jours`;
  else if (rec.freq === "weekly") {
    base =
      n === 1 ? "Chaque semaine" : n === 2 ? "Une semaine sur deux" : `Toutes les ${n} semaines`;
    if (rec.byWeekday?.length) base += ` le ${rec.byWeekday.map((j) => JOURS[j - 1]).join(", ")}`;
  } else base = n === 1 ? "Chaque mois" : `Tous les ${n} mois`;
  if (rec.until) {
    const [y, m, d] = rec.until.split("-");
    base += `, jusqu'au ${d}/${m}/${y}`;
  } else if (rec.count) base += `, ${rec.count} fois`;
  if (rec.horsVacances && rec.horsFeries) base += ", hors vacances scolaires et jours fériés";
  else if (rec.horsVacances) base += ", hors vacances scolaires";
  else if (rec.horsFeries) base += ", hors jours fériés";
  return base;
}

// ── Horaires d'ouverture ──

/** {"1":[["08:00","22:00"]], …} : plages par jour ISO. */
export type Horaires = Record<string, [string, string][]>;

export function lireHoraires(json: unknown): Horaires | null {
  if (!json || typeof json !== "object") return null;
  const out: Horaires = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (!/^[1-7]$/.test(k) || !Array.isArray(v)) continue;
    const plages: [string, string][] = [];
    for (const p of v) {
      if (
        Array.isArray(p) &&
        p.length === 2 &&
        typeof p[0] === "string" &&
        typeof p[1] === "string"
      )
        plages.push([p[0], p[1]]);
    }
    out[k] = plages;
  }
  return out;
}

/**
 * Le créneau (heure de Paris) tombe-t-il dans les horaires d'ouverture ? Sans horaires
 * déclarés : toujours. Un créneau sur plusieurs jours est vérifié jour par jour.
 */
export function dansHoraires(horaires: Horaires | null, i: Intervalle): boolean {
  if (!horaires) return true;
  const a = parisParts(i.startAt);
  const b = parisParts(new Date(i.endAt.getTime() - 1));
  if (a.dateKey !== b.dateKey) {
    // Multi-jours : chaque jour doit être ouvert de l'heure de début à minuit, etc. On
    // simplifie en exigeant que chaque jour touché soit ouvert sur la partie concernée.
    const jours: Intervalle[] = [];
    let cur = i.startAt;
    while (cur < i.endAt) {
      const p = parisParts(cur);
      const [y, mo, da] = p.dateKey.split("-").map(Number);
      const minuitSuivant = parisWallToInstant(y, mo, da + 1, 0);
      // biome-ignore lint/complexity/useMathMinMax: comparaison de dates, pas de nombres.
      const fin = minuitSuivant < i.endAt ? minuitSuivant : i.endAt;
      jours.push({ startAt: cur, endAt: fin });
      cur = fin;
    }
    return jours.every((j) => dansHoraires(horaires, j));
  }
  const plages = horaires[String(a.weekday)] ?? [];
  const finMin = b.min + 1;
  return plages.some(([ouv, ferm]) => {
    const o = minutesDe(ouv);
    const f = minutesDe(ferm);
    if (o === null || f === null) return false;
    const fermeture = f === 0 ? 1440 : f;
    return a.min >= o && finMin <= fermeture;
  });
}

/** Des horaires valables sur une période de jours « YYYY-MM-DD » (bornes incluses) : ceux d'une saison. */
export type HorairesPeriode = { debut: string; fin: string; openHours: unknown };

/** Les horaires applicables à un instant : ceux de la période qui contient ce jour (Paris), sinon `base`. */
export function horairesA(
  base: unknown,
  periodes: readonly HorairesPeriode[],
  instant: Date,
): unknown {
  const jour = parisParts(instant).dateKey;
  const p = periodes.find((x) => x.debut <= jour && jour <= x.fin);
  return p ? p.openHours : base;
}

/** Les règles de l'espace telles qu'elles s'appliquent à ce créneau : horaires de sa saison s'il y en a. */
export function reglesAuCreneau<T extends ReglesEspace>(
  espace: T,
  periodes: readonly HorairesPeriode[],
  i: Intervalle,
): T {
  if (!periodes.length) return espace;
  return { ...espace, openHours: horairesA(espace.openHours, periodes, i.startAt) };
}

/** Horaires par défaut : tous les jours 8h-22h. */
export const HORAIRES_DEFAUT: Horaires = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map((j) => [String(j), [["08:00", "22:00"]]]),
);

// ── Règles d'un espace ──

export type ReglesEspace = {
  slotStepMin: number;
  minDurationMin: number;
  maxDurationMin: number | null;
  delayMinDays: number;
  horizonMaxDays: number;
  openHours: unknown;
};

/** Les manquements d'un créneau aux règles de l'espace (vide = conforme). */
export function verifierRegles(
  regles: ReglesEspace,
  i: Intervalle,
  now: Date = new Date(),
  opts: { ignorerDelai?: boolean } = {},
): string[] {
  const erreurs: string[] = [];
  if (i.endAt <= i.startAt) {
    erreurs.push("L'heure de fin doit être après l'heure de début.");
    return erreurs;
  }
  const d = dureeMinutes(i);
  if (d < regles.minDurationMin)
    erreurs.push(`Durée minimale : ${Math.round(regles.minDurationMin / 60)} h.`);
  if (regles.maxDurationMin && d > regles.maxDurationMin)
    erreurs.push(`Durée maximale : ${Math.round(regles.maxDurationMin / 60)} h.`);
  const pas = regles.slotStepMin || 15;
  const a = toParisWall(i.startAt).min;
  const b = toParisWall(i.endAt).min;
  if (a % pas !== 0 || b % pas !== 0)
    erreurs.push(`Les horaires se saisissent par pas de ${pas} min.`);
  if (!opts.ignorerDelai) {
    const jours = Math.floor((i.startAt.getTime() - now.getTime()) / 86_400_000);
    if (jours < regles.delayMinDays)
      erreurs.push(
        `La demande doit être déposée au moins ${regles.delayMinDays} jour(s) à l'avance.`,
      );
    if (jours > regles.horizonMaxDays)
      erreurs.push(`Impossible de réserver plus de ${regles.horizonMaxDays} jours à l'avance.`);
  }
  if (!dansHoraires(lireHoraires(regles.openHours), i))
    erreurs.push("Le créneau sort des horaires d'ouverture de l'espace.");
  return erreurs;
}

// ── Conflits ──

export type Occupant = Intervalle & { id: number; reservationId?: number; libelle: string };

/** Parmi `existants`, ceux qui chevauchent un des créneaux demandés (marges comprises). */
export function conflits<T extends Intervalle>(
  demandes: Intervalle[],
  existants: T[],
  marges: { avantMin: number; apresMin: number } = { avantMin: 0, apresMin: 0 },
): { demande: Intervalle; existant: T }[] {
  const out: { demande: Intervalle; existant: T }[] = [];
  for (const d of demandes) {
    const dm = avecMarges(d, marges.avantMin, marges.apresMin);
    for (const e of existants) {
      if (chevauche(dm, e)) out.push({ demande: d, existant: e });
    }
  }
  return out;
}

/**
 * Conflits d'un espace partageable : une demande n'est en conflit que si, à un instant de son
 * créneau (marges comprises), `capacite` occupations sont déjà en place. Capacité 1 = `conflits`.
 * L'existant rapporté est celui qui porte l'occupation au plafond.
 */
export function conflitsCapacite<T extends Intervalle>(
  demandes: Intervalle[],
  existants: T[],
  marges: { avantMin: number; apresMin: number } = { avantMin: 0, apresMin: 0 },
  capacite = 1,
): { demande: Intervalle; existant: T }[] {
  if (capacite <= 1) return conflits(demandes, existants, marges);
  const out: { demande: Intervalle; existant: T }[] = [];
  for (const d of demandes) {
    const dm = avecMarges(d, marges.avantMin, marges.apresMin);
    const dedans = existants.filter((e) => chevauche(dm, e));
    if (dedans.length < capacite) continue;
    // Balayage des bornes : combien d'occupations se recouvrent à chaque instant du créneau.
    const evenements = dedans
      .flatMap((e) => [
        { t: Math.max(e.startAt.getTime(), dm.startAt.getTime()), delta: 1, e },
        { t: Math.min(e.endAt.getTime(), dm.endAt.getTime()), delta: -1, e },
      ])
      .sort((a, b) => a.t - b.t || a.delta - b.delta);
    let courant = 0;
    for (const ev of evenements) {
      courant += ev.delta;
      if (courant >= capacite) {
        out.push({ demande: d, existant: ev.e });
        break;
      }
    }
  }
  return out;
}

/** Bornes (premier début, dernière fin) d'un ensemble de créneaux. */
export function bornes(creneaux: Intervalle[]): Intervalle {
  const startAt = new Date(Math.min(...creneaux.map((c) => c.startAt.getTime())));
  const endAt = new Date(Math.max(...creneaux.map((c) => c.endAt.getTime())));
  return { startAt, endAt };
}
