import { describe, expect, it } from "vitest";
import { lignesPdf, pdfSimple } from "./pdf-simple";

describe("lignesPdf", () => {
  it("coupe entre les mots, sans dépasser la largeur", () => {
    const lignes = lignesPdf("mot ".repeat(60).trim());
    expect(lignes.length).toBeGreaterThan(1);
    expect(lignes.every((l) => l.length <= 88)).toBe(true);
    expect(lignes.join(" ")).toBe("mot ".repeat(60).trim());
  });
});

describe("pdfSimple", () => {
  const pdf = pdfSimple("Procès-verbal (extrait)", [
    "Première ligne à 12 €.",
    "Second paragraphe.",
  ]);
  const texte = pdf.toString("latin1");

  it("produit un fichier PDF bien formé", () => {
    expect(texte.startsWith("%PDF-1.4\n")).toBe(true);
    expect(texte.trimEnd().endsWith("%%EOF")).toBe(true);
    // La table des références pointe sur le début de chaque objet.
    const debut = Number(/startxref\n(\d+)/.exec(texte)?.[1]);
    expect(texte.slice(debut, debut + 4)).toBe("xref");
    const positions = [...texte.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(positions).toHaveLength(6);
    positions.forEach((p, i) => {
      expect(texte.slice(p, p + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it("annonce la longueur exacte du contenu", () => {
    const m = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(texte);
    expect(Number(m?.[1])).toBe(m?.[2].length);
  });

  it("échappe les parenthèses et garde les accents", () => {
    expect(texte).toContain("(Procès-verbal \\(extrait\\)) Tj");
    expect(texte).toContain("Première ligne à 12 \u0080.");
  });

  it("ne dépend que du texte fourni", () => {
    expect(pdfSimple("A", ["b"]).equals(pdfSimple("A", ["b"]))).toBe(true);
  });
});
