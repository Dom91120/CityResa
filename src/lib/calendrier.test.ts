import { describe, expect, it } from "vitest";
import {
  ajouterJours,
  anneeScolaire,
  decrirePeriode,
  joursDesPeriodes,
  joursEntre,
  joursFeries,
  joursFeriesEntre,
  labelSaisonValide,
  lireCalendrierScolaire,
  nbJours,
  paques,
  periodesSeRecouvrent,
  saisonDe,
  saisonSuivante,
} from "@/lib/calendrier";

describe("jours et périodes", () => {
  it("ajouterJours et joursEntre, bornes incluses", () => {
    expect(ajouterJours("2026-12-31", 1)).toBe("2027-01-01");
    expect(ajouterJours("2027-03-01", -1)).toBe("2027-02-28");
    expect(joursEntre("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(joursEntre("2026-11-02", "2026-10-30")).toEqual([]);
    expect(nbJours({ debut: "2027-05-07", fin: "2027-05-07" })).toBe(1);
  });

  it("joursDesPeriodes fusionne les périodes", () => {
    const s = joursDesPeriodes([
      { debut: "2026-12-19", fin: "2027-01-03" },
      { debut: "2026-12-25", fin: "2026-12-25" },
    ]);
    expect(s.size).toBe(16);
    expect(s.has("2026-12-25")).toBe(true);
    expect(s.has("2027-01-04")).toBe(false);
  });

  it("periodesSeRecouvrent et decrirePeriode", () => {
    expect(
      periodesSeRecouvrent(
        { debut: "2026-09-01", fin: "2027-08-31" },
        { debut: "2027-07-03", fin: "2027-09-01" },
      ),
    ).toBe(true);
    expect(
      periodesSeRecouvrent(
        { debut: "2026-09-01", fin: "2027-08-31" },
        { debut: "2027-09-01", fin: "2027-09-05" },
      ),
    ).toBe(false);
    expect(decrirePeriode({ debut: "2026-10-17", fin: "2026-11-01" })).toBe(
      "du 17/10 au 01/11/2026",
    );
    expect(decrirePeriode({ debut: "2026-12-19", fin: "2027-01-03" })).toBe(
      "du 19/12/2026 au 03/01/2027",
    );
    expect(decrirePeriode({ debut: "2027-05-07", fin: "2027-05-07" })).toBe("le 07/05/2027");
  });
});

describe("jours fériés", () => {
  it("calcule Pâques", () => {
    expect(paques(2026)).toBe("2026-04-05");
    expect(paques(2027)).toBe("2027-03-28");
    expect(paques(2000)).toBe("2000-04-23");
  });

  it("donne les onze fériés de la métropole, triés", () => {
    const f = joursFeries(2027);
    expect(f).toHaveLength(11);
    expect(f.map((x) => x.date)).toEqual([
      "2027-01-01",
      "2027-03-29",
      "2027-05-01",
      "2027-05-06",
      "2027-05-08",
      "2027-05-17",
      "2027-07-14",
      "2027-08-15",
      "2027-11-01",
      "2027-11-11",
      "2027-12-25",
    ]);
    expect(f.find((x) => x.date === "2027-05-06")?.label).toBe("Ascension");
  });

  it("joursFeriesEntre borne sur une saison à cheval sur deux années", () => {
    const f = joursFeriesEntre("2026-09-01", "2027-08-31").map((x) => x.date);
    expect(f[0]).toBe("2026-11-01");
    expect(f.at(-1)).toBe("2027-08-15");
    // 2026 : Toussaint, Armistice, Noël ; 2027 : Jour de l'an, Pâques, 1er et 8 mai,
    // Ascension, Pentecôte, 14 juillet, Assomption.
    expect(f).toHaveLength(11);
  });
});

describe("saisons", () => {
  it("année scolaire du 1er septembre au 31 août", () => {
    expect(anneeScolaire("2026-09-01")).toBe("2026-2027");
    expect(anneeScolaire("2027-08-31")).toBe("2026-2027");
    expect(anneeScolaire("2027-09-01")).toBe("2027-2028");
    expect(saisonDe("2026-11-02")).toEqual({
      label: "2026-2027",
      debut: "2026-09-01",
      fin: "2027-08-31",
    });
    expect(saisonSuivante({ debut: "2026-09-01", fin: "2027-08-31" }).label).toBe("2027-2028");
  });

  it("valide le libellé d'une saison", () => {
    expect(labelSaisonValide("2026-2027")).toBe(true);
    expect(labelSaisonValide("2026-2028")).toBe(false);
    expect(labelSaisonValide("saison 2026")).toBe(false);
  });
});

describe("lireCalendrierScolaire (open data)", () => {
  const records = [
    {
      description: "Vacances de la Toussaint",
      start_date: "2026-10-16T22:00:00+00:00",
      end_date: "2026-11-01T23:00:00+00:00",
      population: "-",
    },
    {
      description: "Vacances d'Été",
      start_date: "2027-07-02T22:00:00+00:00",
      end_date: "2027-09-01T22:00:00+00:00",
      population: "Enseignants",
    },
    {
      description: "Vacances d'Été",
      start_date: "2027-07-02T22:00:00+00:00",
      end_date: "2027-08-31T22:00:00+00:00",
      population: "Élèves",
    },
    {
      description: "Pont de l'Ascension",
      start_date: "2027-05-06T22:00:00+00:00",
      end_date: "2027-05-06T22:00:00+00:00",
      population: "-",
    },
    { description: "Sans dates" },
  ];

  it("convertit en jours de Paris, la reprise exclue, et retient la version Élèves", () => {
    const out = lireCalendrierScolaire({ results: records });
    expect(out).toEqual([
      { label: "Vacances de la Toussaint", debut: "2026-10-17", fin: "2026-11-01" },
      { label: "Pont de l'Ascension", debut: "2027-05-07", fin: "2027-05-07" },
      { label: "Vacances d'Été", debut: "2027-07-03", fin: "2027-08-31" },
    ]);
  });

  it("accepte une liste nue et ignore le reste", () => {
    expect(lireCalendrierScolaire(records.slice(0, 1))).toHaveLength(1);
    expect(lireCalendrierScolaire(null)).toEqual([]);
    expect(lireCalendrierScolaire({ rien: 1 })).toEqual([]);
  });
});
