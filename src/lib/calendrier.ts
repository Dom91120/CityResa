/**
 * Calendrier : saisons (années scolaires), jours fériés de la métropole, vacances scolaires
 * lues dans le jeu open data national « fr-en-calendrier-scolaire » (data.education.gouv.fr),
 * jours exclus d'une récurrence. Logique PURE (aucune I/O) : testée dans calendrier.test.ts.
 *
 * Les jours sont des clés « YYYY-MM-DD » ; une période porte deux bornes INCLUSES.
 */
import { addDaysUtc, pad2, parseYmdUtc, ymdUtc } from "@/lib/date-utc";
import { toParisWall } from "@/lib/paris-time";

export type PeriodeKind = "vacances" | "ferie";

export const PERIODE_KINDS: Record<PeriodeKind, string> = {
  vacances: "Vacances scolaires",
  ferie: "Jour férié",
};

export const PERIODE_SOURCES: Record<string, string> = {
  saisie: "Saisie",
  import: "Importé",
  calcul: "Calculé",
};

/** Les zones de vacances scolaires de la métropole ; Châtillon (académie de Versailles) est en zone C. */
export const ZONES_VACANCES = ["Zone A", "Zone B", "Zone C"] as const;
export const ZONE_PAR_DEFAUT = "Zone C";

export type PeriodeJours = { debut: string; fin: string };

export const RE_YMD = /^\d{4}-\d{2}-\d{2}$/;

/** « YYYY-MM-DD » décalé de n jours. */
export function ajouterJours(ymd: string, n: number): string {
  return ymdUtc(addDaysUtc(parseYmdUtc(ymd), n));
}

/** Les jours d'une période, bornes incluses (vide si la fin précède le début). */
export function joursEntre(debut: string, fin: string): string[] {
  const out: string[] = [];
  if (!RE_YMD.test(debut) || !RE_YMD.test(fin)) return out;
  for (let d = parseYmdUtc(debut); ymdUtc(d) <= fin && out.length < 400; d = addDaysUtc(d, 1))
    out.push(ymdUtc(d));
  return out;
}

/** Nombre de jours d'une période, bornes incluses. */
export function nbJours(p: PeriodeJours): number {
  return joursEntre(p.debut, p.fin).length;
}

/** L'ensemble des jours couverts par des périodes. */
export function joursDesPeriodes(periodes: PeriodeJours[]): Set<string> {
  const out = new Set<string>();
  for (const p of periodes) for (const j of joursEntre(p.debut, p.fin)) out.add(j);
  return out;
}

/** Deux périodes (bornes incluses) se recouvrent-elles ? */
export function periodesSeRecouvrent(a: PeriodeJours, b: PeriodeJours): boolean {
  return a.debut <= b.fin && b.debut <= a.fin;
}

// ── Jours fériés ──

