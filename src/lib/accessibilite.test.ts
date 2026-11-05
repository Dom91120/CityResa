import { describe, expect, it } from "vitest";
import {
  aDesMajeurs,
  analyserCouleur,
  auditer,
  contraste,
  type Instantane,
  phraseConformite,
  rapport,
  seuilContraste,
} from "@/lib/accessibilite";

const page = (extra: Partial<Instantane> = {}): Instantane => ({
  url: "/portail",
  lang: "fr",
  titre: "Catalogue",
  nbMain: 1,
  skipLink: true,
  titres: [
    { niveau: 1, texte: "Espaces" },
    { niveau: 2, texte: "Salles" },
  ],
  images: [{ src: "/a.png", alt: "" }],
  champs: [{ desc: "input#q", libelle: true }],
  liens: [{ href: "/portail", nom: "Accueil" }],
  boutons: [{ desc: "button.btn", nom: "Rechercher" }],
  idsDoublons: [],
  iframes: [],
  tabindexPositifs: [],
  textes: [
    { texte: "Bonjour", fg: "rgb(0, 0, 0)", bg: "rgb(255, 255, 255)", taille: 16, gras: false },
  ],
  ...extra,
});

describe("déclaration", () => {
  it("formule l'état de conformité", () => {
    expect(phraseConformite("non_evalue", null)).toContain("pas encore");
    expect(phraseConformite("partiellement_conforme", 72)).toBe(
      "Partiellement conforme : 72 % des critères du RGAA 4.1 sont respectés.",
    );
    expect(phraseConformite("totalement_conforme", null)).toBe("Totalement conforme.");
    expect(phraseConformite("inconnu", 50)).toContain("pas encore");
  });
});

describe("couleurs et contrastes", () => {
  it("lit rgb, rgba et hexadécimal", () => {
    expect(analyserCouleur("rgb(12, 34, 56)")).toEqual([12, 34, 56, 1]);
    expect(analyserCouleur("rgba(0, 0, 0, 0.5)")).toEqual([0, 0, 0, 0.5]);
    expect(analyserCouleur("#abc")).toEqual([170, 187, 204, 1]);
    expect(analyserCouleur("transparent")).toBeNull();
  });

  it("calcule le rapport WCAG et les seuils", () => {
    expect(contraste("rgb(0, 0, 0)", "rgb(255, 255, 255)")).toBe(21);
    expect(contraste("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contraste("rgba(0, 0, 0, 0.4)", "#fff")).toBeNull();
    expect(seuilContraste(16, false)).toBe(4.5);
    expect(seuilContraste(24, false)).toBe(3);
    expect(seuilContraste(19, true)).toBe(3);
  });
});

describe("audit", () => {
  it("ne signale rien sur une page correcte", () => {
    expect(auditer(page())).toEqual([]);
  });

  it("signale les manquements majeurs et mineurs", () => {
    const v = auditer(
      page({
        lang: null,
        titre: " ",
        nbMain: 0,
        skipLink: false,
        titres: [
          { niveau: 2, texte: "Sans h1" },
          { niveau: 4, texte: "Saut" },
        ],
        images: [{ src: "/logo.png", alt: null }],
        champs: [{ desc: "input[name=q]", libelle: false }],
        liens: [{ href: "/x", nom: " " }],
        boutons: [{ desc: "button.btn-icone", nom: "" }],
        idsDoublons: ["f-date"],
        iframes: [{ src: "/carte", title: null }],
        tabindexPositifs: ["a.menu"],
        textes: [{ texte: "Texte pâle", fg: "#999999", bg: "#ffffff", taille: 14, gras: false }],
      }),
    );
    const regles = v.map((x) => x.rgaa);
    expect(regles).toEqual([
      "8.3",
      "8.5",
      "12.6",
      "12.7",
      "9.1",
      "9.1",
      "1.1",
      "11.1",
      "6.1",
      "11.9",
      "8.2",
      "2.1",
      "12.1",
      "3.2",
    ]);
    expect(v.find((x) => x.rgaa === "3.2")?.elements[0]).toContain("#999999 sur #ffffff (2.85)");
    expect(v.filter((x) => x.gravite === "mineur").map((x) => x.rgaa)).toEqual([
      "12.7",
      "9.1",
      "8.2",
      "12.1",
    ]);
    expect(aDesMajeurs([{ violations: v }])).toBe(true);
  });

  it("tolère le texte large à 3:1 et les listes d'éléments sont bornées", () => {
    const grand = page({
      textes: [{ texte: "Titre", fg: "#777777", bg: "#ffffff", taille: 24, gras: false }],
    });
    expect(auditer(grand)).toEqual([]);
    const beaucoup = page({
      images: Array.from({ length: 20 }, (_, i) => ({ src: `/${i}.png`, alt: null })),
    });
    expect(auditer(beaucoup)[0].elements).toHaveLength(8);
  });

  it("rend un rapport lisible", () => {
    const r = rapport([
      { url: "/a", violations: [] },
      {
        url: "/b",
        violations: [
          {
            regle: "Image sans attribut alt.",
            rgaa: "1.1",
            gravite: "majeur",
            elements: ["/x.png"],
          },
        ],
      },
    ]);
    expect(r).toContain("✓ /a");
    expect(r).toContain("✗ /b — 1 manquement");
    expect(r).toContain("[majeur] RGAA 1.1 · Image sans attribut alt.");
    expect(r).toContain("      - /x.png");
    expect(r.trim().endsWith("1 manquement(s) majeur(s).")).toBe(true);
  });
});
