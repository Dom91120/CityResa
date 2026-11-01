import { describe, expect, it } from "vitest";
import {
  champ,
  champOuNull,
  coche,
  emailValide,
  idOuNull,
  ids,
  isoDate,
  parseDate,
  parseFloat_,
  parseInt_,
  slugifier,
} from "@/lib/forms-util";

describe("parseDate", () => {
  it("lit une date ISO en minuit UTC", () => {
    expect(parseDate("2026-11-08")?.toISOString()).toBe("2026-11-08T00:00:00.000Z");
    expect(parseDate(" 2026-02-28 ")?.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("refuse les dates inexistantes et les autres formats", () => {
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("2026-13-01")).toBeNull();
    expect(parseDate("08/11/2026")).toBeNull();
    expect(parseDate("2026-11-8")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate(20261108)).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});

describe("parseInt_", () => {
  it("lit un entier, avec signe", () => {
    expect(parseInt_("12")).toBe(12);
    expect(parseInt_(" 12 ")).toBe(12);
    expect(parseInt_("+7")).toBe(7);
    expect(parseInt_("-3")).toBe(-3);
    expect(parseInt_(42)).toBe(42);
  });

  it("rend la valeur par défaut quand ce n'est pas un entier", () => {
    expect(parseInt_("abc")).toBeNull();
    expect(parseInt_("abc", 5)).toBe(5);
    expect(parseInt_("12.5")).toBeNull();
    expect(parseInt_("")).toBeNull();
    expect(parseInt_(undefined, 0)).toBe(0);
  });

  it("borne au minimum", () => {
    expect(parseInt_("-3", null, 0)).toBe(0);
    expect(parseInt_("5", null, 10)).toBe(10);
    expect(parseInt_("15", null, 10)).toBe(15);
  });
});

describe("parseFloat_", () => {
  it("lit un décimal à la française ou à l'anglaise", () => {
    expect(parseFloat_("9 999 999,99")).toBe(9999999.99);
    expect(parseFloat_("1 234,5 €")).toBe(1234.5);
    expect(parseFloat_("1.234,56")).toBe(1234.56);
    expect(parseFloat_("12.5")).toBe(12.5);
    expect(parseFloat_("12,5")).toBe(12.5);
    expect(parseFloat_("-0,5")).toBe(-0.5);
    expect(parseFloat_(7)).toBe(7);
  });

  it("rend la valeur par défaut sinon", () => {
    expect(parseFloat_("abc")).toBeNull();
    expect(parseFloat_("", 0)).toBe(0);
    expect(parseFloat_(null, 3)).toBe(3);
    expect(parseFloat_(undefined)).toBeNull();
    expect(parseFloat_("Infinity")).toBeNull();
  });
});

describe("champs d'un FormData", () => {
  const fd = new FormData();
  fd.append("nom", "  Salle des fêtes ");
  fd.append("vide", "   ");
  fd.append("ok", "on");
  fd.append("un", "1");
  fd.append("vrai", "true");
  fd.append("non", "off");
  fd.append("id", "12");
  fd.append("zero", "0");
  fd.append("negatif", "-4");
  fd.append("equip", "3");
  fd.append("equip", "x");
  fd.append("equip", "0");
  fd.append("equip", "7");

  it("champ et champOuNull nettoient la saisie", () => {
    expect(champ(fd, "nom")).toBe("Salle des fêtes");
    expect(champ(fd, "absent")).toBe("");
    expect(champ(fd, "vide")).toBe("");
    expect(champOuNull(fd, "nom")).toBe("Salle des fêtes");
    expect(champOuNull(fd, "vide")).toBeNull();
    expect(champOuNull(fd, "absent")).toBeNull();
  });

  it("coche accepte on, 1 et true", () => {
    expect(coche(fd, "ok")).toBe(true);
    expect(coche(fd, "un")).toBe(true);
    expect(coche(fd, "vrai")).toBe(true);
    expect(coche(fd, "non")).toBe(false);
    expect(coche(fd, "absent")).toBe(false);
  });

  it("idOuNull ne garde qu'un identifiant strictement positif", () => {
    expect(idOuNull(fd, "id")).toBe(12);
    expect(idOuNull(fd, "zero")).toBeNull();
    expect(idOuNull(fd, "negatif")).toBeNull();
    expect(idOuNull(fd, "nom")).toBeNull();
    expect(idOuNull(fd, "absent")).toBeNull();
  });

  it("ids lit un champ multiple et écarte le reste", () => {
    expect(ids(fd, "equip")).toEqual([3, 7]);
    expect(ids(fd, "absent")).toEqual([]);
  });
});

describe("isoDate", () => {
  it("prépare un <input type=date>", () => {
    expect(isoDate(new Date("2026-11-08T00:00:00.000Z"))).toBe("2026-11-08");
    expect(isoDate(null)).toBe("");
    expect(isoDate(undefined)).toBe("");
  });
});

describe("slugifier", () => {
  it("enlève accents, ponctuation et espaces", () => {
    expect(slugifier("Salle des Fêtes – Côté scène")).toBe("salle-des-fetes-cote-scene");
    expect(slugifier("  Éléphant  ")).toBe("elephant");
    expect(slugifier("Gymnase n°2 (annexe)")).toBe("gymnase-n-2-annexe");
    expect(slugifier("---")).toBe("");
  });

  it("tronque à 120 caractères", () => {
    expect(slugifier("a".repeat(200))).toHaveLength(120);
  });
});

describe("emailValide", () => {
  it("accepte une adresse plausible et refuse le reste", () => {
    expect(emailValide("nadia.rahmani@exemple.fr")).toBe(true);
    expect(emailValide(" x@y.com ")).toBe(true);
    expect(emailValide("a@b")).toBe(false);
    expect(emailValide("a b@c.fr")).toBe(false);
    expect(emailValide("a@c.f")).toBe(false);
    expect(emailValide("")).toBe(false);
  });
});
