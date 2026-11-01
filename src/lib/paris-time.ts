// Calendrier Europe/Paris INDÉPENDANT du fuseau serveur (Node tourne en UTC en
// production) — SOURCE UNIQUE de la conversion instant ↔ heure murale FR + gestion de
// l'heure d'été/hiver. Les créneaux sont stockés en instants (timestamptz) ; tout ce
// qui les saisit ou les affiche passe par ici.

import { pad2 } from "@/lib/date-utc";

export const PARIS_TZ = "Europe/Paris";

/** Minutes dont Paris est en avance sur UTC à cet instant (60 hiver / 120 été). */
export function parisOffsetMin(instant: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p = dtf.formatToParts(instant);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

export type ParisWall = { y: number; mo: number; da: number; min: number };

/** Instant → heure murale Paris (min = minutes depuis minuit). */
export function toParisWall(instant: Date): ParisWall {
  const w = new Date(instant.getTime() + parisOffsetMin(instant) * 60000);
  return {
    y: w.getUTCFullYear(),
    mo: w.getUTCMonth() + 1,
    da: w.getUTCDate(),
    min: w.getUTCHours() * 60 + w.getUTCMinutes(),
  };
}

/** Heure murale Paris (jour + minutes) → instant UTC. */
export function parisWallToInstant(y: number, mo: number, da: number, min: number): Date {
  const guess = Date.UTC(y, mo - 1, da, 0, min);
  return new Date(guess - parisOffsetMin(new Date(guess)) * 60000);
}

/** « YYYY-MM-DD » + « HH:MM » (heure de Paris) → instant. null si invalide. */
export function parisDateTimeToInstant(ymd: string, hm: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  const h = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m || !h) return null;
  const heures = Number(h[1]);
  const minutes = Number(h[2]);
  if (heures > 23 || minutes > 59) return null;
  const d = parisWallToInstant(Number(m[1]), Number(m[2]), Number(m[3]), heures * 60 + minutes);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Instant → { date « YYYY-MM-DD », minutes depuis minuit, jour ISO 1-7 } à Paris. */
export function parisParts(d: Date): { dateKey: string; min: number; weekday: number } {
  const w = toParisWall(d);
  const dow = new Date(Date.UTC(w.y, w.mo - 1, w.da)).getUTCDay();
  return {
    dateKey: `${w.y}-${pad2(w.mo)}-${pad2(w.da)}`,
    min: w.min,
    weekday: ((dow + 6) % 7) + 1,
  };
}

/** Date calendaire d'aujourd'hui à Paris (YYYY-MM-DD). */
export function todayParisISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Minuit (heure de Paris) du jour donné « YYYY-MM-DD », en instant. */
export function parisMidnight(ymd: string): Date {
  const [y, mo, da] = ymd.split("-").map(Number);
  return parisWallToInstant(y, mo, da, 0);
}

/** Le même instant décalé de `n` jours calendaires (en heure de Paris, DST compris). */
export function addParisDays(d: Date, n: number): Date {
  const w = toParisWall(d);
  const base = new Date(Date.UTC(w.y, w.mo - 1, w.da));
  base.setUTCDate(base.getUTCDate() + n);
  return parisWallToInstant(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate(),
    w.min,
  );
}

/** « HH:MM » depuis des minutes. */
export function hm(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

/** « HH:MM » → minutes depuis minuit, null si invalide. */
export function minutesDe(hmTexte: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hmTexte.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}
