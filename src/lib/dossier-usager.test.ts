import { describe, expect, it } from "vitest";
import {
  type DonneeContact,
  type DonneeOrganisation,
  exigencesPour,
  exigeSurOrganisation,
  manquesDossier,
  manquesSur,
  nomRepresentant,
  phraseManques,
  qualiteRepresentant,
} from "./dossier-usager";

const asso: DonneeOrganisation = {
  type: "association",
  name: "Châtillon Basket Club",
  address: "15 rue des Pierrelais",
  postalCode: "92320",
  city: "Châtillon",
  siret: null,
  legalFirstName: "Nadia",
  legalLastName: "Rahmani",
  legalAppointedAt: new Date("2025-06-14"),
};

const contact: DonneeContact = {
  firstName: "Nadia",
  lastName: "Rahmani",
  email: "nadia.rahmani@exemple.fr",
  phone: "06 12 45 78 90",
};

describe("manquesDossier", () => {
  it("accepte une association complète", () => {
    expect(manquesDossier(asso, contact)).toEqual([]);
  });

  it("liste les onze données de fiche d'une association, dans l'ordre du cahier des charges", () => {
    expect(exigencesPour("association").map((e) => e.libelle)).toEqual([
      "Nom de l'association",
      "Prénom du contact",
      "Nom du contact",
      "Téléphone du contact",
      "E-mail du contact",
      "Adresse postale du siège social",
      "Code postal",
      "Ville",
      "Prénom du président",
      "Nom du président",
      "Date de l'AG de nomination",
    ]);
  });

  it("signale le président et l'AG manquants, et le téléphone du contact", () => {
    const m = manquesDossier(
      { ...asso, legalFirstName: " ", legalLastName: null, legalAppointedAt: null },
      { ...contact, phone: null },
    );
    expect(m.map((e) => e.cle)).toEqual([
      "contact_phone",
      "legal_first_name",
      "legal_last_name",
      "legal_appointed_at",
    ]);
    expect(phraseManques(m)).toBe(
      "Il manque : téléphone du contact, prénom du président, nom du président, date de l'AG de nomination.",
    );
  });

  it("n'exige ni président ni AG d'un particulier", () => {
    const part: DonneeOrganisation = {
      ...asso,
      type: "particulier",
      legalFirstName: null,
      legalLastName: null,
      legalAppointedAt: null,
    };
    expect(manquesDossier(part, contact)).toEqual([]);
    expect(exigeSurOrganisation("particulier", "legal_first_name")).toBe(false);
    expect(exigeSurOrganisation("association", "legal_appointed_at")).toBe(true);
  });

  it("exige le SIRET et le dirigeant d'une entreprise, pas l'AG", () => {
    const ets: DonneeOrganisation = { ...asso, type: "entreprise", legalAppointedAt: null };
    expect(manquesDossier(ets, contact).map((e) => e.cle)).toEqual(["siret"]);
  });

  it("sans compte de dépôt, toutes les données du contact manquent", () => {
    expect(manquesSur("compte", asso, null).map((e) => e.cle)).toEqual([
      "contact_first_name",
      "contact_last_name",
      "contact_phone",
      "contact_email",
    ]);
    expect(manquesSur("organisation", asso, null)).toEqual([]);
  });

  it("retombe sur les règles d'un particulier pour un type inconnu", () => {
    expect(exigencesPour("inconnu")).toBe(exigencesPour("particulier"));
  });

  it("nomme le représentant selon le type", () => {
    expect(qualiteRepresentant("association")).toBe("Président(e)");
    expect(qualiteRepresentant("entreprise")).toBe("Dirigeant(e)");
    expect(nomRepresentant({ legalFirstName: "Nadia", legalLastName: null })).toBe("Nadia");
    expect(nomRepresentant({ legalFirstName: null, legalLastName: null })).toBeNull();
  });
});
