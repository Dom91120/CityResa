import { describe, expect, it } from "vitest";
import { parseYmdUtc } from "@/lib/date-utc";
import {
  etatPiecesAttendues,
  etatValidite,
  joursRestants,
  libelleValidite,
  pireEtat,
} from "@/lib/pieces";

const d = parseYmdUtc;
const TODAY = "2026-11-02";

describe("validité d'une pièce", () => {
  it("compte les jours restants, négatifs une fois expirée", () => {
    expect(joursRestants(d("2026-11-02"), TODAY)).toBe(0);
    expect(joursRestants(d("2026-12-02"), TODAY)).toBe(30);
    expect(joursRestants(d("2026-10-31"), TODAY)).toBe(-2);
  });

  it("classe valide / bientôt / expirée selon le seuil", () => {
    expect(etatValidite(null, TODAY, 30)).toBeNull();
    expect(etatValidite(d("2027-06-30"), TODAY, 30)).toBe("valide");
    expect(etatValidite(d("2026-12-02"), TODAY, 30)).toBe("bientot");
    expect(etatValidite(d("2026-12-03"), TODAY, 30)).toBe("valide");
    expect(etatValidite(d("2026-11-02"), TODAY, 30)).toBe("bientot");
    expect(etatValidite(d("2026-11-01"), TODAY, 30)).toBe("expiree");
  });

  it("libelle les trois états", () => {
    expect(libelleValidite(d("2026-10-31"), TODAY, 30)).toBe("Expirée le 31/10/2026");
    expect(libelleValidite(d("2026-11-02"), TODAY, 30)).toBe("Expire aujourd'hui");
    expect(libelleValidite(d("2026-11-03"), TODAY, 30)).toBe("Expire dans 1 jour (03/11/2026)");
    expect(libelleValidite(d("2026-11-20"), TODAY, 30)).toBe("Expire dans 18 jours (20/11/2026)");
    expect(libelleValidite(d("2027-08-31"), TODAY, 30)).toBe("Valide jusqu'au 31/08/2027");
  });
});

describe("pièces attendues", () => {
  it("signale les pièces manquantes et retient la validité la plus lointaine", () => {
    const etats = etatPiecesAttendues(
      "association",
      [
        { kind: "assurance", validUntil: d("2026-10-01") },
        { kind: "assurance", validUntil: d("2027-09-30") },
        { kind: "autre", validUntil: null },
      ],
      TODAY,
      30,
    );
    expect(etats.map((e) => [e.kind, e.etat])).toEqual([
      ["statuts", "manquante"],
      ["assurance", "valide"],
    ]);
    expect(etats[1].validUntil).toEqual(d("2027-09-30"));
  });

  it("une pièce sans date vaut « fournie » ; un type sans exigence ne demande rien", () => {
    expect(
      etatPiecesAttendues("entreprise", [{ kind: "assurance", validUntil: null }], TODAY, 30),
    ).toEqual([
      {
        kind: "assurance",
        libelle: "Attestation d'assurance responsabilité civile",
        etat: "fournie",
        validUntil: null,
      },
    ]);
    expect(etatPiecesAttendues("service_interne", [], TODAY, 30)).toEqual([]);
  });

  it("pireEtat : expirée l'emporte, puis bientôt, puis valide", () => {
    expect(pireEtat([], TODAY, 30)).toBeNull();
    expect(pireEtat([{ kind: "x", validUntil: null }], TODAY, 30)).toBeNull();
    expect(
      pireEtat(
        [
          { kind: "x", validUntil: d("2027-01-01") },
          { kind: "y", validUntil: d("2026-11-15") },
        ],
        TODAY,
        30,
      ),
    ).toBe("bientot");
    expect(
      pireEtat(
        [
          { kind: "x", validUntil: d("2026-11-15") },
          { kind: "y", validUntil: d("2026-01-01") },
        ],
        TODAY,
        30,
      ),
    ).toBe("expiree");
  });
});
