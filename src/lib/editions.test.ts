import { describe, expect, it } from "vitest";
import {
  couloirs,
  joursDeLaSemaine,
  lundiDe,
  type OccupationDatee,
  plageAffichee,
  plageMinutes,
  projeter,
  semaineType,
  surSemaine,
} from "@/lib/editions";
import { parisDateTimeToInstant, toParisWall } from "@/lib/paris-time";

const inst = (ymd: string, hm: string) => {
  const d = parisDateTimeToInstant(ymd, hm);
  if (!d) throw new Error("date de test invalide");
  return d;
};
const occ = (de: Date, a: Date, titre = "x"): OccupationDatee => ({
  startAt: de,
  endAt: a,
  titre,
  sousTitre: "",
  genre: "reservation",
  espaceId: 7,
});

describe("semaine", () => {
  it("trouve le lundi et déroule les sept jours", () => {
    expect(lundiDe("2026-11-05")).toBe("2026-11-02");
    expect(lundiDe("2026-11-02")).toBe("2026-11-02");
    expect(lundiDe("2026-11-08")).toBe("2026-11-02");
    expect(joursDeLaSemaine("2026-11-02")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  it("projette sur les jours, en découpant à minuit", () => {
    const jours = joursDeLaSemaine("2026-11-02");
    const evts = projeter(
      [
        occ(inst("2026-11-03", "18:00"), inst("2026-11-03", "20:00"), "mardi"),
        occ(inst("2026-11-07", "20:00"), inst("2026-11-08", "02:00"), "nuit"),
        occ(inst("2026-11-10", "10:00"), inst("2026-11-10", "12:00"), "hors semaine"),
      ],
      jours,
    );
    expect(evts.map((e) => [e.titre, e.jour, e.debutMin, e.finMin])).toEqual([
      ["mardi", 2, 18 * 60, 20 * 60],
      ["nuit", 6, 20 * 60, 1440],
      ["nuit", 7, 0, 2 * 60],
    ]);
  });

  it("élargit la plage affichée aux événements", () => {
    expect(plageAffichee([])).toEqual({ debutH: 8, finH: 22 });
    expect(plageAffichee([{ debutMin: 6 * 60 + 30, finMin: 23 * 60 + 15 }])).toEqual({
      debutH: 6,
      finH: 24,
    });
  });

  it("répartit les chevauchements en couloirs", () => {
    const c = couloirs([
      { id: 1, debutMin: 600, finMin: 720 },
      { id: 2, debutMin: 660, finMin: 780 },
      { id: 3, debutMin: 720, finMin: 800 },
      { id: 4, debutMin: 900, finMin: 960 },
    ]);
    expect(c.map((x) => [x.id, x.couloir, x.nbCouloirs])).toEqual([
      [1, 0, 2],
      [2, 1, 2],
      [3, 0, 2],
      [4, 0, 1],
    ]);
  });
});

describe("semaine type", () => {
  it("ramène les séries hebdomadaires sur une semaine, aux heures du premier créneau", () => {
    const series = semaineType([
      {
        id: 3,
        numero: "RES-3",
        title: "Twirling",
        qui: "SGDT 92",
        espaceId: 7,
        recurrence: { freq: "weekly", byWeekday: [2], horsVacances: true },
        creneaux: [
          {
            startAt: inst("2026-09-29", "19:00"),
            endAt: inst("2026-09-29", "21:30"),
            status: "prevu",
          },
          {
            startAt: inst("2026-10-06", "19:00"),
            endAt: inst("2026-10-06", "21:30"),
            status: "prevu",
          },
          {
            startAt: inst("2026-10-13", "19:00"),
            endAt: inst("2026-10-13", "21:30"),
            status: "annule",
          },
        ],
      },
      {
        id: 4,
        numero: "RES-4",
        title: "Ponctuel",
        qui: "X",
        espaceId: 7,
        recurrence: null,
        creneaux: [
          {
            startAt: inst("2026-10-01", "10:00"),
            endAt: inst("2026-10-01", "12:00"),
            status: "prevu",
          },
        ],
      },
    ]);
    expect(series).toEqual([
      {
        reservationId: 3,
        numero: "RES-3",
        titre: "Twirling",
        qui: "SGDT 92",
        espaceId: 7,
        jour: 2,
        debutMin: 19 * 60,
        finMin: 21 * 60 + 30,
        nb: 2,
        horsVacances: true,
      },
    ]);
  });

  it("projette une série sur la semaine d'un lundi, en heure de Paris", () => {
    const i = surSemaine({ jour: 4, debutMin: 18 * 60, finMin: 20 * 60 }, "2026-11-02");
    const w = toParisWall(i.startAt);
    expect([w.y, w.mo, w.da, w.min]).toEqual([2026, 11, 5, 18 * 60]);
    expect(toParisWall(i.endAt).min).toBe(20 * 60);
  });

  it("écrit une plage en minutes", () => {
    expect(plageMinutes(18 * 60, 20 * 60 + 30)).toBe("18h00 - 20h30");
  });
});
