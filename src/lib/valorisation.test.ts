import { describe, expect, it } from "vitest";
import { parisDateTimeToInstant } from "@/lib/paris-time";
import {
  avantage,
  cumuler,
  exerciceDe,
  lignesAnnexe,
  partExercice,
  sansConvention,
  seuilsFranchis,
  totaux,
  valeurReference,
} from "@/lib/valorisation";

const inst = (ymd: string, hm: string) => {
  const d = parisDateTimeToInstant(ymd, hm);
  if (!d) throw new Error("date invalide");
  return d;
};
const SEUILS = { convention: 23000, certification: 153000 };
const org = (id: number, name: string, conventionnee = false) => ({
  id,
  name,
  type: "association",
  conventionnee,
});
const dossier = (id: number, o: ReturnType<typeof org>, valeur: number, redevance: number) => ({
  reservationId: id,
  numero: `RES-${id}`,
  titre: "x",
  espace: "Salle",
  heures: 10,
  valeurReference: valeur,
  redevance,
  avantage: avantage(valeur, redevance),
  organisation: o,
});

describe("exercice et part", () => {
  it("rattache un instant à son année civile de Paris", () => {
    expect(exerciceDe(inst("2026-12-31", "23:30"))).toBe(2026);
    expect(exerciceDe(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
  });

  it("isole les créneaux de l'exercice et la part d'heures qu'ils représentent", () => {
    const r = partExercice(
      [
        { startAt: inst("2026-09-01", "18:00"), endAt: inst("2026-09-01", "20:00") },
        { startAt: inst("2027-01-05", "18:00"), endAt: inst("2027-01-05", "21:00") },
      ],
      2027,
    );
    expect(r.dedans).toHaveLength(1);
    expect(r.heures).toBe(3);
    expect(r.part).toBeCloseTo(0.6);
    expect(partExercice([], 2027)).toEqual({ dedans: [], heures: 0, part: 0 });
  });
});

describe("valeur et avantage", () => {
  it("préfère la valeur horaire de l'espace, sinon le devis de référence", () => {
    expect(valeurReference(10, 25, 999)).toBe(250);
    expect(valeurReference(10, null, 123.456)).toBe(123.46);
  });
  it("ne rend jamais un avantage négatif", () => {
    expect(avantage(250, 100)).toBe(150);
    expect(avantage(100, 250)).toBe(0);
  });
});

describe("cumul par organisation et seuils", () => {
  const a = org(1, "Asso A");
  const b = org(2, "Asso B", true);
  const lignes = cumuler(
    [dossier(1, a, 20000, 0), dossier(2, a, 2000, 500), dossier(3, b, 150000, 0)],
    new Map([
      [1, 2000],
      [3, 500],
    ]),
    [a, b, org(3, "Asso C")],
  );

  it("additionne dossiers, heures, valeurs et subventions, trié par total décroissant", () => {
    expect(lignes.map((l) => [l.nom, l.nbDossiers, l.avantage, l.subventions, l.total])).toEqual([
      ["Asso B", 1, 150000, 0, 150000],
      ["Asso A", 2, 21500, 2000, 23500],
      ["Asso C", 0, 0, 500, 500],
    ]);
    expect(lignes[1].heures).toBe(20);
  });

  it("repère les seuils franchis et les conventions manquantes", () => {
    expect(seuilsFranchis(23500, SEUILS)).toEqual({ convention: true, certification: false });
    expect(seuilsFranchis(160000, SEUILS)).toEqual({ convention: true, certification: true });
    expect(seuilsFranchis(500, SEUILS)).toEqual({ convention: false, certification: false });
    expect(seuilsFranchis(500, { convention: 0, certification: 0 }).convention).toBe(false);
    expect(sansConvention(lignes, SEUILS).map((l) => l.nom)).toEqual(["Asso A"]);
  });

  it("totalise et produit l'annexe", () => {
    const t = totaux(lignes);
    expect(t.organisations).toBe(3);
    expect(t.total).toBe(174000);
    const annexe = lignesAnnexe(2026, lignes, SEUILS);
    expect(annexe[0][0]).toBe("Exercice");
    expect(annexe[1]).toEqual([
      2026,
      "Asso B",
      "association",
      "oui",
      1,
      10,
      150000,
      0,
      150000,
      0,
      150000,
      "dépassé",
      "",
    ]);
  });
});
