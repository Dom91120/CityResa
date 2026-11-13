import { describe, expect, it } from "vitest";
import { duJour, estWeekend, fenetre, lireDate, lireVue } from "@/modules/planning/server";

describe("fenetre du planning", () => {
  it("semaine : du lundi au dimanche autour de la date, navigation de 7 jours", () => {
    const f = fenetre("semaine", "2026-11-10"); // un mardi
    expect(f.jours).toHaveLength(7);
    expect(f.jours[0]).toBe("2026-11-09");
    expect(f.jours[6]).toBe("2026-11-15");
    expect(f.precedent).toBe("2026-11-02");
    expect(f.suivant).toBe("2026-11-16");
    expect(f.label).toBe("Semaine du 9/11 au 15/11/2026");
  });

  it("mois : des semaines entières qui couvrent le mois, navigation au 1er", () => {
    const f = fenetre("mois", "2026-11-10");
    expect(f.jours.length % 7).toBe(0);
    expect(f.jours[0]).toBe("2026-10-26"); // lundi avant le 1er novembre (dimanche)
    expect(f.jours.at(-1)).toBe("2026-12-06");
    expect(f.precedent).toBe("2026-10-01");
    expect(f.suivant).toBe("2026-12-01");
    expect(f.mois).toBe("2026-11");
    expect(f.label).toBe("Novembre 2026");
  });

  it("mois : décembre → janvier de l'année suivante ; mars (changement d'heure) reste cohérent", () => {
    expect(fenetre("mois", "2026-12-03").suivant).toBe("2027-01-01");
    expect(fenetre("mois", "2026-01-03").precedent).toBe("2025-12-01");
    const mars = fenetre("mois", "2026-03-15");
    expect(mars.jours[0]).toBe("2026-02-23");
    expect(new Set(mars.jours).size).toBe(mars.jours.length);
  });

  it("jour : un seul jour, navigation d'un jour", () => {
    const f = fenetre("jour", "2026-11-10");
    expect(f.jours).toEqual(["2026-11-10"]);
    expect(f.precedent).toBe("2026-11-09");
    expect(f.suivant).toBe("2026-11-11");
  });

  it("lecture des paramètres : vue et date par défaut", () => {
    expect(lireVue(undefined)).toBe("semaine");
    expect(lireVue("mois")).toBe("mois");
    expect(lireVue("x")).toBe("semaine");
    expect(lireDate("2026-11-10")).toBe("2026-11-10");
    expect(lireDate("n'importe quoi")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("duJour : un créneau qui passe minuit apparaît les deux jours, pas le troisième", () => {
    const ev = {
      startAt: new Date("2026-11-10T22:00:00Z"),
      endAt: new Date("2026-11-11T01:00:00Z"),
    };
    expect(duJour([ev], "2026-11-10")).toHaveLength(1);
    expect(duJour([ev], "2026-11-11")).toHaveLength(1);
    expect(duJour([ev], "2026-11-12")).toHaveLength(0);
  });

  it("estWeekend", () => {
    expect(estWeekend("2026-11-14")).toBe(true);
    expect(estWeekend("2026-11-15")).toBe(true);
    expect(estWeekend("2026-11-10")).toBe(false);
  });
});
