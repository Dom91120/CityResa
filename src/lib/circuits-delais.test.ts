import { describe, expect, it } from "vitest";
import {
  delaiDe,
  delaisParGroupe,
  type LigneEtape,
  lirePeriodeDelais,
  mediane,
} from "@/lib/circuits-delais";

const H = 3_600_000;
const T0 = new Date("2026-11-02T08:00:00Z");
const NOW = new Date("2026-11-20T08:00:00Z");

/** Une étape ouverte à T0 + `debut` heures, close `duree` heures plus tard (ou ouverte). */
function ligne(
  groupe: string,
  status: string,
  duree: number | null,
  echeanceH: number | null = null,
  debut = 0,
): LigneEtape {
  const ouvertAt = new Date(T0.getTime() + debut * H);
  return {
    groupe,
    status,
    ouvertAt,
    closAt: duree === null ? null : new Date(ouvertAt.getTime() + duree * H),
    echeanceAt: echeanceH === null ? null : new Date(ouvertAt.getTime() + echeanceH * H),
  };
}

describe("délais des étapes", () => {
  it("calcule la médiane", () => {
    expect(mediane([])).toBeNull();
    expect(mediane([5])).toBe(5);
    expect(mediane([9, 1, 5])).toBe(5);
    expect(mediane([1, 3, 5, 100])).toBe(4);
  });

  it("agrège durées, issues et réponses hors délai", () => {
    const d = delaiDe(
      "Visa",
      [
        ligne("Visa", "validee", 24, 48),
        ligne("Visa", "validee", 72, 48),
        ligne("Visa", "refusee", 48, null),
      ],
      NOW,
    );
    expect(d.closes).toBe(3);
    expect(d.accords).toBe(2);
    expect(d.refus).toBe(1);
    expect(d.moyenne).toBe(48 * 60);
    expect(d.mediane).toBe(48 * 60);
    expect(d.max).toBe(72 * 60);
    expect(d.horsDelai).toBe(1);
    expect(d.ouvertes).toBe(0);
  });

  it("compte les étapes ouvertes et celles en retard", () => {
    const d = delaiDe(
      "Visa",
      [ligne("Visa", "ouverte", null, 24), ligne("Visa", "ouverte", null, 24 * 60)],
      NOW,
    );
    expect(d.closes).toBe(0);
    expect(d.moyenne).toBeNull();
    expect(d.ouvertes).toBe(2);
    expect(d.enRetard).toBe(1);
  });

  it("regroupe, écarte les étapes annulées et trie par volume", () => {
    const r = delaisParGroupe(
      [
        ligne("Sports", "validee", 10),
        ligne("Fêtes", "validee", 10),
        ligne("Fêtes", "ouverte", null),
        ligne("Fêtes", "annulee", 5),
        ligne("Aucun", "annulee", 5),
      ],
      NOW,
    );
    expect(r.map((d) => [d.groupe, d.closes, d.ouvertes])).toEqual([
      ["Fêtes", 1, 1],
      ["Sports", 1, 0],
    ]);
  });

  it("lit la période, douze mois par défaut", () => {
    expect(lirePeriodeDelais("3")).toBe(3);
    expect(lirePeriodeDelais("6")).toBe(6);
    expect(lirePeriodeDelais("9")).toBe(12);
    expect(lirePeriodeDelais(undefined)).toBe(12);
  });
});
