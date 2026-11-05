import { describe, expect, it } from "vitest";
import {
  decrireBareme,
  ecrireBareme,
  fraisAnnulation,
  fraisPrevus,
  joursAvant,
  lireBareme,
  tauxAnnulation,
} from "@/lib/annulation";

const BAREME = lireBareme("30:20;7:50;2:100");

describe("barème d'annulation", () => {
  it("lit les tranches, ignore le bruit et trie par jours croissants", () => {
    expect(lireBareme("2:100, 30:20 ; 7:50%")).toEqual([
      { jours: 2, taux: 100 },
      { jours: 7, taux: 50 },
      { jours: 30, taux: 20 },
    ]);
    expect(lireBareme("abc;7:;0:100")).toEqual([]);
    expect(lireBareme("")).toEqual([]);
    expect(lireBareme("7:150;7:20")).toEqual([{ jours: 7, taux: 100 }]);
    expect(ecrireBareme(BAREME)).toBe("30:20;7:50;2:100");
  });

  it("applique la tranche la plus courte qui contient le délai, rien au-delà", () => {
    expect(tauxAnnulation(BAREME, 45)).toBe(0);
    expect(tauxAnnulation(BAREME, 30)).toBe(0);
    expect(tauxAnnulation(BAREME, 29)).toBe(20);
    expect(tauxAnnulation(BAREME, 7)).toBe(20);
    expect(tauxAnnulation(BAREME, 6)).toBe(50);
    expect(tauxAnnulation(BAREME, 1)).toBe(100);
    expect(tauxAnnulation(BAREME, -3)).toBe(100);
    expect(tauxAnnulation([], 2)).toBe(0);
    expect(tauxAnnulation(lireBareme("7:50"), 10)).toBe(0);
    expect(tauxAnnulation(lireBareme("7:50"), 3)).toBe(50);
  });

  it("calcule des frais au centime", () => {
    expect(fraisAnnulation(123.45, 50)).toBe(61.73);
    expect(fraisAnnulation(100, 0)).toBe(0);
  });

  it("compte les jours entiers avant le début", () => {
    const debut = new Date("2026-12-01T18:00:00Z");
    expect(joursAvant(debut, new Date("2026-11-24T19:00:00Z"))).toBe(6);
    expect(joursAvant(debut, new Date("2026-11-24T17:00:00Z"))).toBe(7);
    expect(joursAvant(debut, new Date("2026-12-02T00:00:00Z"))).toBe(-1);
  });

  it("prévoit les frais d'un dossier acquis, rien pour un gratuit ou une simple demande", () => {
    const now = new Date("2026-11-25T10:00:00Z");
    const r = {
      status: "confirmee",
      startAt: new Date("2026-12-01T18:00:00Z"),
      montantTtc: 200,
      gratuit: false,
    };
    expect(fraisPrevus(r, BAREME, now)).toEqual({ jours: 6, taux: 50, montant: 100 });
    expect(
      fraisPrevus({ ...r, startAt: new Date("2027-01-15T18:00:00Z") }, BAREME, now),
    ).toBeNull();
    expect(fraisPrevus({ ...r, gratuit: true }, BAREME, now)).toBeNull();
    expect(fraisPrevus({ ...r, status: "a_traiter" }, BAREME, now)).toBeNull();
    expect(fraisPrevus(r, [], now)).toBeNull();
  });

  it("décrit le barème en français", () => {
    expect(decrireBareme(BAREME)).toBe(
      "20 % à moins de 30 jours du début, 50 % à moins de 7 jours, 100 % à moins de 2 jours.",
    );
    expect(decrireBareme([])).toBe("Aucun frais d'annulation.");
  });
});
