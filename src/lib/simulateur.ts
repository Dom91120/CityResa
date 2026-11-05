/**
 * Simulateur de tarif public : sur la page d'un espace, avant toute demande, un visiteur
 * saisit une date, des heures, un profil et des options pour connaître le tarif, le dépôt et
 * la caution ; un lien ouvre la demande pré-remplie. Logique PURE : simulateur.test.ts.
 */
import type { Intervalle } from "@/lib/creneaux";
import { parisDateTimeToInstant } from "@/lib/paris-time";

export type Simulation = {
  date: string;
  debut: string;
  fin: string;
  profilId: number | null;
  optionIds: number[];
  creneau: Intervalle;
};

export type Params = Record<string, string | string[] | undefined>;

const un = (p: Params, k: string): string => {
  const v = p[k];
  return typeof v === "string" ? v.trim() : "";
};

/**
 * Lit la simulation demandée (paramètres « sim_* » de l'adresse) ; null tant que le visiteur
 * n'a rien saisi, un message si la saisie est incomplète ou invalide.
 */
export function lireSimulation(p: Params): Simulation | string | null {
  const date = un(p, "sim_date");
  const debut = un(p, "sim_debut");
  const fin = un(p, "sim_fin");
  if (!date && !debut && !fin) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d{2}:\d{2}$/.test(debut) ||
    !/^\d{2}:\d{2}$/.test(fin)
  )
    return "Indiquez la date, l'heure de début et l'heure de fin.";
  const startAt = parisDateTimeToInstant(date, debut);
  let endAt = parisDateTimeToInstant(date, fin);
  if (!startAt || !endAt) return "Date ou heures invalides.";
  if (endAt <= startAt) endAt = new Date(endAt.getTime() + 86_400_000);
  const profil = Number(un(p, "sim_profil"));
  const brut = p.sim_opt;
  const liste = Array.isArray(brut) ? brut : brut ? [brut] : [];
  const optionIds = [...new Set(liste.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  return {
    date,
    debut,
    fin,
    profilId: Number.isInteger(profil) && profil > 0 ? profil : null,
    optionIds,
    creneau: { startAt, endAt },
  };
}

/** Le lien vers la demande pré-remplie avec la simulation (options comprises). */
export function lienDemande(slug: string, s: Simulation): string {
  const p = new URLSearchParams({ date: s.date, heure_debut: s.debut, heure_fin: s.fin });
  for (const id of s.optionIds) p.set(`option_${id}`, "1");
  return `/portail/reserver/${slug}?${p}`;
}

/** « Disponible », « Occupé » ou le premier manquement aux règles. */
export function verdict(
  erreurs: readonly string[],
  conflits: number,
): { teinte: "emerald" | "red" | "amber"; texte: string } {
  if (erreurs.length) return { teinte: "amber", texte: erreurs[0] };
  if (conflits)
    return { teinte: "red", texte: "Créneau déjà occupé : choisissez un autre horaire." };
  return { teinte: "emerald", texte: "Créneau disponible à ce jour." };
}
