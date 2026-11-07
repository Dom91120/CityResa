import { describe, expect, it } from "vitest";
import {
  datesParDefaut,
  depotOuvert,
  etatDepot,
  exerciceCampagne,
  labelCampagne,
} from "@/lib/campagne-subvention";
import { parisDateTimeToInstant } from "@/lib/paris-time";

const c = { status: "ouverte", ouverture: "2026-10-01", cloture: "2026-11-20" };

describe("campagne de subventions", () => {
  it("ouvre le dépôt entre les deux dates incluses, quand la campagne est ouverte", () => {
    expect(etatDepot(c, "2026-09-30")).toBe("a_venir");
    expect(etatDepot(c, "2026-10-01")).toBe("ouvert");
    expect(etatDepot(c, "2026-11-20")).toBe("ouvert");
    expect(etatDepot(c, "2026-11-21")).toBe("ferme");
    expect(etatDepot({ ...c, status: "brouillon" }, "2026-10-15")).toBe("inactive");
    expect(depotOuvert(c, "2026-10-15")).toBe(true);
    expect(depotOuvert({ ...c, status: "cloturee" }, "2026-10-15")).toBe(false);
  });

  it("propose l'exercice suivant dès octobre et les dates de la Ville", () => {
    expect(exerciceCampagne(parisDateTimeToInstant("2026-09-30", "12:00") as Date)).toBe(2026);
    expect(exerciceCampagne(parisDateTimeToInstant("2026-10-01", "12:00") as Date)).toBe(2027);
    expect(datesParDefaut(2027)).toEqual({ ouverture: "2026-10-01", cloture: "2026-11-20" });
    expect(labelCampagne(2027)).toBe("Campagne de subventions 2027");
  });
});
