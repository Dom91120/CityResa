import { describe, expect, it } from "vitest";
import {
  dateCourte,
  dateHeure,
  dateJourEntier,
  dateJourMois,
  dateLongue,
  dateMoyenne,
  delai,
  depuis,
  diffJours,
  duree,
  heure,
  initiales,
  isoParis,
  libelleAction,
  moisAnnee,
  montant,
  montantAuCentime,
  montantOuGratuit,
  plage,
  plageHoraire,
  pluriel,
  tailleLabel,
} from "@/lib/libelles";

// Dimanche 8 novembre 2026, 8 h 30 à Paris (heure d'hiver).
const hiver = new Date("2026-11-08T07:30:00Z");
// Mercredi 15 juillet 2026, 19 h 30 à Paris (heure d'été).
const ete = new Date("2026-07-15T17:30:00Z");

describe("dates (heure de Paris)", () => {
  it("dateCourte / dateLongue / dateMoyenne / dateJourMois", () => {
    expect(dateCourte(hiver)).toBe("08/11/2026");
    expect(dateLongue(hiver)).toBe("dimanche 8 novembre 2026");
    expect(dateMoyenne(hiver)).toBe("Dim. 08/11/2026");
    expect(dateJourMois(hiver)).toBe("8/11");
    expect(dateJourEntier(hiver)).toBe("Dimanche 08/11/2026");
    expect(dateJourEntier(null)).toBe("");
    expect(dateLongue(ete)).toBe("mercredi 15 juillet 2026");
  });

  it("heure : en hiver 17 h 30 UTC donne 18h30, en été 19h30", () => {
    expect(heure(new Date("2026-01-15T17:30:00Z"))).toBe("18h30");
    expect(heure(ete)).toBe("19h30");
    expect(heure(new Date("2026-11-08T08:05:00Z"))).toBe("9h05");
  });

  it("le jour change à minuit de Paris, pas à minuit UTC", () => {
    expect(dateCourte(new Date("2026-07-15T22:30:00Z"))).toBe("16/07/2026");
    expect(dateCourte(new Date("2026-01-15T23:30:00Z"))).toBe("16/01/2026");
    expect(heure(new Date("2026-01-15T23:30:00Z"))).toBe("0h30");
  });

  it("dateHeure, plageHoraire et plage sur un même jour", () => {
    const fin = new Date("2026-11-08T18:00:00Z");
    expect(dateHeure(hiver)).toBe("08/11/2026 à 8h30");
    expect(plageHoraire(hiver, fin)).toBe("8h30 - 19h00");
    expect(plage(hiver, fin)).toBe("Dim. 08/11/2026 · 8h30 - 19h00");
  });

  it("plage sur plusieurs jours", () => {
    const debut = new Date("2026-11-07T08:00:00Z");
    const fin = new Date("2026-11-08T17:00:00Z");
    expect(plage(debut, fin)).toBe("du Sam. 07/11/2026 à 9h00 au Dim. 08/11/2026 à 18h00");
  });

  it("moisAnnee", () => {
    expect(moisAnnee(hiver)).toBe("Novembre 2026");
    expect(moisAnnee(new Date("2026-01-31T23:30:00Z"))).toBe("Février 2026");
  });

  it("tolère l'absence de date", () => {
    expect(dateCourte(null)).toBe("");
    expect(dateLongue(undefined)).toBe("");
    expect(dateMoyenne(null)).toBe("");
    expect(heure(null)).toBe("");
    expect(dateHeure(null)).toBe("");
    expect(dateJourMois(null)).toBe("");
  });
});

describe("montant", () => {
  it("écrit les montants à la française, centimes seulement s'il y en a", () => {
    expect(montant(1191.64)).toBe("1 191,64 €");
    expect(montant(32000)).toBe("32 000 €");
    expect(montant(1234567.891)).toBe("1 234 567,89 €");
    expect(montant(0)).toBe("0 €");
    expect(montant(0.5)).toBe("0,50 €");
    expect(montant(12.004)).toBe("12 €");
  });

  it("gère le signe, l'unité et les chaînes", () => {
    expect(montant(-45)).toBe("-45 €");
    expect(montant(-1250.5)).toBe("-1 250,50 €");
    expect(montant(12.5, "")).toBe("12,50");
    expect(montant(99, "%")).toBe("99 %");
    expect(montant("12,5")).toBe("12,50 €");
    expect(montant("abc")).toBe("abc");
  });

  it("rend une chaîne vide sans valeur", () => {
    expect(montant(null)).toBe("");
    expect(montant(undefined)).toBe("");
    expect(montant("")).toBe("");
  });

  it("montantOuGratuit", () => {
    expect(montantOuGratuit(0)).toBe("Gratuit");
    expect(montantOuGratuit(null)).toBe("Gratuit");
    expect(montantOuGratuit(80)).toBe("80 €");
  });
});

