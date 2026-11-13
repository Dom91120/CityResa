/**
 * Modification d'une récurrence : cette occurrence seule, celle-ci et les suivantes, ou toute
 * la série. Les créneaux visés sont décalés du même nombre de jours (heure de Paris) que
 * l'occurrence modifiée et prennent ses nouvelles heures ; les créneaux annulés ne bougent pas.
 * Logique PURE : testée dans serie.test.ts.
 */
import { ajouterJours } from "@/lib/calendrier";
import { chevauche, type Intervalle, type Recurrence } from "@/lib/creneaux";
import { plage } from "@/lib/libelles";
import { parisWallToInstant, toParisWall } from "@/lib/paris-time";

export type Portee = "cette" | "suivantes" | "serie";

export const PORTEES: { value: Portee; label: string }[] = [
  { value: "cette", label: "Cette occurrence seulement" },
  { value: "suivantes", label: "Celle-ci et les suivantes" },
  { value: "serie", label: "Toute la série" },
];

export function lirePortee(v: string | null | undefined): Portee {
  return v === "suivantes" || v === "serie" ? v : "cette";
}

export type CreneauSerie = Intervalle & { id: number; status: string };

/** Les créneaux prévus du dossier, dans l'ordre chronologique. */
export function creneauxPrevus<T extends CreneauSerie>(creneaux: readonly T[]): T[] {
  return creneaux
    .filter((c) => c.status === "prevu")
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** Les créneaux visés par la portée, la cible comprise, dans l'ordre chronologique. */
export function creneauxVises<T extends CreneauSerie>(
  creneaux: readonly T[],
  cible: T,
  portee: Portee,
): T[] {
  if (portee === "cette") return [cible];
  const prevus = creneauxPrevus(creneaux);
  if (portee === "serie") return prevus;
  return prevus.filter((c) => c.startAt >= cible.startAt);
}

/** Ce qui change entre l'occurrence et son nouvel horaire : jours calendaires, heure de début, durée. */
export type Decalage = { jours: number; debutMin: number; dureeMs: number };

export function decalage(ancien: Intervalle, nouveau: Intervalle): Decalage {
  const a = toParisWall(ancien.startAt);
  const n = toParisWall(nouveau.startAt);
  const jours = Math.round(
    (Date.UTC(n.y, n.mo - 1, n.da) - Date.UTC(a.y, a.mo - 1, a.da)) / 86_400_000,
  );
  return { jours, debutMin: n.min, dureeMs: nouveau.endAt.getTime() - nouveau.startAt.getTime() };
}

export function memeIntervalle(a: Intervalle, b: Intervalle): boolean {
  return a.startAt.getTime() === b.startAt.getTime() && a.endAt.getTime() === b.endAt.getTime();
}

export type Deplacement<T extends Intervalle> = { creneau: T; apres: Intervalle };

/** Applique le décalage à chaque créneau visé (jour décalé, nouvelles heures murales, nouvelle durée). */
export function deplacer<T extends Intervalle>(vises: readonly T[], d: Decalage): Deplacement<T>[] {
  return vises.map((c) => {
    const w = toParisWall(c.startAt);
    const jour = new Date(Date.UTC(w.y, w.mo - 1, w.da));
    jour.setUTCDate(jour.getUTCDate() + d.jours);
    const startAt = parisWallToInstant(
      jour.getUTCFullYear(),
      jour.getUTCMonth() + 1,
      jour.getUTCDate(),
      d.debutMin,
    );
    return { creneau: c, apres: { startAt, endAt: new Date(startAt.getTime() + d.dureeMs) } };
  });
}

/** Un créneau déplacé en chevauche-t-il un autre du même dossier (déplacé ou laissé en place) ? */
export function chevauchementInterne(
  apres: readonly Intervalle[],
  fixes: readonly Intervalle[],
): { a: Intervalle; b: Intervalle } | null {
  for (let i = 0; i < apres.length; i++) {
    for (let j = i + 1; j < apres.length; j++)
      if (chevauche(apres[i], apres[j])) return { a: apres[i], b: apres[j] };
    for (const f of fixes) if (chevauche(apres[i], f)) return { a: apres[i], b: f };
  }
  return null;
}

/**
 * La récurrence saisie, suivie quand toute la série bouge : jours de la semaine, date de fin
 * et dates exclues décalés d'autant. Inchangée si seules les heures changent.
 */
export function recurrenceDeplacee(rec: Recurrence | null, jours: number): Recurrence | null {
  if (!rec || jours === 0) return rec;
  const out: Recurrence = { ...rec };
  if (rec.byWeekday?.length)
    out.byWeekday = rec.byWeekday
      .map((j) => ((((j - 1 + jours) % 7) + 7) % 7) + 1)
      .sort((a, b) => a - b);
  if (rec.until) out.until = ajouterJours(rec.until, jours);
  if (rec.except?.length) out.except = rec.except.map((d) => ajouterJours(d, jours));
  return out;
}

/** « Mar. 03/11/2026 · 18h00 – 20h00 → Mer. 04/11/2026 · 19h00 – 21h00 ; … » (au plus `max` lignes). */
export function decrireDeplacements(deps: readonly Deplacement<Intervalle>[], max = 8): string {
  const lignes = deps
    .slice(0, max)
    .map(
      (d) =>
        `${plage(d.creneau.startAt, d.creneau.endAt)} → ${plage(d.apres.startAt, d.apres.endAt)}`,
    );
  if (deps.length > max) lignes.push(`… et ${deps.length - max} autre(s)`);
  return lignes.join(" ; ");
}

/** Le message rendu à l'agent. */
export function phraseDeplacement(nb: number, portee: Portee, prevenu: boolean): string {
  const quoi =
    nb === 1
      ? "Créneau déplacé"
      : `${nb} créneaux déplacés (${portee === "serie" ? "toute la série" : "celui-ci et les suivants"})`;
  return `${quoi}${prevenu ? ", usager prévenu" : ""}. Montants recalculés.`;
}
