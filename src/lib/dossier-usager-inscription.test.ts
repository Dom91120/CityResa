import { describe, expect, it } from "vitest";
import { communeDeLAdresse, controlerInscription, reglesInscription } from "./dossier-usager";

describe("communeDeLAdresse", () => {
  it("tire le code postal et la ville (capitales, sans accents)", () => {
    expect(communeDeLAdresse("1 place de la Libération, 92320 Châtillon")).toEqual({
      codePostal: "92320",
      ville: "CHATILLON",
    });
    expect(communeDeLAdresse("2 rue X, 92260 Fontenay-aux-Roses")).toEqual({
      codePostal: "92260",
      ville: "FONTENAY-AUX-ROSES",
    });
  });
  it("renvoie null sans code postal suivi d'une ville", () => {
    expect(communeDeLAdresse("")).toBeNull();
    expect(communeDeLAdresse("Mairie de Châtillon")).toBeNull();
    expect(communeDeLAdresse("Châtillon 92320")).toBeNull();
  });
});

const visibles = (type: string) =>
  Object.entries(reglesInscription(type))
    .filter(([, r]) => r.visible)
    .map(([c]) => c);
const requis = (type: string) =>
  Object.entries(reglesInscription(type))
    .filter(([, r]) => r.requis)
    .map(([c]) => c);

describe("reglesInscription", () => {
  it("association : RNA et date d'AG affichés, président et AG obligatoires", () => {
    expect(visibles("association")).toContain("rna");
    expect(visibles("association")).toContain("legal_appointed_at");
    expect(requis("association")).toEqual([
      "phone",
      "org_name",
      "address",
      "postal_code",
      "city",
      "legal_first_name",
      "legal_last_name",
      "legal_appointed_at",
    ]);
    expect(reglesInscription("association").org_name.libelle).toBe("Nom de l'association");
  });

  it("entreprise : SIRET et dirigeant obligatoires, ni RNA ni AG", () => {
    expect(visibles("entreprise")).not.toContain("rna");
    expect(visibles("entreprise")).not.toContain("legal_appointed_at");
    expect(requis("entreprise")).toContain("siret");
    expect(requis("entreprise")).toContain("legal_last_name");
    expect(reglesInscription("entreprise").org_name.libelle).toBe("Raison sociale");
  });

  it("particulier : ses seules coordonnées", () => {
    expect(visibles("particulier")).toEqual(["phone", "address", "postal_code", "city"]);
    expect(requis("particulier")).toEqual(["phone", "address", "postal_code", "city"]);
  });

  it("autre : organisation obligatoire, représentant et SIRET facultatifs", () => {
    expect(visibles("autre")).toContain("legal_first_name");
    expect(visibles("autre")).not.toContain("rna");
    expect(requis("autre")).toEqual(["phone", "org_name", "address", "postal_code", "city"]);
  });
});

describe("controlerInscription", () => {
  it("vide les champs sans objet pour le type", () => {
    const { valeurs, manques } = controlerInscription("entreprise", {
      phone: "0601020304",
      org_name: "Boulangerie Martin",
      address: "1 rue de la Mairie",
      postal_code: "92320",
      city: "Châtillon",
      siret: "12345678900011",
      rna: "W921000000",
      legal_first_name: "Paul",
      legal_last_name: "Martin",
      legal_appointed_at: new Date("2025-01-01"),
    });
    expect(manques).toEqual([]);
    expect(valeurs.rna).toBeNull();
    expect(valeurs.legal_appointed_at).toBeNull();
    expect(valeurs.siret).toBe("12345678900011");
  });

  it("liste les champs obligatoires manquants avec leur libellé", () => {
    const { manques } = controlerInscription("association", {
      phone: "0601020304",
      org_name: "Châtillon Basket Club",
      address: "15 rue des Pierrelais",
      postal_code: "92320",
      city: "Châtillon",
      legal_first_name: " ",
      legal_last_name: null,
      legal_appointed_at: null,
    });
    expect(manques).toEqual([
      "Prénom du président",
      "Nom du président",
      "Date de l'AG de nomination",
    ]);
  });

  it("un particulier n'a pas d'organisation à nommer", () => {
    const { valeurs, manques } = controlerInscription("particulier", {
      phone: "0601020304",
      org_name: "Ignoré",
      address: "3 rue Gabriel Péri",
      postal_code: "92320",
      city: "Châtillon",
    });
    expect(manques).toEqual([]);
    expect(valeurs.org_name).toBeNull();
  });
});
