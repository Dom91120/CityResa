import { describe, expect, it } from "vitest";
import { parisDateTimeToInstant } from "@/lib/paris-time";
import {
  ajouterVue,
  couleurEvt,
  deplacementDepuisDepot,
  ecrireVuesEnregistrees,
  legende,
  lignesListe,
  lireCouleur,
  lireVuesEnregistrees,
  MAX_VUES,
  qsVue,
  retirerVue,
} from "@/lib/planning-vues";

const cr = (ymd: string, de: string, a: string) => ({
  startAt: parisDateTimeToInstant(ymd, de) as Date,
  endAt: parisDateTimeToInstant(ymd, a) as Date,
});

describe("couleur", () => {
  it("lit le mode et choisit la couleur du liseré", () => {
    expect(lireCouleur(undefined)).toBe("espace");
    expect(lireCouleur("statut")).toBe("statut");
    expect(lireCouleur("x")).toBe("espace");
    const e = { status: "confirmee", typeUsager: "entreprise" };
    expect(couleurEvt("espace", e, { color: "#123456" })).toBe("#123456");
    expect(couleurEvt("statut", e, { color: "#123456" })).toBe("var(--emerald-text)");
    expect(couleurEvt("usager", e, undefined)).toBe("var(--sky-text)");
    expect(couleurEvt("usager", { status: "confirmee", typeUsager: null }, undefined)).toBe(
      "var(--amber-text)",
    );
    expect(legende("espace")).toEqual([]);
    expect(legende("statut").map(([l]) => l)).toContain("Confirmée");
    expect(legende("usager").length).toBe(6);
  });
});

describe("vues enregistrées", () => {
  it("lit, ajoute, remplace, retire et réécrit sans toucher aux autres préférences", () => {
    expect(lireVuesEnregistrees(null)).toEqual([]);
    expect(lireVuesEnregistrees("{bad")).toEqual([]);
    const v1 = ajouterVue([], "Gymnases", "?site=2&vue=mois");
    expect(v1).toEqual([{ nom: "Gymnases", qs: "site=2&vue=mois" }]);
    const v2 = ajouterVue(v1 as never, "gymnases", "site=3");
    expect(v2).toEqual([{ nom: "gymnases", qs: "site=3" }]);
    expect(ajouterVue([], "  ", "x")).toContain("nom");
    const pleines = Array.from({ length: MAX_VUES }, (_, i) => ({ nom: `v${i}`, qs: "" }));
    expect(typeof ajouterVue(pleines, "encore", "")).toBe("string");
    const json = ecrireVuesEnregistrees('{"reservations.list":50}', v2 as never);
    expect(JSON.parse(json)).toEqual({
      "reservations.list": 50,
      planning_vues: [{ nom: "gymnases", qs: "site=3" }],
    });
    expect(lireVuesEnregistrees(json)).toEqual([{ nom: "gymnases", qs: "site=3" }]);
    expect(JSON.parse(ecrireVuesEnregistrees(json, retirerVue(v2 as never, "GYMNASES")))).toEqual({
      "reservations.list": 50,
    });
  });

  it("mémorise les filtres sans la date", () => {
    expect(qsVue(new URLSearchParams("date=2026-11-05&site=2&espace=4&espace=5&couleur="))).toBe(
      "site=2&espace=4&espace=5",
    );
  });
});

describe("dépôt d'un créneau", () => {
  const e = { ...cr("2026-11-10", "18:00", "20:00"), espaceId: 3 };

  it("garde les heures sur une case jour, prend l'heure d'une case heure", () => {
    expect(deplacementDepuisDepot(e, { jour: "2026-11-12", espaceId: 3 })).toEqual({
      date: "2026-11-12",
      heure_debut: "18:00",
      heure_fin: "20:00",
    });
    expect(deplacementDepuisDepot(e, { jour: "2026-11-10", espaceId: 3, heure: "09:00" })).toEqual({
      date: "2026-11-10",
      heure_debut: "09:00",
      heure_fin: "11:00",
    });
    expect(deplacementDepuisDepot(e, { jour: "2026-11-10", espaceId: 3, heure: "23:00" })).toEqual({
      date: "2026-11-10",
      heure_debut: "23:00",
      heure_fin: "01:00",
    });
  });

  it("refuse un autre espace, une date invalide ou un dépôt sans effet", () => {
    expect(deplacementDepuisDepot(e, { jour: "2026-11-12", espaceId: 4 })).toBeNull();
    expect(deplacementDepuisDepot(e, { jour: "demain", espaceId: 3 })).toBeNull();
    expect(deplacementDepuisDepot(e, { jour: "2026-11-10", espaceId: 3 })).toBeNull();
    expect(
      deplacementDepuisDepot(e, { jour: "2026-11-10", espaceId: 3, heure: "18:00" }),
    ).toBeNull();
  });
});

describe("vue liste", () => {
  it("fond créneaux et blocages par ordre chronologique", () => {
    const l = lignesListe(
      [
        {
          id: 1,
          reservationId: 9,
          numero: "R9",
          titre: "AG",
          status: "confirmee",
          qui: "Club",
          espaceId: 2,
          ...cr("2026-11-10", "18:00", "20:00"),
        },
        {
          id: 2,
          reservationId: 8,
          numero: "R8",
          titre: "Cours",
          status: "a_traiter",
          qui: "",
          espaceId: 1,
          ...cr("2026-11-10", "09:00", "10:00"),
        },
      ],
      [{ id: 5, espaceId: 1, motif: null, ...cr("2026-11-10", "12:00", "14:00") }],
    );
    expect(l.map((x) => [x.cle, x.titre])).toEqual([
      ["c2", "Cours"],
      ["b5", "Indisponible"],
      ["c1", "AG"],
    ]);
  });
});