describe("duree", () => {
  it("minutes, heures, jours", () => {
    expect(duree(0)).toBe("0 min");
    expect(duree(45)).toBe("45 min");
    expect(duree(60)).toBe("1 h");
    expect(duree(90)).toBe("1 h 30");
    expect(duree(150)).toBe("2 h 30");
    expect(duree(1440)).toBe("1 j");
    expect(duree(1680)).toBe("1 j 4 h");
  });

  it("arrondit et ignore les minutes au-delà d'un jour", () => {
    expect(duree(89.6)).toBe("1 h 30");
    expect(duree(1450)).toBe("1 j");
    expect(duree(-10)).toBe("0 min");
  });
});

describe("délais", () => {
  const maintenant = new Date("2026-11-01T10:00:00Z"); // dimanche 1er novembre, 11 h à Paris

  it("diffJours compte des jours calendaires de Paris", () => {
    expect(diffJours(new Date("2026-11-01T22:00:00Z"), maintenant)).toBe(0);
    // 23 h 30 UTC le 1er = le 2 à Paris.
    expect(diffJours(new Date("2026-11-01T23:30:00Z"), maintenant)).toBe(1);
    expect(diffJours(new Date("2026-10-27T10:00:00Z"), maintenant)).toBe(-5);
  });

  it("delai : hier, aujourd'hui, demain, dans n j, il y a n j", () => {
    expect(delai(new Date("2026-11-01T20:00:00Z"), maintenant)).toBe("aujourd'hui");
    expect(delai(new Date("2026-11-02T06:00:00Z"), maintenant)).toBe("demain");
    expect(delai(new Date("2026-11-13T06:00:00Z"), maintenant)).toBe("dans 12 j");
    expect(delai(new Date("2026-10-31T06:00:00Z"), maintenant)).toBe("hier");
    expect(delai(new Date("2026-10-27T06:00:00Z"), maintenant)).toBe("il y a 5 j");
    expect(delai(null)).toBe("");
  });

  it("depuis : à l'instant, minutes, heures, hier, jours, puis la date", () => {
    const il_y_a = (s: number) => new Date(maintenant.getTime() - s * 1000);
    expect(depuis(il_y_a(30), maintenant)).toBe("à l'instant");
    expect(depuis(il_y_a(10 * 60), maintenant)).toBe("il y a 10 min");
    expect(depuis(il_y_a(3 * 3600 + 59), maintenant)).toBe("il y a 3 h");
    expect(depuis(il_y_a(26 * 3600), maintenant)).toBe("hier");
    expect(depuis(il_y_a(3 * 86400), maintenant)).toBe("il y a 3 j");
    expect(depuis(il_y_a(10 * 86400), maintenant)).toBe("le 22/10/2026");
  });
});

describe("pluriel / initiales / tailleLabel", () => {
  it("pluriel", () => {
    expect(pluriel(0, "réservation")).toBe("0 réservation");
    expect(pluriel(1, "réservation")).toBe("1 réservation");
    expect(pluriel(2, "réservation")).toBe("2 réservations");
    expect(pluriel(3, "cheval", "chevaux")).toBe("3 chevaux");
  });

  it("initiales", () => {
    expect(initiales("Jean-Marc Hugo")).toBe("JH");
    expect(initiales("Anne Marie de la Tour")).toBe("AT");
    expect(initiales("sophie")).toBe("SO");
    expect(initiales("  ")).toBe("?");
  });

  it("tailleLabel", () => {
    expect(tailleLabel(500)).toBe("500 o");
    expect(tailleLabel(2048)).toBe("2 Ko");
    expect(tailleLabel(1258291)).toBe("1,2 Mo");
    expect(tailleLabel(null)).toBe("0 o");
  });
});

describe("isoParis", () => {
  it("donne date et heure de Paris pour un champ de formulaire", () => {
    expect(isoParis(ete)).toEqual({ date: "2026-07-15", time: "19:30" });
    expect(isoParis(new Date("2026-01-15T23:30:00Z"))).toEqual({
      date: "2026-01-16",
      time: "00:30",
    });
    expect(isoParis(hiver)).toEqual({ date: "2026-11-08", time: "08:30" });
  });
});

describe("libelleAction", () => {
  it("rétablit les accents et la majuscule", () => {
    expect(libelleAction("modification creneaux")).toBe("Modification créneaux");
    expect(libelleAction("constat presence")).toBe("Constat présence");
    expect(libelleAction("depot voeu")).toBe("Dépôt vœu");
    expect(libelleAction("purge rgpd")).toBe("Purge RGPD");
  });
  it("laisse les mots inconnus tels quels", () => {
    expect(libelleAction("connexion")).toBe("Connexion");
    expect(libelleAction("caution retenue")).toBe("Caution retenue");
  });
});

describe("montantAuCentime", () => {
  it("garde toujours deux décimales", () => {
    expect(montantAuCentime(650)).toBe("650,00 €");
    expect(montantAuCentime(85.5)).toBe("85,50 €");
    expect(montantAuCentime(1141)).toBe("1 141,00 €");
    expect(montantAuCentime(-12.345)).toBe("-12,35 €");
    expect(montantAuCentime(null)).toBe("");
  });
});
