import { describe, expect, it } from "vitest";
import {
  ecartsBudgetRealise,
  groupes,
  nettoyerMontants,
  PLAN_ASSOCIATIF,
  PLAN_SPORTIF,
  planDe,
  ratioDemande,
  totaux,
} from "@/lib/plan-budget";

describe("plans de budget", () => {
  it("choisit le plan selon la nature de l'association et regroupe les postes", () => {
    expect(planDe(true).cle).toBe("sportif");
    expect(planDe(false).cle).toBe("associatif");
    const g = groupes(PLAN_ASSOCIATIF.charges);
    expect(g[0].groupe).toBe("60 · Achats");
    expect(g[0].postes.map((p) => p.code)).toEqual([
      "achats_etudes",
      "achats_matieres",
      "autres_fournitures",
    ]);
    expect(groupes(PLAN_SPORTIF.produits)[0].groupe).toBe("Subventions");
  });

  it("n'a pas deux postes de même code dans un même tableau", () => {
    for (const plan of [PLAN_ASSOCIATIF, PLAN_SPORTIF]) {
      for (const liste of [plan.charges, plan.produits]) {
        const codes = liste.map((p) => p.code);
        expect(new Set(codes).size).toBe(codes.length);
      }
    }
  });

  it("calcule les totaux directs, avec contributions, et le résultat", () => {
    const t = totaux(PLAN_ASSOCIATIF, {
      achats_matieres: 1200.5,
      locations: 800,
      cotisations: 1500,
      subv_commune: 3000,
      benevolat: 4000,
      personnel_benevole: 4000,
      inconnu: 999,
    });
    expect(t).toEqual({
      chargesDirectes: 2000.5,
      produitsDirects: 4500,
      contributionsCharges: 4000,
      contributionsProduits: 4000,
      charges: 6000.5,
      produits: 8500,
      resultat: 2499.5,
    });
  });

  it("donne le ratio demandé / produits et les écarts budget / réalisé", () => {
    expect(ratioDemande(3000, 9500)).toBe(31.6);
    expect(ratioDemande(3000, 0)).toBeNull();
    expect(
      ecartsBudgetRealise(
        PLAN_ASSOCIATIF.charges.slice(0, 2),
        { achats_etudes: 100 },
        { achats_etudes: 130, achats_matieres: 20 },
      ),
    ).toEqual([
      { code: "achats_etudes", budget: 100, realise: 130, ecart: 30 },
      { code: "achats_matieres", budget: 0, realise: 20, ecart: 20 },
    ]);
  });

  it("nettoie des montants bruts : codes connus, nombres positifs, virgule acceptée", () => {
    expect(
      nettoyerMontants(PLAN_SPORTIF, {
        licences: "1 250,50",
        arbitrage: -3,
        hors: 10,
        parrainage: 300,
      }),
    ).toEqual({ licences: 1250.5, parrainage: 300 });
    expect(nettoyerMontants(PLAN_SPORTIF, null)).toEqual({});
  });
});
