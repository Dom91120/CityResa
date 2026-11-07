import { describe, expect, it } from "vitest";
import { type ContextePieces, piecesManquantes, piecesRequises } from "@/lib/pieces-subvention";

const base: ContextePieces = {
  nature: "renouvellement",
  commissaireAuxComptes: false,
  mandataire: false,
  changement: false,
  actions: false,
};

describe("pièces du dossier", () => {
  it("renouvellement simple : PV d'AG, comptes, RIB et compte rendu des actions", () => {
    expect(piecesRequises(base).map((p) => p.kind)).toEqual([
      "pv_ag",
      "comptes",
      "rib",
      "compte_rendu",
    ]);
  });

  it("première demande : statuts et composition du conseil, pas de compte rendu", () => {
    expect(piecesRequises({ ...base, nature: "premiere" }).map((p) => p.kind)).toEqual([
      "pv_ag",
      "comptes",
      "rib",
      "statuts",
      "composition_ca",
    ]);
  });

  it("ajoute le rapport du commissaire, le pouvoir du mandataire, le projet d'action et les statuts modifiés", () => {
    const kinds = piecesRequises({
      ...base,
      commissaireAuxComptes: true,
      mandataire: true,
      changement: true,
      actions: true,
    }).map((p) => p.kind);
    expect(kinds).toEqual([
      "pv_ag",
      "comptes",
      "rib",
      "compte_rendu",
      "rapport_cac",
      "statuts",
      "composition_ca",
      "pouvoir",
      "projet_action",
    ]);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("liste ce qui manque d'après les pièces fournies", () => {
    expect(piecesManquantes(base, ["pv_ag", "rib", "autre"]).map((p) => p.kind)).toEqual([
      "comptes",
      "compte_rendu",
    ]);
  });
});
