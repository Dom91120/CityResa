import { describe, expect, it } from "vitest";
import { estPdf, lienApercu, sourceApercu } from "./apercu-pdf";

describe("sourceApercu", () => {
  it("accepte une édition PDF de l'application et une pièce déposée", () => {
    expect(sourceApercu("/subventions/1/dossier.pdf")).toBe("/subventions/1/dossier.pdf");
    expect(sourceApercu("/planning/semaine.pdf?espace=3&date=2026-11-16")).toBe(
      "/planning/semaine.pdf?espace=3&date=2026-11-16",
    );
    expect(sourceApercu("/documents/42/view")).toBe("/documents/42/view");
    expect(sourceApercu("/paiements/7/pdf")).toBe("/paiements/7/pdf");
    expect(sourceApercu("/portail/mes-reservations/3/factures/7/pdf")).toBe(
      "/portail/mes-reservations/3/factures/7/pdf",
    );
  });

  it("refuse une adresse extérieure", () => {
    expect(sourceApercu("https://exemple.fr/a.pdf")).toBeNull();
    expect(sourceApercu("//exemple.fr/a.pdf")).toBeNull();
    expect(sourceApercu("/\\exemple.fr/a.pdf")).toBeNull();
  });

  it("refuse ce qui n'est pas un PDF de l'application", () => {
    expect(sourceApercu("/reservations/1")).toBeNull();
    expect(sourceApercu("/documents/42/download")).toBeNull();
    expect(sourceApercu("/a/../b.pdf")).toBeNull();
    expect(sourceApercu("/a.pdf#x")).toBeNull();
    expect(sourceApercu("/reservations/1?x=a.pdf")).toBeNull();
    expect(sourceApercu("")).toBeNull();
    expect(sourceApercu(null)).toBeNull();
  });
});

describe("lienApercu", () => {
  it("porte la source, le titre et le retour", () => {
    expect(lienApercu("/subventions/1/dossier.pdf", "Dossier S260001", "/subventions/1")).toBe(
      "/apercu?src=%2Fsubventions%2F1%2Fdossier.pdf&titre=Dossier+S260001&retour=%2Fsubventions%2F1",
    );
  });

  it("se passe de retour", () => {
    expect(lienApercu("/a.pdf", "A")).toBe("/apercu?src=%2Fa.pdf&titre=A");
  });

  it("mène à l'aperçu du portail depuis une page du portail", () => {
    expect(lienApercu("/documents/9/view", "Statuts", "/portail/mon-organisation")).toBe(
      "/portail/apercu?src=%2Fdocuments%2F9%2Fview&titre=Statuts&retour=%2Fportail%2Fmon-organisation",
    );
  });
});

describe("estPdf", () => {
  it("reconnaît un PDF à son extension, quelle que soit la casse", () => {
    expect(estPdf({ filename: "Statuts.PDF" })).toBe(true);
    expect(estPdf({ filename: "photo.jpg" })).toBe(false);
  });
});
