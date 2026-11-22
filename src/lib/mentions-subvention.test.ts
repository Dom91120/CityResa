import { describe, expect, it } from "vitest";
import {
  contactService,
  ligneContact,
  noticeDonnees,
  type ReglagesService,
} from "./mentions-subvention";

const CFG: ReglagesService = {
  COLLECTIVITE_NOM: "Ville de Test",
  COLLECTIVITE_ADRESSE: "1 place de la Mairie, 00000 Test",
  COLLECTIVITE_EMAIL: "mairie@test.example",
  COLLECTIVITE_TELEPHONE: "01 00 00 00 00",
  SUBVENTIONS_SERVICE_NOM: "Service de la vie associative",
  SUBVENTIONS_SERVICE_EMAIL: "asso@test.example",
  SUBVENTIONS_SERVICE_TELEPHONE: "01 11 11 11 11",
};

describe("contactService", () => {
  it("donne les coordonnées propres au service", () => {
    expect(contactService(CFG)).toEqual({
      nom: "Service de la vie associative",
      email: "asso@test.example",
      telephone: "01 11 11 11 11",
    });
  });

  it("préfère le service instructeur du dossier, et complète ses coordonnées", () => {
    expect(
      contactService(CFG, {
        name: "Service des sports",
        email: "sports@test.example",
        phone: null,
      }),
    ).toEqual({
      nom: "Service des sports",
      email: "sports@test.example",
      telephone: "01 11 11 11 11",
    });
    expect(contactService(CFG, null).nom).toBe("Service de la vie associative");
    expect(contactService(CFG, { name: " ", email: null, phone: null }).nom).toBe(
      "Service de la vie associative",
    );
  });

  it("se replie sur la collectivité, rubrique par rubrique", () => {
    const c = contactService({
      ...CFG,
      SUBVENTIONS_SERVICE_NOM: " ",
      SUBVENTIONS_SERVICE_EMAIL: "",
    });
    expect(c).toEqual({
      nom: "Ville de Test",
      email: "mairie@test.example",
      telephone: "01 11 11 11 11",
    });
  });
});

describe("ligneContact", () => {
  it("omet les rubriques vides", () => {
    expect(ligneContact({ nom: "Service", email: "", telephone: "01 11" })).toBe("Service · 01 11");
  });
});

describe("noticeDonnees", () => {
  it("nomme la collectivité, le service et le contact pour l'exercice des droits", () => {
    const n = noticeDonnees(CFG);
    expect(n.map((p) => p.titre)).toEqual([
      "Responsable du traitement",
      "Finalités",
      "Base légale",
      "Destinataires",
      "Durée de conservation",
      "Vos droits",
    ]);
    expect(n[0].texte).toContain("Ville de Test");
    expect(n[3].texte).toContain("Service de la vie associative");
    expect(n[5].texte).toContain("mairie@test.example");
    expect(n[5].texte).toContain("CNIL");
  });

  it("reste lisible sans adresse ni courriel de la collectivité", () => {
    const n = noticeDonnees({ ...CFG, COLLECTIVITE_ADRESSE: "", COLLECTIVITE_EMAIL: "" });
    expect(n[5].texte).toContain("auprès de la collectivité (Ville de Test).");
  });
});
