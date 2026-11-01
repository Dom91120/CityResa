/**
 * Les périodes du tableau de bord et des statistiques (heure de Paris) : mois en cours,
 * trimestre, année, 30 / 90 derniers jours, ou bornes libres.
 */
import { addParisDays, parisMidnight, todayParisISO, toParisWall } from "@/lib/paris-time";

export type Periode = { de: Date; a: Date; label: string; cle: string };

export const PERIODES: [string, string][] = [
  ["mois", "Ce mois-ci"],
  ["trimestre", "Ce trimestre"],
  ["annee", "Cette année"],
  ["30j", "30 derniers jours"],
  ["90j", "90 derniers jours"],
  ["12m", "12 derniers mois"],
];

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function periode(cle: string | undefined, now = new Date()): Periode {
  const w = toParisWall(now);
  const today = todayParisISO(now);
  const minuit = parisMidnight(today);
  const demain = addParisDays(minuit, 1);
  const debutMois = (y: number, m: number) =>
    parisMidnight(`${y}-${String(m).padStart(2, "0")}-01`);
  switch (cle) {
    case "trimestre": {
      const q = Math.floor((w.mo - 1) / 3);
      const de = debutMois(w.y, q * 3 + 1);
      const a = q === 3 ? debutMois(w.y + 1, 1) : debutMois(w.y, q * 3 + 4);
      return {
        de,
        a,
        label: `${q === 0 ? "1er" : `${q + 1}e`} trimestre ${w.y}`,
        cle: "trimestre",
      };
    }
    case "annee":
      return {
        de: debutMois(w.y, 1),
        a: debutMois(w.y + 1, 1),
        label: `Année ${w.y}`,
        cle: "annee",
      };
    case "30j":
      return { de: addParisDays(minuit, -29), a: demain, label: "30 derniers jours", cle: "30j" };
    case "90j":
      return { de: addParisDays(minuit, -89), a: demain, label: "90 derniers jours", cle: "90j" };
    case "12m": {
      const de = debutMois(w.mo === 12 ? w.y : w.y - 1, w.mo === 12 ? 1 : w.mo + 1);
      return { de, a: demain, label: "12 derniers mois", cle: "12m" };
    }
    default: {
      const de = debutMois(w.y, w.mo);
      const a = w.mo === 12 ? debutMois(w.y + 1, 1) : debutMois(w.y, w.mo + 1);
      return {
        de,
        a,
        label: `${MOIS[w.mo - 1].charAt(0).toUpperCase()}${MOIS[w.mo - 1].slice(1)} ${w.y}`,
        cle: "mois",
      };
    }
  }
}

/** La période précédente, de même durée, pour les variations. */
export function precedente(p: Periode): Periode {
  const duree = p.a.getTime() - p.de.getTime();
  return { de: new Date(p.de.getTime() - duree), a: p.de, label: "période précédente", cle: p.cle };
}
