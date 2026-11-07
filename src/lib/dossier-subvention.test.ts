import { describe, expect, it } from "vitest";
import {
  avecFiche,
  deplierFormulaire,
  dossierVide,
  etatPieces,
  FICHES,
  ficheSuivante,
  fichesIncompletes,
  lireDossier,
  manquesDossier,
  preRemplir,
  type SubventionPourManques,
} from "@/lib/dossier-subvention";

function complet(sportive = false): SubventionPourManques {
  const d = dossierVide(sportive);
  d.bureau.president = { ...d.bureau.president, nom: "Garcia", prenom: "Antoine" };
  d.bureau.tresorier.nom = "Roux";
  d.bureau.chargeDossier = {
    ...d.bureau.chargeDossier,
    nom: "Léa Fontaine",
    courriel: "lea@exemple.fr",
  };
  d.effectifs.benevoles = 12;
  d.effectifs.exercicePrecedent.total = 140;
  d.effectifs.exercicePrecedent.licencies = 120;
  d.rayonnement.orientations = "Jeunes et seniors.";
  d.budget.charges = sportive ? { licences: 2000 } : { locations: 2000 };
  d.budget.produits = sportive
    ? { subv_commune: 3000, cotisations_adherents: 5000 }
    : { subv_commune: 3000, cotisations: 5000 };
  d.motivation.justification = "Fonctionnement général.";
  d.tresorerie.soldeFin = 1500;
  d.bilan.subventionPrecedente = 2500;
  d.bilan.synthese = "Année conforme au budget.";
  d.bilan.realise = sportive ? { cotisations_adherents: 4800 } : { cotisations: 4800 };
  d.attestation = {
    obligationsAJour: true,
    informationsSinceres: true,
    cumulAides: "inf",
    engagementRepublicain: true,
    mandataire: false,
    signataireNom: "Antoine Garcia",
    signataireQualite: "Président",
  };
  return {
    nature: "renouvellement",
    montantDemande: 3000,
    sportive,
    signeAt: new Date(),
    dossier: d,
  };
}

const PIECES_OK = ["pv_ag", "comptes", "rib", "compte_rendu"];

describe("lecture du dossier", () => {
  it("normalise un JSON incomplet ou mal typé sans jamais échouer", () => {
    const d = lireDossier({
      presentation: { sigle: "ASCB", utilitePublique: "on", agrements: [{ type: "Jeunesse" }, {}] },
      effectifs: { benevoles: "12", etpt: "1,5", exercicePrecedent: { total: "140" } },
      budget: { charges: { locations: "800", inconnu: 5 }, produits: { cotisations: 1500 } },
      motivation: { actions: [{ intitule: "Gala", beneficiaires: "60" }, { intitule: "" }] },
      attestation: { cumulAides: "autre" },
    });
    expect(d.presentation.sigle).toBe("ASCB");
    expect(d.presentation.utilitePublique).toBe(true);
    expect(d.presentation.agrements).toEqual([{ type: "Jeunesse", par: "", date: "" }]);
    expect(d.effectifs.benevoles).toBe(12);
    expect(d.effectifs.etpt).toBe(1.5);
    expect(d.effectifs.exercicePrecedent.total).toBe(140);
    expect(d.budget.charges).toEqual({ locations: 800 });
    expect(d.motivation.actions).toHaveLength(1);
    expect(d.motivation.actions[0].beneficiaires).toBe(60);
    expect(d.attestation.cumulAides).toBe("");
    expect(lireDossier(null).bureau.president.nom).toBe("");
  });

  it("remplace une fiche sans toucher aux autres", () => {
    const d = complet().dossier;
    const d2 = avecFiche(d, "tresorerie", { soldeFin: "900" }, false);
    expect(d2.tresorerie.soldeFin).toBe(900);
    expect(d2.tresorerie.soldeDebut).toBeNull();
    expect(d2.bureau.president.nom).toBe("Garcia");
    expect(ficheSuivante("presentation")).toBe("bureau");
    expect(ficheSuivante("attestation")).toBeNull();
    expect(FICHES).toHaveLength(10);
  });
});

