import { describe, expect, it } from "vitest";
import type { Intervalle } from "@/lib/creneaux";
import { parisDateTimeToInstant } from "@/lib/paris-time";
import {
  aPartirDe,
  calculerDevis,
  type EntreeDevis,
  grillePour,
  type LigneTarif,
  prixCreneau,
  UNITE_LIBELLES,
} from "@/lib/tarification";

function cr(ymd: string, de: string, a: string, ymdFin = ymd): Intervalle {
  const startAt = parisDateTimeToInstant(ymd, de);
  const endAt = parisDateTimeToInstant(ymdFin, a);
  if (!startAt || !endAt) throw new Error("créneau de test invalide");
  return { startAt, endAt };
}
const t = (
  unite: string,
  montant: number,
  profilId: number | null = null,
  label?: string,
): LigneTarif => ({
  profilId,
  unite,
  montant,
  label,
});
const base: EntreeDevis = {
  tarifs: [],
  profilId: null,
  creneaux: [],
  options: [],
  materiels: [],
  tvaTaux: 0,
  caution: 0,
  gratuit: false,
};

describe("grillePour", () => {
  const tarifs = [t("heure", 25), t("journee", 150), t("heure", 0, 3), t("heure", 60, 5)];

  it("préfère les lignes propres au profil", () => {
    expect(grillePour(tarifs, 3)).toEqual([t("heure", 0, 3)]);
    expect(grillePour(tarifs, 5)).toEqual([t("heure", 60, 5)]);
  });

  it("se replie sur « tous profils » quand le profil n'a pas de ligne, ou sans profil", () => {
    expect(grillePour(tarifs, 9)).toEqual([t("heure", 25), t("journee", 150)]);
    expect(grillePour(tarifs, null)).toEqual([t("heure", 25), t("journee", 150)]);
  });

  it("rend une grille vide quand rien ne s'applique", () => {
    expect(grillePour([t("heure", 60, 5)], null)).toEqual([]);
  });
});

describe("prixCreneau", () => {
  it("facture l'heure à la demi-heure supérieure", () => {
    expect(prixCreneau([t("heure", 20)], cr("2026-11-04", "10:00", "12:20"))).toEqual({
      montant: 50,
      unite: "heure",
      quantite: 2.5,
      unitaire: 20,
    });
  });

  it("choisit l'unité la moins chère : une journée à 150 € vaut mieux que 8 h à 25 €", () => {
    const grille = [t("heure", 25), t("journee", 150)];
    expect(prixCreneau(grille, cr("2026-11-04", "09:00", "17:00"))?.unite).toBe("journee");
    expect(prixCreneau(grille, cr("2026-11-04", "09:00", "12:00"))).toMatchObject({
      unite: "heure",
      montant: 75,
    });
  });

  it("la demi-journée n'est proposée que jusqu'à 5 h", () => {
    const grille = [t("heure", 30), t("demi_journee", 100)];
    expect(prixCreneau(grille, cr("2026-11-04", "08:00", "13:00"))?.unite).toBe("demi_journee");
    expect(prixCreneau(grille, cr("2026-11-04", "08:00", "13:30"))?.unite).toBe("heure");
  });

  it("la soirée commence à 18 h (heure de Paris) et dure au plus 8 h", () => {
    const grille = [t("heure", 50), t("soiree", 120)];
    expect(prixCreneau(grille, cr("2026-11-04", "18:00", "23:00"))?.unite).toBe("soiree");
    expect(prixCreneau(grille, cr("2026-11-04", "17:30", "23:00"))?.unite).toBe("heure");
    expect(prixCreneau(grille, cr("2026-11-04", "18:00", "03:00", "2026-11-05"))?.unite).toBe(
      "heure",
    );
    // En été, 18 h de Paris reste 18 h (16 h UTC).
    expect(prixCreneau(grille, cr("2026-07-08", "18:00", "22:00"))?.unite).toBe("soiree");
  });

  it("le week-end s'applique le samedi et le dimanche de Paris", () => {
    const grille = [t("journee", 400), t("weekend", 300)];
    expect(prixCreneau(grille, cr("2026-11-07", "10:00", "18:00"))?.unite).toBe("weekend");
    expect(prixCreneau(grille, cr("2026-11-08", "10:00", "18:00"))?.unite).toBe("weekend");
    expect(prixCreneau(grille, cr("2026-11-06", "10:00", "18:00"))?.unite).toBe("journee");
    // Vendredi 23 h 30 UTC = samedi 0 h 30 à Paris.
    expect(
      prixCreneau(grille, {
        startAt: new Date("2026-11-06T23:30:00Z"),
        endAt: new Date("2026-11-07T03:00:00Z"),
      })?.unite,
    ).toBe("weekend");
  });

  it("une journée multi-jours compte autant de journées que de tranches de 24 h entamées", () => {
    expect(
      prixCreneau([t("journee", 100)], cr("2026-11-07", "09:00", "15:00", "2026-11-08")),
    ).toEqual({
      montant: 200,
      unite: "journee",
      quantite: 2,
      unitaire: 100,
    });
  });

  it("ignore le forfait et rend null sans candidat", () => {
    expect(prixCreneau([t("forfait", 100)], cr("2026-11-04", "10:00", "12:00"))).toBeNull();
    expect(prixCreneau([], cr("2026-11-04", "10:00", "12:00"))).toBeNull();
    expect(prixCreneau([t("demi_journee", 100)], cr("2026-11-04", "08:00", "18:00"))).toBeNull();
  });
});

