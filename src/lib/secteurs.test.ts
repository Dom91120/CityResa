import { describe, expect, it } from "vitest";
import {
  agentsHorsSecteur,
  collegue,
  dansPerimetre,
  espacesHorsSecteur,
  libelleSecteur,
  lireSecteur,
  perimetreDeConsultation,
  rattachable,
  secteurDeduit,
  siteVisible,
} from "@/lib/secteurs";

describe("voir n'est pas décider", () => {
  const salles = [5, 6, 7];

  it("sans service qui voit tout, on consulte ce que l'on gère", () => {
    expect(perimetreDeConsultation(salles, false)).toEqual(salles);
  });

  it("un service qui voit tous les espaces ouvre la consultation à tout", () => {
    const vus = perimetreDeConsultation(salles, true);
    expect(vus).toEqual([]);
    expect(dansPerimetre(vus, 12)).toBe(true);
    // Le périmètre de gestion, lui, ne bouge pas : le gymnase 12 reste hors de portée.
    expect(dansPerimetre(salles, 12)).toBe(false);
    expect(dansPerimetre(salles, 6)).toBe(true);
  });

  it("un agent sans périmètre voyait déjà tout", () => {
    expect(perimetreDeConsultation([], false)).toEqual([]);
    expect(dansPerimetre([], 99)).toBe(true);
  });

  it("un secteur sans espace (périmètre [0]) ne voit rien, sauf service qui voit tout", () => {
    expect(dansPerimetre(perimetreDeConsultation([0], false), 3)).toBe(false);
    expect(dansPerimetre(perimetreDeConsultation([0], true), 3)).toBe(true);
  });
});

describe("lecture et libellé", () => {
  it("ne retient qu'un secteur connu, sinon aucun", () => {
    expect(lireSecteur("sport")).toBe("sport");
    expect(lireSecteur(" salle ")).toBe("salle");
    expect(lireSecteur("")).toBeNull();
    expect(lireSecteur("culture")).toBeNull();
    expect(lireSecteur(undefined)).toBeNull();
  });

  it("nomme le secteur, ou « Transversal » sans secteur", () => {
    expect(libelleSecteur("salle")).toBe("Salles");
    expect(libelleSecteur("sport")).toBe("Sports");
    expect(libelleSecteur(null)).toBe("Transversal");
  });
});

describe("rattachement d'un agent à un espace", () => {
  it("un agent d'un secteur ne se rattache qu'aux espaces de ce secteur", () => {
    expect(rattachable("sport", "sport")).toBe(true);
    expect(rattachable("sport", "salle")).toBe(false);
  });

  it("un agent transversal se rattache partout", () => {
    expect(rattachable(null, "salle")).toBe(true);
    expect(rattachable(null, "sport")).toBe(true);
  });
});

describe("collègues dans « Mon équipe »", () => {
  it("un agent d'un secteur voit son secteur et les transversaux, pas l'autre secteur", () => {
    expect(collegue("salle", "salle")).toBe(true);
    expect(collegue("salle", null)).toBe(true);
    expect(collegue("salle", "sport")).toBe(false);
  });

  it("un agent transversal voit tout le monde", () => {
    expect(collegue(null, "salle")).toBe(true);
    expect(collegue(null, "sport")).toBe(true);
    expect(collegue(null, null)).toBe(true);
  });
});

describe("visibilité d'un site", () => {
  it("se voit dès qu'un de ses espaces est dans le périmètre", () => {
    expect(siteVisible([1, 2], [2, 9])).toBe(true);
    expect(siteVisible([1, 2], [8, 9])).toBe(false);
  });

  it("reste visible sans périmètre restreint, ou tant qu'il n'a aucun espace", () => {
    expect(siteVisible([], [8, 9])).toBe(true);
    expect(siteVisible([1, 2], [])).toBe(true);
  });
});

describe("reprise et changements de secteur", () => {
  it("déduit le secteur d'espaces homogènes, aucun s'ils sont mêlés ou absents", () => {
    expect(secteurDeduit(["sport", "sport"])).toBe("sport");
    expect(secteurDeduit(["sport", "salle"])).toBeNull();
    expect(secteurDeduit([])).toBeNull();
  });

  it("liste les espaces qui empêchent de donner un secteur à un agent", () => {
    const espaces = [
      { name: "Gymnase", secteur: "sport" },
      { name: "Salle des fêtes", secteur: "salle" },
    ];
    expect(espacesHorsSecteur("sport", espaces).map((e) => e.name)).toEqual(["Salle des fêtes"]);
    expect(espacesHorsSecteur(null, espaces)).toEqual([]);
  });

  it("liste les agents qui empêchent de changer le secteur d'un espace", () => {
    const agents = [
      { nom: "Sophie", secteur: "salle" },
      { nom: "Karim", secteur: "sport" },
      { nom: "Pierre", secteur: null },
    ];
    expect(agentsHorsSecteur("sport", agents).map((a) => a.nom)).toEqual(["Sophie"]);
  });
});
