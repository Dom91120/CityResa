import { describe, expect, it } from "vitest";
import {
  identiteDuCompte,
  type OrganisationAInviter,
  phraseBilan,
  trierInvitations,
  validiteEnClair,
} from "@/lib/invitations";

const org = (id: number, plus: Partial<OrganisationAInviter> = {}): OrganisationAInviter => ({
  id,
  name: `Organisation ${id}`,
  type: "association",
  email: `contact${id}@exemple.fr`,
  legalFirstName: "Anne",
  legalLastName: "Durand",
  comptes: 0,
  ...plus,
});

describe("tri des invitations", () => {
  it("invite une organisation sans compte, à son courriel et au nom de son représentant", () => {
    const t = trierInvitations([org(1, { email: " Contact1@Exemple.fr " })], new Set());
    expect(t.invitations).toEqual([
      {
        organisationId: 1,
        organisation: "Organisation 1",
        type: "association",
        email: "contact1@exemple.fr",
        firstName: "Anne",
        lastName: "Durand",
      },
    ]);
    expect(t.ecartees).toEqual([]);
  });

  it("n'invite jamais deux fois : une organisation qui a un compte est laissée", () => {
    const t = trierInvitations([org(1, { comptes: 1 }), org(2)], new Set());
    expect(t.invitations.map((i) => i.organisationId)).toEqual([2]);
    expect(t.dejaPourvues).toBe(1);
  });

  it("écarte et nomme les fiches sans courriel ou au courriel invalide", () => {
    const t = trierInvitations(
      [org(1, { email: null }), org(2, { email: "pas-une-adresse" })],
      new Set(),
    );
    expect(t.invitations).toEqual([]);
    expect(t.ecartees.map((e) => e.motif)).toEqual([
      "aucun courriel sur la fiche",
      "courriel invalide (pas-une-adresse)",
    ]);
  });

  it("écarte un courriel déjà pris par un compte existant", () => {
    const t = trierInvitations([org(1)], new Set(["CONTACT1@exemple.fr"]));
    expect(t.invitations).toEqual([]);
    expect(t.ecartees[0].motif).toContain("déjà l'identifiant d'un autre compte");
  });

  it("deux organisations au même courriel : la première est invitée, la seconde signalée", () => {
    const t = trierInvitations(
      [org(1, { email: "p@exemple.fr", name: "Club A" }), org(2, { email: "P@exemple.fr" })],
      new Set(),
    );
    expect(t.invitations.map((i) => i.organisationId)).toEqual([1]);
    expect(t.ecartees).toEqual([
      {
        id: 2,
        name: "Organisation 2",
        motif: "p@exemple.fr est aussi le courriel de Club A, invitée à cette adresse",
      },
    ]);
  });

  it("le filtre par type ignore les autres types, sans les signaler", () => {
    const t = trierInvitations(
      [org(1), org(2, { type: "particulier", email: null }), org(3, { type: "entreprise" })],
      new Set(),
      ["association", "entreprise"],
    );
    expect(t.invitations.map((i) => i.organisationId)).toEqual([1, 3]);
    expect(t.ecartees).toEqual([]);
  });
});

describe("identité du compte", () => {
  it("prend le représentant, sinon le nom de la fiche", () => {
    expect(identiteDuCompte(org(1))).toEqual({ firstName: "Anne", lastName: "Durand" });
    expect(identiteDuCompte(org(1, { legalFirstName: null, legalLastName: null }))).toEqual({
      firstName: "",
      lastName: "Organisation 1",
    });
  });

  it("découpe le nom d'un particulier sans représentant saisi", () => {
    expect(
      identiteDuCompte(
        org(1, {
          type: "particulier",
          name: "Martine Dupont",
          legalFirstName: null,
          legalLastName: null,
        }),
      ),
    ).toEqual({ firstName: "Martine", lastName: "Dupont" });
  });
});

describe("libellés", () => {
  it("validité et bilan", () => {
    expect(validiteEnClair(14)).toBe("14 jours");
    expect(validiteEnClair(1)).toBe("24 heures");
    expect(phraseBilan({ invites: 3, echecs: 1, ecartees: 2 })).toBe(
      "3 comptes créés et invités, 1 envoi en échec, 2 organisations laissées de côté.",
    );
    expect(phraseBilan({ invites: 0, echecs: 0, ecartees: 0 })).toBe("Aucun compte à créer.");
  });
});