describe("calculerDevis — espace", () => {
  it("additionne le prix de chaque créneau, en numérotant les lignes", () => {
    const d = calculerDevis({
      ...base,
      tarifs: [t("heure", 20)],
      creneaux: [cr("2026-11-04", "10:00", "12:00"), cr("2026-11-11", "10:00", "13:00")],
    });
    expect(d.lignes.map((l) => [l.libelle, l.montant])).toEqual([
      ["Créneau 1 · 2 h", 40],
      ["Créneau 2 · 3 h", 60],
    ]);
    expect(d.espace).toBe(100);
    expect(d.ht).toBe(100);
    expect(d.ttc).toBe(100);
    expect(d.gratuit).toBe(false);
  });

  it("un créneau unique n'est pas numéroté et porte le libellé de son unité", () => {
    const d = calculerDevis({
      ...base,
      tarifs: [t("journee", 150)],
      creneaux: [cr("2026-11-04", "09:00", "18:00")],
    });
    expect(d.lignes[0].libelle).toBe(`Créneau · ${UNITE_LIBELLES.journee}`);
  });

  it("remplace les lignes horaires par le forfait quand il est moins cher", () => {
    const d = calculerDevis({
      ...base,
      tarifs: [t("heure", 25), t("forfait", 100, null, "Forfait association")],
      creneaux: [cr("2026-11-04", "10:00", "13:00"), cr("2026-11-11", "10:00", "13:00")],
    });
    expect(d.lignes).toEqual([
      { libelle: "Forfait association", quantite: 1, unitaire: 100, montant: 100, type: "espace" },
    ]);
    expect(d.espace).toBe(100);
  });

  it("garde les lignes horaires quand elles sont moins chères que le forfait", () => {
    const d = calculerDevis({
      ...base,
      tarifs: [t("heure", 25), t("forfait", 100)],
      creneaux: [cr("2026-11-04", "10:00", "12:00")],
    });
    expect(d.espace).toBe(50);
    expect(d.lignes).toHaveLength(1);
    expect(d.lignes[0].libelle).toBe("Créneau · 2 h");
  });

  it("un forfait seul vaut pour toute la réservation", () => {
    const d = calculerDevis({
      ...base,
      tarifs: [t("forfait", 300)],
      creneaux: [cr("2026-11-04", "10:00", "12:00"), cr("2026-11-05", "10:00", "12:00")],
    });
    expect(d.lignes).toEqual([
      { libelle: "Forfait", quantite: 1, unitaire: 300, montant: 300, type: "espace" },
    ]);
  });

  it("sans grille applicable, l'espace ne coûte rien", () => {
    const d = calculerDevis({
      ...base,
      tarifs: [],
      creneaux: [cr("2026-11-04", "10:00", "12:00")],
    });
    expect(d.espace).toBe(0);
    expect(d.lignes).toEqual([]);
  });

  it("utilise la grille du profil, sinon celle de tous les profils", () => {
    const tarifs = [t("heure", 25), t("heure", 0, 3)];
    const creneaux = [cr("2026-11-04", "10:00", "12:00")];
    expect(calculerDevis({ ...base, tarifs, creneaux, profilId: 3 }).espace).toBe(0);
    expect(calculerDevis({ ...base, tarifs, creneaux, profilId: 4 }).espace).toBe(50);
  });
});

