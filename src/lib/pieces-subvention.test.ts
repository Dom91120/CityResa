import { describe, expect, it } from "vitest";
import {
  type ContextePieces,
  piecesManquantes,
  piecesRequises,
  rangerPieces,
} from "@/lib/pieces-subvention";

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

describe("rangerPieces", () => {
  const piece = (kind: string) => ({ kind, libelle: kind, condition: "toutes" as const });
  const etats = [
    { piece: piece("pv_ag"), fournie: true },
    { piece: piece("rib"), fournie: false },
  ];

  it("range chaque fichier sous la pièce attendue de même nature", () => {
    const docs = [
      { id: 1, kind: "pv_ag" },
      { id: 2, kind: "pv_ag" },
    ];
    const r = rangerPieces(etats, docs);
    expect(r.attendues.map((a) => [a.piece.kind, a.fournie, a.documents.map((d) => d.id)])).toEqual(
      [
        ["pv_ag", true, [1, 2]],
        ["rib", false, []],
      ],
    );
    expect(r.autres).toEqual([]);
  });

  it("garde à part les fichiers que le dossier n'exigeait pas", () => {
    const r = rangerPieces(etats, [
      { id: 3, kind: "piece" },
      { id: 4, kind: "pv_ag" },
    ]);
    expect(r.autres.map((d) => d.id)).toEqual([3]);
    expect(r.attendues[0].documents.map((d) => d.id)).toEqual([4]);
  });
});
