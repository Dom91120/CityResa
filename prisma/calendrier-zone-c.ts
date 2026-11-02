/**
 * Vacances scolaires de la zone C (académies de Créteil, Montpellier, Paris, Toulouse,
 * Versailles) telles que publiées par le ministère : bornes INCLUSES, le dernier jour étant
 * la veille de la reprise des cours. Jeu de démonstration seulement (le serveur importe
 * normalement le calendrier officiel depuis data.education.gouv.fr).
 */
export type VacancesConnues = { label: string; debut: string; fin: string };

export const VACANCES_ZONE_C: Record<string, VacancesConnues[]> = {
  "2025-2026": [
    { label: "Vacances de la Toussaint", debut: "2025-10-18", fin: "2025-11-02" },
    { label: "Vacances de Noël", debut: "2025-12-20", fin: "2026-01-04" },
    { label: "Vacances d'Hiver", debut: "2026-02-21", fin: "2026-03-08" },
    { label: "Vacances de Printemps", debut: "2026-04-18", fin: "2026-05-03" },
    { label: "Pont de l'Ascension", debut: "2026-05-15", fin: "2026-05-15" },
    { label: "Vacances d'Été", debut: "2026-07-04", fin: "2026-08-31" },
  ],
  "2026-2027": [
    { label: "Vacances de la Toussaint", debut: "2026-10-17", fin: "2026-11-01" },
    { label: "Vacances de Noël", debut: "2026-12-19", fin: "2027-01-03" },
    { label: "Vacances d'Hiver", debut: "2027-02-06", fin: "2027-02-21" },
    { label: "Vacances de Printemps", debut: "2027-04-03", fin: "2027-04-18" },
    { label: "Pont de l'Ascension", debut: "2027-05-07", fin: "2027-05-07" },
    { label: "Vacances d'Été", debut: "2027-07-03", fin: "2027-08-31" },
  ],
};