describe("pré-remplissage", () => {
  it("prend le président sur la fiche de l'organisation et les locaux de la valorisation", () => {
    const d = preRemplir(
      {
        legalFirstName: "Sandra",
        legalLastName: "Da Silva",
        address: "1 rue de la Paix",
        postalCode: "92320",
        city: "Châtillon",
        email: "sandra@exemple.fr",
        phone: null,
      },
      null,
      null,
      [{ espace: "Salle polyvalente", heures: 42.25 }],
      false,
    );
    expect(d.bureau.president.nom).toBe("Da Silva");
    expect(d.bureau.president.codePostal).toBe("92320");
    expect(d.rayonnement.moyens.locaux).toEqual([
      { designation: "Salle polyvalente", heures: 42.3, par: "La commune" },
    ]);
    expect(d.bilan.subventionPrecedente).toBeNull();
  });

  it("reprend le dossier précédent : présentation, bureau, adhérents devenus N-1, bilan depuis le budget", () => {
    const prec = complet().dossier;
    prec.presentation.sigle = "AD";
    prec.effectifs.previsionnel.total = 150;
    const d = preRemplir(
      {
        legalFirstName: "X",
        legalLastName: "Y",
        address: null,
        postalCode: null,
        city: null,
        email: null,
        phone: null,
      },
      prec,
      2000,
      [],
      false,
    );
    expect(d.presentation.sigle).toBe("AD");
    expect(d.bureau.president.nom).toBe("Garcia");
    expect(d.effectifs.exercicePrecedent.total).toBe(150);
    expect(d.effectifs.previsionnel.total).toBeNull();
    expect(d.bilan.subventionPrecedente).toBe(2000);
    expect(d.bilan.budget).toEqual({ locations: 2000, subv_commune: 3000, cotisations: 5000 });
    expect(d.motivation.justification).toBe("");
  });
});

describe("complétude", () => {
  it("un dossier complet et signé avec ses pièces n'a aucun manque", () => {
    expect(manquesDossier(complet(), PIECES_OK)).toEqual([]);
    expect(manquesDossier(complet(true), PIECES_OK)).toEqual([]);
  });

  it("liste les manques par fiche, pièces et signature comprises", () => {
    const s = complet();
    s.signeAt = null;
    s.dossier.bureau.tresorier.nom = "";
    s.dossier.tresorerie.soldeFin = null;
    s.dossier.attestation.engagementRepublicain = false;
    const manques = manquesDossier(s, ["pv_ag"]);
    expect(manques.map((m) => `${m.fiche}:${m.libelle}`)).toEqual([
      "bureau:Nom du trésorier",
      "tresorerie:Solde de trésorerie en fin d'exercice",
      "pieces:Comptes approuvés du dernier exercice clos",
      "pieces:Relevé d'identité bancaire ou postal de l'association",
      "pieces:Compte rendu financier et qualitatif des actions subventionnées l'an dernier",
      "attestation:Contrat d'engagement républicain accepté",
      "attestation:Signature du représentant (code reçu par SMS ou courriel)",
    ]);
    expect([...fichesIncompletes(manques)]).toEqual([
      "bureau",
      "tresorerie",
      "pieces",
      "attestation",
    ]);
  });

  it("refuse un montant demandé supérieur aux produits et exige les licenciés en sport", () => {
    const s = complet(true);
    s.montantDemande = 20_000;
    s.dossier.effectifs.exercicePrecedent.licencies = null;
    expect(manquesDossier(s, PIECES_OK).map((m) => m.libelle)).toEqual([
      "Nombre de licenciés",
      "Le montant demandé dépasse le total des produits",
    ]);
  });

  it("une première demande n'exige pas le bilan N-1 mais les statuts", () => {
    const s = complet();
    s.nature = "premiere";
    s.dossier.bilan.synthese = "";
    s.dossier.bilan.realise = {};
    expect(manquesDossier(s, ["pv_ag", "comptes", "rib"]).map((m) => m.libelle)).toEqual([
      "Statuts déclarés et récépissé de déclaration en préfecture",
      "Liste des membres élus (conseil d'administration ou bureau)",
    ]);
    expect(etatPieces(s, ["pv_ag"]).map((e) => [e.piece.kind, e.fournie])).toEqual([
      ["pv_ag", true],
      ["comptes", false],
      ["rib", false],
      ["statuts", false],
      ["composition_ca", false],
    ]);
  });
});

describe("formulaire aplati", () => {
  it("reconstitue objets et listes depuis les noms de champs", () => {
    const d = lireDossier(
      {
        presentation: deplierFormulaire([
          ["sigle", "ASCB"],
          ["agrements[0].type", "Jeunesse"],
          ["agrements[1].type", "Sport"],
          ["utilitePublique", "on"],
        ]),
        budget: deplierFormulaire([
          ["charges.locations", "800"],
          ["produits.cotisations", "1 500,00"],
        ]),
      },
      false,
    );
    expect(d.presentation.sigle).toBe("ASCB");
    expect(d.presentation.agrements.map((a) => a.type)).toEqual(["Jeunesse", "Sport"]);
    expect(d.presentation.utilitePublique).toBe(true);
    expect(d.budget.charges).toEqual({ locations: 800 });
    expect(d.budget.produits).toEqual({ cotisations: 1500 });
  });
});
