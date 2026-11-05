import { describe, expect, it } from "vitest";
import { parisDateTimeToInstant } from "@/lib/paris-time";
import {
  absencesParOrganisation,
  decrirePresence,
  heuresAConserver,
  heuresEffectives,
  intervalleEffectif,
  resumePresences,
  verifierSaisie,
} from "@/lib/presences";

const cr = (ymd: string, de: string, a: string) => ({
  startAt: parisDateTimeToInstant(ymd, de) as Date,
  endAt: parisDateTimeToInstant(ymd, a) as Date,
});
const now = parisDateTimeToInstant("2026-11-05", "10:00") as Date;
const passe = { ...cr("2026-11-02", "18:00", "20:00"), status: "prevu" };
const futur = { ...cr("2026-11-12", "18:00", "20:00"), status: "prevu" };

describe("heures effectives", () => {
  it("prévu sans constat = heures prévues ; présent avec heures réelles = réelles ; absent = 0", () => {
    expect(heuresEffectives(passe)).toBe(2);
    expect(
      heuresEffectives({ ...passe, presence: "presente", ...reel("18:30", "19:40") }),
    ).toBeCloseTo(1.1667, 3);
    expect(heuresEffectives({ ...passe, presence: "absente" })).toBe(0);
    expect(heuresEffectives({ ...passe, status: "annule" })).toBe(0);
    expect(intervalleEffectif({ ...passe, presence: "presente" })).toEqual(
      cr("2026-11-02", "18:00", "20:00"),
    );
  });
});

function reel(de: string, a: string) {
  return {
    realStartAt: parisDateTimeToInstant("2026-11-02", de) as Date,
    realEndAt: parisDateTimeToInstant("2026-11-02", a) as Date,
  };
}

describe("saisie", () => {
  it("contrôle les heures constatées et ne garde que celles qui diffèrent du prévu", () => {
    const ok = { presence: "presente" as const, ...reel("18:30", "19:40"), note: null };
    expect(verifierSaisie(passe, ok)).toEqual([]);
    expect(verifierSaisie(passe, { ...ok, realEndAt: null })).toHaveLength(1);
    expect(verifierSaisie(passe, { ...ok, ...reel("19:40", "18:30") })).toContain(
      "Le départ doit être après l'arrivée.",
    );
    expect(
      verifierSaisie(passe, {
        ...ok,
        realStartAt: parisDateTimeToInstant("2026-11-03", "18:30") as Date,
        realEndAt: parisDateTimeToInstant("2026-11-03", "19:40") as Date,
      }),
    ).toContain("Les heures constatées doivent rester autour du créneau prévu.");
    expect(
      verifierSaisie(passe, {
        presence: "absente",
        realStartAt: null,
        realEndAt: null,
        note: null,
      }),
    ).toEqual([]);
    expect(heuresAConserver(passe, ok)).toEqual(reel("18:30", "19:40"));
    expect(heuresAConserver(passe, { ...ok, ...reel("18:00", "20:00") })).toEqual({
      realStartAt: null,
      realEndAt: null,
    });
    expect(heuresAConserver(passe, { ...ok, presence: "absente" })).toEqual({
      realStartAt: null,
      realEndAt: null,
    });
  });
});

describe("résumé et libellés", () => {
  it("ne compte que les créneaux passés, taux de présence sur les constats", () => {
    const r = resumePresences(
      [
        { ...passe, presence: "presente", ...reel("18:30", "19:30") },
        { ...passe, presence: "absente" },
        { ...passe },
        futur,
        { ...passe, status: "annule", presence: "absente" },
      ],
      now,
    );
    expect(r).toEqual({
      passes: 3,
      renseignes: 2,
      presents: 1,
      absents: 1,
      heuresPrevues: 4,
      heuresReelles: 1,
      tauxPresence: 50,
    });
    expect(resumePresences([futur], now).tauxPresence).toBeNull();
  });

  it("décrit la présence", () => {
    expect(decrirePresence(passe)).toBe("");
    expect(decrirePresence({ ...passe, presence: "presente" })).toBe("Présent");
    expect(decrirePresence({ ...passe, presence: "presente", ...reel("18:30", "19:40") })).toBe(
      "Présent · 1 h 10 constatées",
    );
    expect(decrirePresence({ ...passe, presence: "absente" })).toBe("Absent sans prévenir");
  });

  it("classe les organisations par absences non signalées", () => {
    const a = { id: 1, name: "A" };
    const b = { id: 2, name: "B" };
    const top = absencesParOrganisation([
      {
        organisation: a,
        creneaux: [
          { ...passe, presence: "absente" },
          { ...passe, presence: "presente" },
        ],
      },
      {
        organisation: b,
        creneaux: [
          { ...passe, presence: "absente" },
          { ...passe, presence: "absente" },
        ],
      },
      { organisation: a, creneaux: [{ ...passe, presence: "absente" }] },
      { organisation: null, creneaux: [{ ...passe, presence: "absente" }] },
    ]);
    // À égalité d’absences, l’ordre alphabétique.
    expect(top).toEqual([
      { id: 1, name: "A", absences: 2, passes: 3 },
      { id: 2, name: "B", absences: 2, passes: 2 },
    ]);
  });
});
