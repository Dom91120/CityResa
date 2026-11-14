/**
 * Campagne annuelle d'attribution des créneaux : statuts, priorité des demandeurs, conflits
 * entre vœux, arbitrage automatique, passage d'un vœu à une demande de réservation.
 * Logique PURE : testée dans campagnes.test.ts.
 */

import { ajouterJours } from "@/lib/calendrier";
import { chevauche, type Intervalle, type Recurrence } from "@/lib/creneaux";
import { parseYmdUtc } from "@/lib/date-utc";
import { NOMS_JOURS } from "@/lib/libelles";
import { ENTRE_HEURES, hm, parisDateTimeToInstant } from "@/lib/paris-time";

// ── Statuts ──

export type CampagneStatus = "brouillon" | "ouverte" | "instruction" | "cloturee";

export const CAMPAGNE_STATUS: Record<
  CampagneStatus,
  { label: string; teinte: string; aide: string }
> = {
  brouillon: { label: "Brouillon", teinte: "slate", aide: "Invisible des usagers." },
  ouverte: { label: "Dépôt ouvert", teinte: "sky", aide: "Les usagers déposent leurs vœux." },
  instruction: {
    label: "En instruction",
    teinte: "amber",
    aide: "Dépôt clos : la Ville arbitre et attribue.",
  },
  cloturee: { label: "Clôturée", teinte: "emerald", aide: "Décisions rendues et communiquées." },
};

export const TRANSITIONS_CAMPAGNE: Record<CampagneStatus, CampagneStatus[]> = {
  brouillon: ["ouverte"],
  ouverte: ["instruction", "brouillon"],
  instruction: ["cloturee", "ouverte"],
  cloturee: ["instruction"],
};

export const TRANSITION_CAMPAGNE_LIBELLES: Record<
  CampagneStatus,
  { label: string; icone: string }
> = {
  brouillon: { label: "Repasser en brouillon", icone: "pencil" },
  ouverte: { label: "Ouvrir le dépôt des vœux", icone: "mail-open" },
  instruction: { label: "Clore le dépôt et instruire", icone: "gavel" },
  cloturee: { label: "Clôturer la campagne", icone: "check-check" },
};

export function lireStatutCampagne(v: unknown): CampagneStatus | null {
  return v === "brouillon" || v === "ouverte" || v === "instruction" || v === "cloturee" ? v : null;
}

export type VoeuStatus = "en_attente" | "attribue" | "refuse";

export const VOEU_STATUS: Record<VoeuStatus, { label: string; teinte: string }> = {
  en_attente: { label: "En attente", teinte: "amber" },
  attribue: { label: "Attribué", teinte: "emerald" },
  refuse: { label: "Refusé", teinte: "red" },
};

// ── Priorité ──

/**
 * Niveaux de priorité d'attribution : services de la Ville, puis autres collectivités et
 * établissements (scolaire), associations conventionnées, autres associations, puis
 * entreprises, particuliers et autres.
 */
export const PRIORITES: { niveau: number; label: string }[] = [
  { niveau: 1, label: "Ville" },
  { niveau: 2, label: "Collectivité / scolaire" },
  { niveau: 3, label: "Association conventionnée" },
  { niveau: 4, label: "Association" },
  { niveau: 5, label: "Entreprise, particulier ou autre" },
];

export function prioriteDe(org: { type: string; conventionnee: boolean }): number {
  if (org.type === "service_interne") return 1;
  if (org.type === "collectivite") return 2;
  if (org.type === "association") return org.conventionnee ? 3 : 4;
  return 5;
}

export function libellePriorite(niveau: number): string {
  return PRIORITES.find((p) => p.niveau === niveau)?.label ?? `Niveau ${niveau}`;
}

// ── Créneau hebdomadaire ──

export type CreneauHebdo = { weekday: number; startMin: number; endMin: number };

/** Les manquements d'un créneau hebdomadaire (vide = conforme). `pas` : pas de saisie en minutes. */
export function verifierCreneauHebdo(c: CreneauHebdo, pas = 30): string[] {
  const erreurs: string[] = [];
  if (!Number.isInteger(c.weekday) || c.weekday < 1 || c.weekday > 7)
    erreurs.push("Choisissez le jour de la semaine.");
  if (c.endMin <= c.startMin) erreurs.push("L'heure de fin doit être après l'heure de début.");
  if (c.startMin < 0 || c.endMin > 24 * 60) erreurs.push("Les heures sortent de la journée.");
  if (c.startMin % pas !== 0 || c.endMin % pas !== 0)
    erreurs.push(`Les horaires se saisissent par pas de ${pas} min.`);
  return erreurs;
}

