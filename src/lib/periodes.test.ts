import { describe, expect, it } from "vitest";
import { PERIODES, periode, precedente } from "@/lib/periodes";

// Dimanche 15 novembre 2026, 13 h à Paris.
const now = new Date("2026-11-15T12:00:00Z");

describe("periode", () => {
  it("mois en cours (défaut) : du 1er du mois au 1er du mois suivant, minuit de Paris", () => {
    const p = periode(undefined, now);
    expect(p.de.toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(p.a.toISOString()).toBe("2026-11-30T23:00:00.000Z");
    expect(p.label).toBe("Novembre 2026");
    expect(p.cle).toBe("mois");
    expect(periode("mois", now)).toEqual(p);
    expect(periode("inconnue", now)).toEqual(p);
  });

  it("décembre passe à l'année suivante", () => {
    const p = periode("mois", new Date("2026-12-10T12:00:00Z"));
    expect(p.de.toISOString()).toBe("2026-11-30T23:00:00.000Z");
    expect(p.a.toISOString()).toBe("2026-12-31T23:00:00.000Z");
    expect(p.label).toBe("Décembre 2026");
  });

  it("trimestre : novembre est dans le 4e trimestre, qui s'achève au 1er janvier", () => {
    const p = periode("trimestre", now);
    expect(p.de.toISOString()).toBe("2026-09-30T22:00:00.000Z"); // 1er octobre, heure d'été
    expect(p.a.toISOString()).toBe("2026-12-31T23:00:00.000Z");
    expect(p.label).toBe("4e trimestre 2026");
  });

  it("trimestre : mai est dans le 2e trimestre", () => {
    const p = periode("trimestre", new Date("2026-05-20T12:00:00Z"));
    expect(p.de.toISOString()).toBe("2026-03-31T22:00:00.000Z");
    expect(p.a.toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(p.label).toBe("2e trimestre 2026");
  });

  // Écart constaté : le premier trimestre est libellé « 1e trimestre » au lieu de « 1er trimestre ».
  it("trimestre : le premier trimestre se lit « 1er trimestre »", () => {
    expect(periode("trimestre", new Date("2026-02-10T10:00:00.000Z")).label).toBe(
      "1er trimestre 2026",
    );
  });

  it("année civile", () => {
    const p = periode("annee", now);
    expect(p.de.toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(p.a.toISOString()).toBe("2026-12-31T23:00:00.000Z");
    expect(p.label).toBe("Année 2026");
  });

  it("30 et 90 derniers jours : jusqu'à demain minuit, en jours calendaires de Paris", () => {
    const p30 = periode("30j", now);
    expect(p30.de.toISOString()).toBe("2026-10-16T22:00:00.000Z"); // 17 octobre (heure d'été)
    expect(p30.a.toISOString()).toBe("2026-11-15T23:00:00.000Z"); // 16 novembre
    expect(p30.label).toBe("30 derniers jours");
    const p90 = periode("90j", now);
    expect(p90.de.toISOString()).toBe("2026-08-17T22:00:00.000Z"); // 18 août
    expect(p90.a).toEqual(p30.a);
  });

  it("12 derniers mois : depuis le 1er du mois suivant, un an plus tôt", () => {
    const p = periode("12m", now);
    expect(p.de.toISOString()).toBe("2025-11-30T23:00:00.000Z"); // 1er décembre 2025
    expect(p.a.toISOString()).toBe("2026-11-15T23:00:00.000Z");
    const dec = periode("12m", new Date("2026-12-10T12:00:00Z"));
    expect(dec.de.toISOString()).toBe("2025-12-31T23:00:00.000Z"); // 1er janvier 2026
  });
});

describe("precedente", () => {
  it("est de même durée et s'achève où commence la période", () => {
    const p = periode("30j", now);
    const q = precedente(p);
    expect(q.a).toEqual(p.de);
    expect(q.a.getTime() - q.de.getTime()).toBe(p.a.getTime() - p.de.getTime());
    expect(q.label).toBe("période précédente");
    expect(q.cle).toBe("30j");
  });
});

describe("PERIODES", () => {
  it("liste les clés connues de periode()", () => {
    expect(PERIODES.map(([cle]) => cle)).toEqual([
      "mois",
      "trimestre",
      "annee",
      "30j",
      "90j",
      "12m",
    ]);
    for (const [cle] of PERIODES) expect(periode(cle, now).cle).toBe(cle);
  });
});
