import { describe, expect, it } from "vitest";
import { parisDateTimeToInstant } from "@/lib/paris-time";
import {
  ajouterVue,
  couleurEvt,
  deplacementDepuisDepot,
  ecrireVuesEnregistrees,
  filtrerEvts,
  legende,
  lignesExport,
  lignesListe,
  lireCouleur,
  lireFiltresEvts,
  lireSecteur,
  lireVuesEnregistrees,
  MAX_VUES,
  nbFiltresEvts,
  qsVue,
  resumeFiltres,
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
    expect(
      qsVue(new URLSearchParams("date=2026-11-05&au=2026-11-20&site=2&espace=4&espace=5&couleur=")),
    ).toBe("site=2&espace=4&espace=5");
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

describe("filtres des créneaux", () => {
  const evts = [
    {
      status: "confirmee",
      typeUsager: "association",
      qui: "Judo Club Châtillon",
      titre: "Entraînement",
      numero: "R-2026-0001",
    },
    {
      status: "a_traiter",
      typeUsager: null,
      qui: "Léa Martin",
      titre: "Anniversaire",
      numero: "R-2026-0002",
    },
    {
      status: "acceptee",
      typeUsager: "entreprise",
      qui: "Atelier Dupré",
      titre: "Séminaire",
      numero: "R-2026-0003",
    },
  ];
  const tout = { statuts: [], types: [], q: "" };

  it("lit l'URL en écartant les valeurs inconnues", () => {
    expect(lireFiltresEvts({})).toEqual(tout);
    expect(
      lireFiltresEvts({ statut: ["confirmee", "annulee", "x"], type: "association", q: " judo " }),
    ).toEqual({ statuts: ["confirmee"], types: ["association"], q: "judo" });
    expect(lireFiltresEvts({ type: ["entreprise", "martien"] }).types).toEqual(["entreprise"]);
    expect(lireSecteur("sport")).toBe("sport");
    expect(lireSecteur(["salle", "sport"])).toBe("salle");
    expect(lireSecteur("piscine")).toBe("");
    expect(lireSecteur(undefined)).toBe("");
  });

  it("compte les filtres actifs", () => {
    expect(nbFiltresEvts(tout)).toBe(0);
    expect(nbFiltresEvts({ statuts: ["confirmee", "signee"], types: ["autre"], q: "a" })).toBe(3);
  });

  it("retient par statut, par type d'usager et par recherche", () => {
    expect(filtrerEvts(evts, tout)).toHaveLength(3);
    expect(filtrerEvts(evts, { ...tout, statuts: ["confirmee", "acceptee"] })).toHaveLength(2);
    // Sans organisation : un particulier.
    expect(filtrerEvts(evts, { ...tout, types: ["particulier"] }).map((e) => e.qui)).toEqual([
      "Léa Martin",
    ]);
    // Casse et accents ignorés ; tous les mots sont exigés ; le numéro et le titre comptent.
    expect(filtrerEvts(evts, { ...tout, q: "chatillon JUDO" })).toHaveLength(1);
    expect(filtrerEvts(evts, { ...tout, q: "judo seminaire" })).toHaveLength(0);
    expect(filtrerEvts(evts, { ...tout, q: "0003" })[0]?.qui).toBe("Atelier Dupré");
    expect(filtrerEvts(evts, { statuts: ["a_traiter"], types: ["association"], q: "" })).toEqual(
      [],
    );
  });

  it("résume les filtres en clair", () => {
    expect(resumeFiltres(tout)).toBe("");
    expect(
      resumeFiltres(
        { statuts: ["confirmee"], types: ["association", "entreprise"], q: "judo" },
        "sport",
      ),
    ).toBe(
      "Secteur : Sports · Statut : Confirmée · Usagers : Association, Entreprise · Recherche : « judo »",
    );
  });
});

describe("export", () => {
  it("met les lignes de la liste en clair, avec de vraies dates", () => {
    const lignes = lignesListe(
      [
        {
          id: 1,
          reservationId: 7,
          numero: "RES-1",
          titre: "Gala",
          status: "confirmee",
          qui: "Judo Club",
          typeUsager: "association",
          espaceId: 3,
          startAt: parisDateTimeToInstant("2026-11-21", "20:00") as Date,
          endAt: parisDateTimeToInstant("2026-11-22", "01:30") as Date,
        },
        {
          id: 2,
          reservationId: 8,
          numero: "RES-2",
          titre: "Anniversaire",
          status: "a_traiter",
          qui: "Léa Martin",
          espaceId: 3,
          startAt: parisDateTimeToInstant("2026-11-22", "14:00") as Date,
          endAt: parisDateTimeToInstant("2026-11-23", "00:00") as Date,
        },
      ],
      [{ id: 5, espaceId: 9, motif: null, ...cr("2026-11-23", "08:00", "12:00") }],
    );
    const x = lignesExport(lignes, new Map([[3, { name: "Salle des fêtes", site: "Mairie" }]]));
    expect(x[0]).toMatchObject({
      debut: "20:00",
      fin: "01:30",
      site: "Mairie",
      espace: "Salle des fêtes",
      dossier: "RES-1",
      typeUsager: "Association",
      statut: "Confirmée",
    });
    expect(x[0].date.toISOString()).toBe("2026-11-21T00:00:00.000Z");
    expect(x[0].jusquau?.toISOString()).toBe("2026-11-22T00:00:00.000Z");
    // Une fin à minuit pile reste sur le jour du créneau ; sans organisation, un particulier.
    expect(x[1].jusquau).toBeNull();
    expect(x[1].fin).toBe("00:00");
    expect(x[1].typeUsager).toBe("Particulier");
    // Un blocage, sur un espace hors de la sélection.
    expect(x[2]).toMatchObject({ statut: "Bloqué", objet: "Indisponible", espace: "", usager: "" });
  });
});
