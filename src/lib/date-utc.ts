// ─── Dates « calendaires » en UTC — SOURCE UNIQUE ────────────────────────────────
// Pour les valeurs @db.Date que Prisma remonte à MINUIT UTC : « YYYY-MM-DD » ↔ Date,
// décalage de jours, lundi de la semaine. Toutes les fonctions raisonnent en UTC — le
// fuseau du serveur n'intervient jamais. Les INSTANTS (créneaux, timestamptz) passent
// par lib/paris-time.ts, qui convertit en heure murale Europe/Paris.

/** Entier → 2 chiffres (« 07 »). */
export const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Date (valeur @db.Date à minuit UTC) → « YYYY-MM-DD ». */
export const ymdUtc = (d: Date): string => d.toISOString().slice(0, 10);

/** « YYYY-MM-DD » → Date à MINUIT UTC (comparable aux valeurs @db.Date). */
export const parseYmdUtc = (ymd: string): Date => new Date(`${ymd}T00:00:00.000Z`);

/** Nouvelle Date décalée de `n` jours (UTC ; l'entrée n'est pas modifiée). */
export function addDaysUtc(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Lundi (minuit UTC) de la semaine ISO contenant `d` (lundi → lui-même). */
export function mondayOfUtc(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // 0 = lundi … 6 = dimanche
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date UTC. */
export function isoWeekdayUtc(d: Date): number {
  return ((d.getUTCDay() + 6) % 7) + 1;
}