/** « Mardi 18h00 – 20h00 » */
export function decrireCreneauHebdo(c: CreneauHebdo): string {
  const h = (min: number) => hm(min).replace(":", "h");
  const jour = NOMS_JOURS[c.weekday - 1] ?? "?";
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${h(c.startMin)}${ENTRE_HEURES}${h(c.endMin)}`;
}

export function memeJourEtChevauche(a: CreneauHebdo, b: CreneauHebdo): boolean {
  return a.weekday === b.weekday && a.startMin < b.endMin && b.startMin < a.endMin;
}

// ── Conflits et arbitrage ──

export type VoeuArbitrable = CreneauHebdo & {
  id: number;
  espaceId: number;
  status: string;
  priorite: number;
  createdAt: Date;
};

/** Deux vœux se disputent-ils un créneau ? (même espace, même jour, heures qui se recouvrent) */
export function voeuxEnConflit(a: VoeuArbitrable, b: VoeuArbitrable): boolean {
  return a.id !== b.id && a.espaceId === b.espaceId && memeJourEtChevauche(a, b);
}

/** Les identifiants des vœux vivants (en attente ou attribués) en conflit avec chaque vœu. */
export function conflitsParVoeu(voeux: readonly VoeuArbitrable[]): Map<number, number[]> {
  const vivants = voeux.filter((v) => v.status !== "refuse");
  const out = new Map<number, number[]>();
  for (const v of voeux) {
    out.set(
      v.id,
      v.status === "refuse" ? [] : vivants.filter((x) => voeuxEnConflit(v, x)).map((x) => x.id),
    );
  }
  return out;
}

/** L'ordre d'arbitrage : priorité la plus forte, puis dépôt le plus ancien. */
export function ordreArbitrage(a: VoeuArbitrable, b: VoeuArbitrable): number {
  return a.priorite - b.priorite || a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id;
}

export type Arbitrage = {
  /** Vœux en attente retenus, dans l'ordre d'attribution. */
  retenus: number[];
  /** Vœux en attente écartés, avec le vœu qui l'emporte. */
  ecartes: { id: number; gagnantId: number }[];
};

/**
 * L'arbitrage automatique : les vœux déjà attribués sont acquis ; chaque vœu en attente, pris
 * par priorité puis ancienneté, est retenu s'il ne chevauche aucun vœu acquis ou déjà retenu,
 * sinon écarté au profit du premier qui l'occupe.
 */
export function arbitrer(voeux: readonly VoeuArbitrable[]): Arbitrage {
  const acquis = voeux.filter((v) => v.status === "attribue");
  const candidats = voeux.filter((v) => v.status === "en_attente").sort(ordreArbitrage);
  const retenus: VoeuArbitrable[] = [];
  const ecartes: { id: number; gagnantId: number }[] = [];
  for (const v of candidats) {
    const gagnant = [...acquis, ...retenus].find((x) => voeuxEnConflit(v, x));
    if (gagnant) ecartes.push({ id: v.id, gagnantId: gagnant.id });
    else retenus.push(v);
  }
  return { retenus: retenus.map((v) => v.id), ecartes };
}

// ── Du vœu à la demande ──

/** Le premier jour « YYYY-MM-DD » de la saison tombant ce jour de la semaine (ISO 1-7). */
export function premiereOccurrence(saisonDebut: string, weekday: number): string {
  const d = parseYmdUtc(saisonDebut);
  const jour = ((d.getUTCDay() + 6) % 7) + 1;
  return ajouterJours(saisonDebut, (weekday - jour + 7) % 7);
}

/** Le premier créneau et la récurrence hebdomadaire d'un vœu sur toute la saison. */
export function voeuVersDemande(
  v: CreneauHebdo & { horsVacances: boolean },
  saison: { debut: string; fin: string },
): { premier: Intervalle; recurrence: Recurrence } {
  const jour = premiereOccurrence(saison.debut, v.weekday);
  const startAt = parisDateTimeToInstant(jour, hm(v.startMin));
  const endAt = parisDateTimeToInstant(jour, hm(v.endMin));
  if (!startAt || !endAt) throw new Error("créneau hebdomadaire invalide");
  return {
    premier: { startAt, endAt },
    recurrence: {
      freq: "weekly",
      interval: 1,
      byWeekday: [v.weekday],
      until: saison.fin,
      horsVacances: v.horsVacances,
      horsFeries: true,
    },
  };
}

/** Un créneau de réservation chevauche-t-il la première occurrence ? (contrôle de forme) */
export function occurrenceChevauche(a: Intervalle, b: Intervalle): boolean {
  return chevauche(a, b);
}

// ── Bilan ──

export type BilanArbitrage = { attribues: number; refuses: number; erreurs: number };

export function phraseBilanArbitrage(b: BilanArbitrage): string {
  const parts = [
    `${b.attribues} vœu${b.attribues > 1 ? "x" : ""} attribué${b.attribues > 1 ? "s" : ""}`,
    `${b.refuses} refusé${b.refuses > 1 ? "s" : ""}`,
  ];
  if (b.erreurs)
    parts.push(
      `${b.erreurs} laissé${b.erreurs > 1 ? "s" : ""} en attente (créneau indisponible ou règle de l'espace)`,
    );
  return `Arbitrage terminé : ${parts.join(", ")}.`;
}
