import { describe, expect, it } from "vitest";
import {
  derogationsUtiles,
  ecarts,
  lireNiveau,
  lireNiveaux,
  niveauEffectif,
  resumeEcarts,
} from "@/lib/droits";

const agent = { reservations: 2, planning: 2, usagers: 2, paiements: 0, subventions: 1 };

describe("niveau effectif", () => {
  it("suit le rôle sans dérogation", () => {
    expect(niveauEffectif(agent, {}, "reservations")).toBe(2);
    expect(niveauEffectif(agent, {}, "paiements")).toBe(0);
    expect(niveauEffectif(agent, {}, "materiel")).toBe(0);
  });

  it("une dérogation ouvre un domaine que le rôle ferme", () => {
    expect(niveauEffectif(agent, { paiements: 2 }, "paiements")).toBe(2);
  });

  it("une dérogation retire un domaine que le rôle donne, jusqu'à zéro", () => {
    expect(niveauEffectif(agent, { usagers: 1 }, "usagers")).toBe(1);
    expect(niveauEffectif(agent, { reservations: 0 }, "reservations")).toBe(0);
  });

  it("les autres catégories continuent de suivre le rôle", () => {
    expect(niveauEffectif(agent, { paiements: 2 }, "planning")).toBe(2);
  });
});

describe("écarts", () => {
  it("liste les seules catégories qui diffèrent du rôle", () => {
    expect(ecarts(agent, { paiements: 2, usagers: 1 })).toEqual([
      { categorie: "usagers", role: 2, compte: 1 },
      { categorie: "paiements", role: 0, compte: 2 },
    ]);
  });

  it("se résume en clair, rôle rappelé", () => {
    expect(resumeEcarts(ecarts(agent, { paiements: 2, usagers: 1 }))).toBe(
      "Usagers : Lecture (rôle : Écriture), Paiements : Écriture (rôle : Aucun)",
    );
    expect(resumeEcarts([])).toBe("");
  });

  it("une dérogation rattrapée par le rôle n'est plus un écart", () => {
    expect(ecarts({ ...agent, paiements: 2 }, { paiements: 2 })).toEqual([]);
    expect(ecarts(agent, {})).toEqual([]);
  });
});

describe("saisie", () => {
  it("ne retient ni « comme le rôle », ni un niveau égal à celui du rôle", () => {
    expect(
      derogationsUtiles(agent, { reservations: null, planning: 2, paiements: 2, materiel: 0 }),
    ).toEqual({ paiements: 2 });
  });

  it("tout laisser comme le rôle vide les dérogations", () => {
    expect(derogationsUtiles(agent, {})).toEqual({});
  });
});

describe("lecture", () => {
  it("n'accepte que des niveaux de 0 à 3", () => {
    expect(lireNiveau("2")).toBe(2);
    expect(lireNiveau(0)).toBe(0);
    expect(lireNiveau("4")).toBeNull();
    expect(lireNiveau("-1")).toBeNull();
    expect(lireNiveau("")).toBeNull();
    expect(lireNiveau(null)).toBeNull();
  });

  it("ignore les catégories inconnues et les valeurs invalides d'un JSON stocké", () => {
    expect(lireNiveaux({ paiements: 2, inconnue: 3, usagers: 9, planning: "1" })).toEqual({
      paiements: 2,
      planning: 1,
    });
    expect(lireNiveaux(null)).toEqual({});
    expect(lireNiveaux([1, 2])).toEqual({});
    expect(lireNiveaux("x")).toEqual({});
  });
});