describe("calculerDevis — options et matériel", () => {
  const creneaux = [cr("2026-11-04", "10:00", "13:00"), cr("2026-11-05", "10:00", "12:30")];

  it("option forfait : une fois quelle que soit la quantité ; option à l'heure : sur les heures totales (à la demi-heure) ; option à l'unité : par quantité", () => {
    const d = calculerDevis({
      ...base,
      creneaux,
      options: [
        { label: "Ménage", montant: 80, unite: "forfait", quantite: 3 },
        { label: "Régisseur", montant: 35, unite: "heure", quantite: 1 },
        { label: "Tables", montant: 1.5, unite: "unite", quantite: 10 },
      ],
    });
    expect(d.lignes.filter((l) => l.type === "option")).toEqual([
      { libelle: "Ménage", quantite: 1, unitaire: 80, montant: 80, type: "option" },
      { libelle: "Régisseur", quantite: 5.5, unitaire: 35, montant: 192.5, type: "option" },
      { libelle: "Tables", quantite: 10, unitaire: 1.5, montant: 15, type: "option" },
    ]);
    expect(d.options).toBe(287.5);
  });

  it("une quantité nulle ou négative vaut 1", () => {
    const d = calculerDevis({
      ...base,
      creneaux,
      options: [{ label: "Sono", montant: 40, unite: "unite", quantite: 0 }],
    });
    expect(d.lignes[0]).toMatchObject({ quantite: 1, montant: 40 });
  });

  it("matériel : par unité, par jour (nombre de créneaux par défaut), forfait ou gratuit", () => {
    const d = calculerDevis({
      ...base,
      creneaux,
      materiels: [
        { label: "Chaises", montant: 0.5, unite: "unite", quantite: 100 },
        { label: "Vidéoprojecteur", montant: 25, unite: "jour", quantite: 1 },
        { label: "Barnum", montant: 30, unite: "jour", quantite: 2, jours: 3 },
        { label: "Sono", montant: 40, unite: "forfait", quantite: 2 },
        { label: "Grilles", montant: 0, unite: "gratuit", quantite: 20 },
      ],
    });
    expect(d.lignes.filter((l) => l.type === "materiel").map((l) => l.montant)).toEqual([
      50, 50, 180, 40, 0,
    ]);
    expect(d.materiel).toBe(320);
  });
});

describe("calculerDevis — totaux", () => {
  it("applique la TVA et l'acompte sur le TTC, arrondis au centime", () => {
    const d = calculerDevis({
      ...base,
      tarifs: [t("heure", 33.33)],
      creneaux: [cr("2026-11-04", "10:00", "13:00")],
      tvaTaux: 20,
      acomptePct: 30,
      caution: 500.004,
    });
    expect(d.ht).toBe(99.99);
    expect(d.tva).toBe(20);
    expect(d.ttc).toBe(119.99);
    expect(d.acompte).toBe(36);
    expect(d.caution).toBe(500);
  });

  it("sans pourcentage d'acompte, l'acompte est nul", () => {
    const d = calculerDevis({
      ...base,
      tarifs: [t("heure", 10)],
      creneaux: [cr("2026-11-04", "10:00", "12:00")],
    });
    expect(d.acompte).toBe(0);
    expect(d.tva).toBe(0);
  });

  it("la gratuité met tout à zéro (espace, options, matériel, caution) mais garde les lignes", () => {
    const d = calculerDevis({
      ...base,
      tarifs: [t("heure", 25)],
      creneaux: [cr("2026-11-04", "10:00", "12:00")],
      options: [{ label: "Ménage", montant: 80, unite: "forfait", quantite: 1 }],
      materiels: [{ label: "Tables", montant: 3, unite: "unite", quantite: 10 }],
      tvaTaux: 20,
      caution: 400,
      acomptePct: 30,
      gratuit: true,
    });
    expect(d.gratuit).toBe(true);
    expect([d.espace, d.options, d.materiel, d.ht, d.tva, d.ttc, d.acompte, d.caution]).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(d.lignes.map((l) => l.type)).toEqual(["option", "materiel"]);
  });
});

describe("aPartirDe", () => {
  it("décrit le tarif le plus bas de la grille applicable", () => {
    expect(aPartirDe([])).toBe("Sur demande");
    expect(aPartirDe([t("heure", 25), t("journee", 150)])).toBe("À partir de 25 €/h");
    expect(aPartirDe([t("journee", 150.5)])).toBe("À partir de 150,50 € / journée");
    expect(aPartirDe([t("weekend", 300), t("journee", 200)])).toBe("À partir de 200 € / journée");
    expect(aPartirDe([t("journee", 0), t("heure", 10)])).toBe("Gratuit");
  });

  it("tient compte du profil", () => {
    const tarifs = [t("heure", 25), t("heure", 0, 3)];
    expect(aPartirDe(tarifs, 3)).toBe("Gratuit");
    expect(aPartirDe(tarifs, 4)).toBe("À partir de 25 €/h");
    expect(aPartirDe([t("heure", 60, 5)], null)).toBe("Sur demande");
  });
});
