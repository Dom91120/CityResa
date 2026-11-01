import { describe, expect, it } from "vitest";
import {
  addParisDays,
  hm,
  minutesDe,
  parisDateTimeToInstant,
  parisMidnight,
  parisOffsetMin,
  parisParts,
  parisWallToInstant,
  todayParisISO,
  toParisWall,
} from "@/lib/paris-time";

describe("parisOffsetMin", () => {
  it("vaut 60 min en hiver et 120 min en été", () => {
    expect(parisOffsetMin(new Date("2026-01-15T12:00:00Z"))).toBe(60);
    expect(parisOffsetMin(new Date("2026-07-15T12:00:00Z"))).toBe(120);
  });

  it("bascule au dernier dimanche de mars à 1 h UTC et d'octobre à 1 h UTC", () => {
    expect(parisOffsetMin(new Date("2026-03-29T00:59:00Z"))).toBe(60);
    expect(parisOffsetMin(new Date("2026-03-29T01:00:00Z"))).toBe(120);
    expect(parisOffsetMin(new Date("2026-10-25T00:59:00Z"))).toBe(120);
    expect(parisOffsetMin(new Date("2026-10-25T01:00:00Z"))).toBe(60);
  });
});

describe("toParisWall / parisWallToInstant", () => {
  it("convertit un instant UTC en heure murale de Paris", () => {
    expect(toParisWall(new Date("2026-01-15T17:30:00Z"))).toEqual({
      y: 2026,
      mo: 1,
      da: 15,
      min: 18 * 60 + 30,
    });
    expect(toParisWall(new Date("2026-07-15T17:30:00Z"))).toEqual({
      y: 2026,
      mo: 7,
      da: 15,
      min: 19 * 60 + 30,
    });
  });

  it("passe au jour suivant après 23 h UTC", () => {
    expect(toParisWall(new Date("2026-07-15T23:30:00Z"))).toEqual({
      y: 2026,
      mo: 7,
      da: 16,
      min: 90,
    });
  });

  it("fait l'aller-retour exact en hiver comme en été", () => {
    for (const iso of ["2026-01-10T08:00:00Z", "2026-07-10T08:00:00Z", "2026-03-29T05:00:00Z"]) {
      const d = new Date(iso);
      const w = toParisWall(d);
      expect(parisWallToInstant(w.y, w.mo, w.da, w.min).getTime()).toBe(d.getTime());
    }
  });

  it("18 h de Paris vaut 17 h UTC en hiver et 16 h UTC en été", () => {
    expect(parisWallToInstant(2026, 1, 15, 18 * 60).toISOString()).toBe("2026-01-15T17:00:00.000Z");
    expect(parisWallToInstant(2026, 7, 15, 18 * 60).toISOString()).toBe("2026-07-15T16:00:00.000Z");
  });

  it("accepte un jour hors du mois (report sur le mois suivant)", () => {
    expect(parisWallToInstant(2026, 1, 32, 0).toISOString()).toBe("2026-01-31T23:00:00.000Z");
  });
});

describe("parisDateTimeToInstant", () => {
  it("lit « YYYY-MM-DD » + « HH:MM » en heure de Paris", () => {
    expect(parisDateTimeToInstant("2026-11-08", "08:30")?.toISOString()).toBe(
      "2026-11-08T07:30:00.000Z",
    );
    expect(parisDateTimeToInstant(" 2026-06-01 ", "9:05")?.toISOString()).toBe(
      "2026-06-01T07:05:00.000Z",
    );
  });

  it("refuse une saisie invalide", () => {
    expect(parisDateTimeToInstant("2026/11/08", "08:30")).toBeNull();
    expect(parisDateTimeToInstant("2026-11-08", "8h30")).toBeNull();
    expect(parisDateTimeToInstant("2026-11-08", "24:00")).toBeNull();
    expect(parisDateTimeToInstant("2026-11-08", "12:60")).toBeNull();
    expect(parisDateTimeToInstant("", "")).toBeNull();
  });
});

describe("parisParts", () => {
  it("donne la clé de date, les minutes et le jour ISO (lundi = 1, dimanche = 7)", () => {
    // Le 1er novembre 2026 est un dimanche.
    expect(parisParts(new Date("2026-11-01T10:00:00Z"))).toEqual({
      dateKey: "2026-11-01",
      min: 11 * 60,
      weekday: 7,
    });
    // Le 2 novembre 2026 est un lundi ; 23 h 30 UTC = 0 h 30 à Paris le 3.
    expect(parisParts(new Date("2026-11-02T23:30:00Z"))).toEqual({
      dateKey: "2026-11-03",
      min: 30,
      weekday: 2,
    });
  });
});

describe("todayParisISO / parisMidnight", () => {
  it("donne la date de Paris, même quand l'UTC est encore la veille", () => {
    expect(todayParisISO(new Date("2026-07-15T22:30:00Z"))).toBe("2026-07-16");
    expect(todayParisISO(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
  });

  it("minuit de Paris est 23 h UTC la veille en hiver, 22 h UTC en été", () => {
    expect(parisMidnight("2026-01-16").toISOString()).toBe("2026-01-15T23:00:00.000Z");
    expect(parisMidnight("2026-07-16").toISOString()).toBe("2026-07-15T22:00:00.000Z");
  });
});

describe("addParisDays", () => {
  it("garde l'heure murale à travers le passage à l'heure d'été", () => {
    const avant = parisWallToInstant(2026, 3, 28, 18 * 60); // samedi 28 mars, 18 h (hiver)
    const apres = addParisDays(avant, 1); // dimanche 29 mars, 18 h (été)
    expect(toParisWall(apres)).toEqual({ y: 2026, mo: 3, da: 29, min: 18 * 60 });
    // Seulement 23 heures se sont écoulées.
    expect(apres.getTime() - avant.getTime()).toBe(23 * 3_600_000);
  });

  it("garde l'heure murale à travers le passage à l'heure d'hiver et accepte un décalage négatif", () => {
    const avant = parisWallToInstant(2026, 10, 24, 9 * 60);
    const apres = addParisDays(avant, 1);
    expect(toParisWall(apres)).toEqual({ y: 2026, mo: 10, da: 25, min: 9 * 60 });
    expect(apres.getTime() - avant.getTime()).toBe(25 * 3_600_000);
    expect(toParisWall(addParisDays(apres, -1))).toEqual(toParisWall(avant));
  });

  it("franchit les mois et les années", () => {
    expect(toParisWall(addParisDays(parisWallToInstant(2026, 12, 31, 600), 1))).toEqual({
      y: 2027,
      mo: 1,
      da: 1,
      min: 600,
    });
  });
});

describe("hm / minutesDe", () => {
  it("formate et lit des « HH:MM »", () => {
    expect(hm(0)).toBe("00:00");
    expect(hm(8 * 60 + 5)).toBe("08:05");
    expect(hm(23 * 60 + 59)).toBe("23:59");
    expect(minutesDe("08:05")).toBe(485);
    expect(minutesDe("8:05")).toBe(485);
    expect(minutesDe(" 22:00 ")).toBe(1320);
  });

  it("refuse les heures impossibles ou mal formées", () => {
    expect(minutesDe("24:00")).toBeNull();
    expect(minutesDe("12:75")).toBeNull();
    expect(minutesDe("12h30")).toBeNull();
    expect(minutesDe("")).toBeNull();
  });
});
