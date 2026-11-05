/**
 * Options (pré-réservations) et liste d'attente. Une option est un dossier non encore acquis
 * (à traiter, en traitement ou accepté à signer) assorti d'une date limite : relancé peu avant,
 * libéré d'office passée l'échéance. La liste d'attente retient qui veut être prévenu quand un
 * créneau occupé se libère. Logique PURE : testée dans options.test.ts.
 */
import { chevauche, type Intervalle } from "@/lib/creneaux";
import { dateHeure } from "@/lib/libelles";

/** Les statuts où une option a un sens : le dossier n'est pas encore acquis. */
export const STATUTS_OPTION = ["a_traiter", "en_traitement", "acceptee"] as const;

export type DossierOption = {
  id: number;
  status: string;
  optionExpiresAt: Date | null;
  optionRelanceAt: Date | null;
};

export function estOption(r: { status: string; optionExpiresAt: Date | null }): boolean {
  return Boolean(r.optionExpiresAt) && (STATUTS_OPTION as readonly string[]).includes(r.status);
}

/** Les options à relancer (échéance dans moins de `joursAvant` jours, pas encore relancées) et celles à libérer. */
export function trierOptions(
  dossiers: readonly DossierOption[],
  now: Date,
  joursAvant: number,
): { aRelancer: number[]; expirees: number[] } {
  const aRelancer: number[] = [];
  const expirees: number[] = [];
  const horizon = now.getTime() + joursAvant * 86_400_000;
  for (const d of dossiers) {
    if (!estOption(d) || !d.optionExpiresAt) continue;
    const t = d.optionExpiresAt.getTime();
    if (t <= now.getTime()) expirees.push(d.id);
    else if (t <= horizon && !d.optionRelanceAt) aRelancer.push(d.id);
  }
  return { aRelancer, expirees };
}

/** « Option jusqu'au 12/11/2026 à 18h00 (dans 3 jours) » */
export function decrireOption(r: { optionExpiresAt: Date | null }, now = new Date()): string {
  if (!r.optionExpiresAt) return "";
  const jours = Math.ceil((r.optionExpiresAt.getTime() - now.getTime()) / 86_400_000);
  const delai =
    jours < 0
      ? "échéance dépassée"
      : jours === 0
        ? "aujourd'hui"
        : `dans ${jours} jour${jours > 1 ? "s" : ""}`;
  return `Option jusqu'au ${dateHeure(r.optionExpiresAt)} (${delai})`;
}

export type EntreeAttente = Intervalle & { id: number; espaceId: number; notifiedAt: Date | null };

/** Les inscriptions à prévenir : même espace, créneau qui recouvre un intervalle libéré, pas encore prévenues. */
export function entreesConcernees(
  entrees: readonly EntreeAttente[],
  espaceId: number,
  liberes: readonly Intervalle[],
): number[] {
  return entrees
    .filter((e) => e.espaceId === espaceId && !e.notifiedAt && liberes.some((l) => chevauche(e, l)))
    .map((e) => e.id);
}