/** Dimanche de Pâques (algorithme de Meeus / Jones / Butcher, calendrier grégorien). */
export function paques(annee: number): string {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${annee}-${pad2(mois)}-${pad2(jour)}`;
}

export type JourFerie = { date: string; label: string };

/** Les onze jours fériés légaux de la métropole pour une année, dans l'ordre. */
export function joursFeries(annee: number): JourFerie[] {
  const p = paques(annee);
  const fixe = (mo: number, da: number) => `${annee}-${pad2(mo)}-${pad2(da)}`;
  return [
    { date: fixe(1, 1), label: "Jour de l'an" },
    { date: ajouterJours(p, 1), label: "Lundi de Pâques" },
    { date: fixe(5, 1), label: "Fête du Travail" },
    { date: fixe(5, 8), label: "Victoire 1945" },
    { date: ajouterJours(p, 39), label: "Ascension" },
    { date: ajouterJours(p, 50), label: "Lundi de Pentecôte" },
    { date: fixe(7, 14), label: "Fête nationale" },
    { date: fixe(8, 15), label: "Assomption" },
    { date: fixe(11, 1), label: "Toussaint" },
    { date: fixe(11, 11), label: "Armistice 1918" },
    { date: fixe(12, 25), label: "Noël" },
  ].sort((x, y) => x.date.localeCompare(y.date));
}

/** Les jours fériés compris entre deux dates incluses. */
export function joursFeriesEntre(debut: string, fin: string): JourFerie[] {
  const out: JourFerie[] = [];
  const y1 = Number(debut.slice(0, 4));
  const y2 = Number(fin.slice(0, 4));
  for (let y = y1; y <= y2; y++)
    for (const f of joursFeries(y)) if (f.date >= debut && f.date <= fin) out.push(f);
  return out;
}

// ── Saisons ──

export type SaisonProposee = { label: string; debut: string; fin: string };

/** L'année scolaire d'un jour : « 2026-2027 » pour tout jour du 1er septembre 2026 au 31 août 2027. */
export function anneeScolaire(ymd: string): string {
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7));
  const debut = mo >= 9 ? y : y - 1;
  return `${debut}-${debut + 1}`;
}

/** La saison (1er septembre → 31 août) qui contient un jour. */
export function saisonDe(ymd: string): SaisonProposee {
  const label = anneeScolaire(ymd);
  const y = Number(label.slice(0, 4));
  return { label, debut: `${y}-09-01`, fin: `${y + 1}-08-31` };
}

/** La saison qui suit une saison donnée (même durée d'un an). */
export function saisonSuivante(s: PeriodeJours): SaisonProposee {
  return saisonDe(ajouterJours(s.fin, 1));
}

/** Le libellé « 2026-2027 » est-il bien formé ? */
export function labelSaisonValide(label: string): boolean {
  const m = /^(\d{4})-(\d{4})$/.exec(label);
  return !!m && Number(m[2]) === Number(m[1]) + 1;
}

// ── Vacances scolaires (open data) ──

export type PeriodeVacances = PeriodeJours & { label: string };

/** Le jour de Paris d'un horodatage ISO (« 2026-10-16T22:00:00+00:00 » → « 2026-10-17 »). */
function jourParis(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const w = toParisWall(d);
  return `${w.y}-${pad2(w.mo)}-${pad2(w.da)}`;
}

/**
 * Lit les enregistrements du jeu « fr-en-calendrier-scolaire » (objet `{"results": [...]}`
 * ou liste) : `description`, `start_date`, `end_date` (date de reprise, EXCLUE), `population`.
 * Seules les périodes valant pour tous (« - ») ou pour les élèves sont retenues ; à libellé
 * égal, la version « Élèves » prévaut (vacances d'été). Un pont d'un jour a des bornes égales.
 */
export function lireCalendrierScolaire(json: unknown): PeriodeVacances[] {
  const records = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { results?: unknown }).results)
      ? ((json as { results: unknown[] }).results ?? [])
      : [];
  const parLabel = new Map<string, { periode: PeriodeVacances; eleves: boolean }>();
  for (const r of records) {
    if (!r || typeof r !== "object") continue;
    const e = r as Record<string, unknown>;
    const population = String(e.population ?? "-").trim();
    if (population !== "-" && population !== "" && population !== "Élèves") continue;
    const debut = typeof e.start_date === "string" ? jourParis(e.start_date) : null;
    const reprise = typeof e.end_date === "string" ? jourParis(e.end_date) : null;
    const label = String(e.description ?? "").trim();
    if (!debut || !reprise || !label) continue;
    const fin = reprise <= debut ? debut : ajouterJours(reprise, -1);
    const eleves = population === "Élèves";
    const actuel = parLabel.get(label);
    if (!actuel || (eleves && !actuel.eleves))
      parLabel.set(label, { periode: { label, debut, fin }, eleves });
  }
  return [...parLabel.values()]
    .map((x) => x.periode)
    .sort((a, b) => a.debut.localeCompare(b.debut));
}

/** Une phrase pour une période : « du 17/10 au 01/11/2026 » ou « le 07/05/2027 ». */
export function decrirePeriode(p: PeriodeJours): string {
  const fr = (ymd: string, annee: boolean) =>
    `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}${annee ? `/${ymd.slice(0, 4)}` : ""}`;
  if (p.debut === p.fin) return `le ${fr(p.debut, true)}`;
  return `du ${fr(p.debut, p.debut.slice(0, 4) !== p.fin.slice(0, 4))} au ${fr(p.fin, true)}`;
}
