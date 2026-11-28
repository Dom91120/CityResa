/**
 * Les secteurs (salles, sports) : un espace en porte toujours un, un agent en porte un ou aucun.
 * Un agent sans secteur est TRANSVERSAL (administrateur, financier, élu) : rattachable partout et
 * visible de tous. Un agent d'un secteur ne se rattache qu'aux espaces de ce secteur, et sans
 * aucun rattachement son périmètre est tout son secteur.
 * Logique PURE : testée dans secteurs.test.ts.
 */
import { SECTEURS } from "@/lib/constantes";

/** Le secteur saisi dans un formulaire : une clé connue, ou null (aucun, transversal). */
export function lireSecteur(valeur: string | null | undefined): string | null {
  const v = (valeur ?? "").trim();
  return v in SECTEURS ? v : null;
}

export function libelleSecteur(secteur: string | null | undefined): string {
  if (!secteur) return "Transversal";
  return SECTEURS[secteur]?.label ?? secteur;
}

/** L'agent peut-il être rattaché à un espace de ce secteur ? */
export function rattachable(secteurAgent: string | null, secteurEspace: string): boolean {
  return !secteurAgent || secteurAgent === secteurEspace;
}

/**
 * « Mon équipe » vue par `moi` : un agent transversal voit tout le monde ; un agent d'un secteur
 * voit ses collègues du même secteur et les agents transversaux.
 */
export function collegue(moi: string | null, autre: string | null): boolean {
  return !moi || !autre || moi === autre;
}

/** Le secteur que l'on peut déduire des espaces d'un agent : le seul qu'ils partagent, sinon aucun. */
export function secteurDeduit(secteursDesEspaces: readonly string[]): string | null {
  const uniques = [...new Set(secteursDesEspaces)];
  return uniques.length === 1 ? uniques[0] : null;
}

/**
 * Un site se voit dès qu'un de ses espaces est dans le périmètre de l'agent (liste vide = tout).
 * Un site encore sans espace reste visible de tous : il faut bien pouvoir y créer le premier.
 */
export function siteVisible(
  perimetre: readonly number[],
  espacesDuSite: readonly number[],
): boolean {
  if (!perimetre.length || !espacesDuSite.length) return true;
  return espacesDuSite.some((id) => perimetre.includes(id));
}

/**
 * VOIR n'est pas DÉCIDER. Le périmètre de GESTION d'un agent (ses rattachements, sinon son
 * secteur) borne ce sur quoi il agit. Son périmètre de CONSULTATION borne ce qu'il lit :
 * planning, fiches d'espace et de site, dossiers. Il vaut le périmètre de gestion, sauf si l'un
 * des services de l'agent « voit tous les espaces » : il lit alors tout (liste vide), sans rien
 * pouvoir décider de plus. La Vie associative suit ainsi l'occupation des salles sportives.
 */
export function perimetreDeConsultation(
  perimetreDeGestion: readonly number[],
  voitTousEspaces: boolean,
): number[] {
  return voitTousEspaces ? [] : [...perimetreDeGestion];
}

/** L'espace est-il dans ce périmètre ? Une liste vide vaut « tous les espaces ». */
export function dansPerimetre(perimetre: readonly number[], espaceId: number): boolean {
  return perimetre.length === 0 || perimetre.includes(espaceId);
}

/** Parmi des espaces, ceux qui interdisent de donner ce secteur à l'agent qui y est rattaché. */
export function espacesHorsSecteur<T extends { secteur: string }>(
  secteurVoulu: string | null,
  espaces: readonly T[],
): T[] {
  if (!secteurVoulu) return [];
  return espaces.filter((e) => e.secteur !== secteurVoulu);
}

/** Parmi les agents rattachés à un espace, ceux qui interdisent de lui donner ce secteur. */
export function agentsHorsSecteur<T extends { secteur: string | null }>(
  secteurVoulu: string,
  agents: readonly T[],
): T[] {
  return agents.filter((a) => !rattachable(a.secteur, secteurVoulu));
}
