import { describe, expect, it } from "vitest";
import {
  brouillonUtile,
  decrireBrouillon,
  extraireBrouillon,
  lireBrouillon,
} from "@/lib/brouillons";
import { parisDateTimeToInstant } from "@/lib/paris-time";
import { lienDemande, lireSimulation, verdict } from "@/lib/simulateur";

describe("simulateur", () => {
  it("ne lit rien tant que le visiteur n'a rien saisi, signale une saisie incomplète", () => {
    expect(lireSimulation({})).toBeNull();
    expect(typeof lireSimulation({ sim_date: "2026-12-05" })).toBe("string");
    expect(typeof lireSimulation({ sim_date: "hier", sim_debut: "10:00", sim_fin: "12:00" })).toBe(
      "string",
    );
  });

  it("lit date, heures (fin après minuit = lendemain), profil et options", () => {
    const s = lireSimulation({
      sim_date: "2026-12-05",
      sim_debut: "22:00",
      sim_fin: "01:00",
      sim_profil: "3",
      sim_opt: ["4", "4", "x", "7"],
    });
    if (typeof s !== "object" || s === null) throw new Error("simulation attendue");
    expect(s.profilId).toBe(3);
    expect(s.optionIds).toEqual([4, 7]);
    expect(s.creneau.startAt).toEqual(parisDateTimeToInstant("2026-12-05", "22:00"));
    expect(s.creneau.endAt).toEqual(parisDateTimeToInstant("2026-12-06", "01:00"));
    expect(lienDemande("salle-a", s)).toBe(
      "/portail/reserver/salle-a?date=2026-12-05&heure_debut=22%3A00&heure_fin=01%3A00&option_4=1&option_7=1",
    );
  });

  it("donne un verdict : règle enfreinte, occupé, ou disponible", () => {
    expect(verdict(["Durée minimale : 1 h."], 2).teinte).toBe("amber");
    expect(verdict([], 1).teinte).toBe("red");
    expect(verdict([], 0)).toEqual({ teinte: "emerald", texte: "Créneau disponible à ce jour." });
  });
});

describe("brouillons", () => {
  it("garde les champs connus, les jours en liste, ignore le reste et le vide", () => {
    const d = extraireBrouillon([
      ["csrf_token", "x"],
      ["date", "2026-12-05"],
      ["title", "  "],
      ["weekday", "1"],
      ["weekday", "3"],
      ["option_4", "1"],
      ["materiel_2", "3"],
      ["accepte_reglement", "on"],
      ["bidule", "1"],
    ]);
    expect(d).toEqual({ date: "2026-12-05", weekday: ["1", "3"], option_4: "1", materiel_2: "3" });
    expect(lireBrouillon({ date: "2026-12-05", weekday: ["1"], title: 3, bidule: "x" })).toEqual({
      date: "2026-12-05",
      weekday: ["1"],
    });
    expect(lireBrouillon("rien")).toEqual({});
  });

  it("décrit une carte de brouillon", () => {
    expect(brouillonUtile({})).toBe(false);
    expect(brouillonUtile({ title: "AG" })).toBe(true);
    expect(
      decrireBrouillon({
        title: "AG",
        date: "2026-12-05",
        heure_debut: "10:00",
        heure_fin: "12:00",
      }),
    ).toEqual({
      titre: "AG",
      quand: "05/12/2026 · 10h00 – 12h00",
    });
    expect(decrireBrouillon({ participants: "12" })).toEqual({
      titre: "Demande sans objet",
      quand: "date à préciser",
    });
  });
});
