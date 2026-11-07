/**
 * La campagne annuelle de subventions : dépôt des dossiers entre deux dates, statut, exercice
 * par défaut. Logique PURE : testée dans campagne-subvention.test.ts.
 */
import { toParisWall } from "@/lib/paris-time";

export type CampagneRef = {
  status: string;
  /** « YYYY-MM-DD ». */
  ouverture: string;
  cloture: string;
};

export const TRANSITIONS_CAMPAGNE_SUBVENTION: Record<string, string[]> = {
  brouillon: ["ouverte"],
  ouverte: ["cloturee", "brouillon"],
  cloturee: ["ouverte"],
};

/** L'exercice de la campagne à préparer : l'année suivante dès octobre, sinon l'année en cours. */
export function exerciceCampagne(now = new Date()): number {
  const w = toParisWall(now);
  return w.mo >= 10 ? w.y + 1 : w.y;
}

export type EtatDepot = "a_venir" | "ouvert" | "ferme" | "inactive";

/** Le dépôt est-il possible sur le portail ce jour-là ? */
export function etatDepot(c: CampagneRef, jour: string): EtatDepot {
  if (c.status !== "ouverte") return "inactive";
  if (jour < c.ouverture) return "a_venir";
  if (jour > c.cloture) return "ferme";
  return "ouvert";
}

export function depotOuvert(c: CampagneRef, jour: string): boolean {
  return etatDepot(c, jour) === "ouvert";
}

/** Les dates proposées par défaut : du 1er octobre au 20 novembre de l'année précédant l'exercice. */
export function datesParDefaut(exercice: number): { ouverture: string; cloture: string } {
  return { ouverture: `${exercice - 1}-10-01`, cloture: `${exercice - 1}-11-20` };
}

export function labelCampagne(exercice: number): string {
  return `Campagne de subventions ${exercice}`;
}
