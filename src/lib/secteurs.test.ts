import { describe, expect, it } from "vitest";
import {
  agentsHorsSecteur,
  collegue,
  espacesHorsSecteur,
  libelleSecteur,
  lireSecteur,
  rattachable,
  secteurDeduit,
} from "@/lib/secteurs";

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
