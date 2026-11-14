import { describe, expect, it } from "vitest";
import {
  bornesFrise,
  empiler,
  graduations,
  libelleHeure,
  minutesDuJour,
  positionFrise,
} from "@/lib/frise";
import { parisDateTimeToInstant } from "@/lib/paris-time";

const t = (jour: string, hm: string) => parisDateTimeToInstant(jour, hm) as Date;

describe("minutesDuJour", () => {
  it("donne les minutes d'un élément dans sa journée", () => {
    expect(
      minutesDuJour(
        { startAt: t("2026-12-02", "14:00"), endAt: t("2026-12-02", "18:00") },
        "2026-12-02",
      ),
    ).toEqual({ debutMin: 840, finMin: 1080 });
  });

  it("rogne à minuit un élément qui déborde sur la veille ou le lendemain", () => {
    const nuit = { startAt: t("2026-12-02", "22:00"), endAt: t("2026-12-03", "02:00") };
    expect(minutesDuJour(nuit, "2026-12-02")).toEqual({ debutMin: 1320, finMin: 1440 });
    expect(minutesDuJour(nuit, "2026-12-03")).toEqual({ debutMin: 0, finMin: 120 });
    expect(minutesDuJour(nuit, "2026-12-04")).toBeNull();
  });

  it("garde entière une fin à minuit pile", () => {
    expect(
      minutesDuJour(
        { startAt: t("2026-12-02", "17:00"), endAt: t("2026-12-03", "00:00") },
        "2026-12-02",
      ),
    ).toEqual({ debutMin: 1020, finMin: 1440 });
    expect(
      minutesDuJour(
        { startAt: t("2026-12-02", "17:00"), endAt: t("2026-12-03", "00:00") },
        "2026-12-03",
      ),
    ).toBeNull();
  });
});

describe("bornesFrise", () => {
  it("montre 7 h - minuit par défaut", () => {
    expect(bornesFrise([])).toEqual({ debutMin: 420, finMin: 1440 });
    expect(bornesFrise([{ debutMin: 510, finMin: 780 }])).toEqual({ debutMin: 420, finMin: 1440 });
  });

  it("s'élargit à l'heure entière quand un élément commence plus tôt", () => {
    expect(bornesFrise([{ debutMin: 330, finMin: 600 }])).toEqual({ debutMin: 300, finMin: 1440 });
    expect(bornesFrise([{ debutMin: 0, finMin: 120 }])).toEqual({ debutMin: 0, finMin: 1440 });
  });

  it("suit d'autres bornes par défaut", () => {
    const defaut = { debutMin: 480, finMin: 1080 };
    expect(bornesFrise([{ debutMin: 1020, finMin: 1290 }], defaut)).toEqual({
      debutMin: 480,
      finMin: 1320,
    });
  });
});

describe("graduations", () => {
  it("gradue chaque heure pleine, bornes comprises", () => {
    expect(graduations({ debutMin: 420, finMin: 600 })).toEqual([420, 480, 540, 600]);
    expect(libelleHeure(420)).toBe("7h");
    expect(libelleHeure(1440)).toBe("0h");
  });
});

describe("positionFrise", () => {
  const bornes = { debutMin: 420, finMin: 1440 };

  it("place une plage en pourcentage de la frise", () => {
    expect(positionFrise({ debutMin: 420, finMin: 1440 }, bornes)).toEqual({
      gauche: 0,
      largeur: 100,
    });
    expect(positionFrise({ debutMin: 840, finMin: 1080 }, bornes)).toEqual({
      gauche: 41.18,
      largeur: 23.53,
    });
  });

  it("rogne ce qui dépasse des bornes", () => {
    expect(positionFrise({ debutMin: 0, finMin: 930 }, bornes)).toEqual({ gauche: 0, largeur: 50 });
  });
});

describe("empiler", () => {
  it("garde sur un niveau les éléments qui se suivent", () => {
    const r = empiler([
      { debutMin: 1140, finMin: 1380 },
      { debutMin: 840, finMin: 1080 },
    ]);
    expect(r.niveaux).toBe(1);
    expect(r.places.map((p) => [p.element.debutMin, p.niveau])).toEqual([
      [840, 0],
      [1140, 0],
    ]);
  });

  it("empile ceux qui se chevauchent et réutilise un niveau libéré", () => {
    const r = empiler([
      { debutMin: 480, finMin: 720 },
      { debutMin: 600, finMin: 780 },
      { debutMin: 720, finMin: 900 },
    ]);
    expect(r.niveaux).toBe(2);
    expect(r.places.map((p) => p.niveau)).toEqual([0, 1, 0]);
  });

  it("compte au moins un niveau pour une ligne vide", () => {
    expect(empiler([])).toEqual({ places: [], niveaux: 1 });
  });
});
