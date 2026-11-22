import { describe, expect, it } from "vitest";
import {
  aiguiller,
  type CircuitPublie,
  cleEtape,
  comparer,
  conditionVraie,
  controler,
  type Definition,
  decrireCondition,
  type Etape,
  etapesApplicables,
  etapesRetenant,
  etatEtape,
  type Faits,
  lireCondition,
  lireDefinition,
  type Referentiel,
  type Test,
} from "@/lib/circuits";

const asso: Faits = {
  secteur: "salle",
  type_demandeur: "association",
  sportive: false,
  gratuite_accordee: false,
  public: true,
  montant: 0,
  participants: 80,
};

const ref: Referentiel = {
  services: new Map([
    [1, { name: "Vie associative", personnes: 2, responsable: true }],
    [2, { name: "Communication", personnes: 0, responsable: false }],
  ]),
  delegations: new Map([
    [1, { label: "Vie associative", personnes: 1 }],
    [2, { label: "Sports", personnes: 0 }],
  ]),
  roles: new Map([["gestionnaire", { label: "Gestionnaire", personnes: 1 }]]),
};

const etape = (plus: Partial<Etape> = {}): Etape => ({
  cle: "visa-elu",
  libelle: "Visa de l'élu",
  libelleUsager: "",
  nature: "visa",
  moment: "avant_acceptation",
  intervenant: { type: "delegation", id: 1 },
  condition: null,
  delaiJours: 0,
  ...plus,
});

const def = (plus: Partial<Definition> = {}): Definition => ({
  condition: null,
  serviceId: null,
  etapes: [],
  ...plus,
});

describe("conditions", () => {
  it("une condition vide est toujours vraie", () => {
    expect(conditionVraie(null, asso)).toBe(true);
    expect(conditionVraie({ mode: "tous", tests: [] }, asso)).toBe(true);
  });

  it("réunit les tests par « et » ou par « ou »", () => {
    const tests: Test[] = [
      { champ: "type_demandeur", op: "parmi", valeur: ["association"] },
      { champ: "secteur", op: "parmi", valeur: ["sport"] },
    ];
    expect(conditionVraie({ mode: "tous", tests: [...tests] }, asso)).toBe(false);
    expect(conditionVraie({ mode: "un", tests: [...tests] }, asso)).toBe(true);
  });

  it("compare booléens et nombres", () => {
    expect(
      conditionVraie({ mode: "tous", tests: [{ champ: "public", op: "est", valeur: true }] }, asso),
    ).toBe(true);
    expect(
      conditionVraie(
        { mode: "tous", tests: [{ champ: "sportive", op: "est", valeur: true }] },
        asso,
      ),
    ).toBe(false);
    expect(
      conditionVraie(
        { mode: "tous", tests: [{ champ: "participants", op: "min", valeur: 50 }] },
        asso,
      ),
    ).toBe(true);
    expect(
      conditionVraie(
        { mode: "tous", tests: [{ champ: "participants", op: "max", valeur: 50 }] },
        asso,
      ),
    ).toBe(false);
  });

  it("un fait inconnu ne vérifie aucun test", () => {
    expect(
      conditionVraie(
        { mode: "tous", tests: [{ champ: "profil", op: "parmi", valeur: ["3"] }] },
        {
          profil: null,
        },
      ),
    ).toBe(false);
  });

  it("écarte à la lecture les critères inconnus et les valeurs mal typées", () => {
    expect(
      lireCondition({
        mode: "un",
        tests: [
          { champ: "inconnu", op: "est", valeur: true },
          { champ: "public", op: "est", valeur: "oui" },
          { champ: "secteur", op: "parmi", valeur: ["salle", "salle", ""] },
          { champ: "montant", op: "min", valeur: "500" },
        ],
      }),
    ).toEqual({
      mode: "un",
      tests: [
        { champ: "secteur", op: "parmi", valeur: ["salle"] },
        { champ: "montant", op: "min", valeur: 500 },
      ],
    });
    expect(lireCondition({ tests: [] })).toBeNull();
    expect(lireCondition(null)).toBeNull();
  });

  it("se décrit en clair", () => {
    expect(
      decrireCondition(
        {
          mode: "tous",
          tests: [
            { champ: "type_demandeur", op: "parmi", valeur: ["particulier", "entreprise"] },
            { champ: "espace", op: "parmi", valeur: ["5"] },
            { champ: "montant", op: "min", valeur: 1000 },
            { champ: "sportive", op: "est", valeur: false },
          ],
        },
        { espace: { "5": "Salle Gabriel Péri" } },
      ),
    ).toBe(
      "Type de demandeur : Particulier ou Entreprise et Espace : Salle Gabriel Péri et Montant TTC ≥ 1000 € et Association sportive : non",
    );
    expect(decrireCondition(null)).toBe("Toujours");
  });
});

describe("définition", () => {
  it("écarte les étapes illisibles et les doublons de clé", () => {
    const d = lireDefinition({
      serviceId: "3",
      etapes: [
        { ...etape(), delaiJours: "10" },
        { ...etape(), libelle: "Doublon" },
        { ...etape({ cle: "x" }), nature: "inconnue" },
        { ...etape({ cle: "y" }), intervenant: { type: "service" } },
        { ...etape({ cle: "Clé invalide" }) },
      ],
    });
    expect(d.serviceId).toBe(3);
    expect(d.etapes.map((e) => e.cle)).toEqual(["visa-elu"]);
    expect(d.etapes[0].delaiJours).toBe(10);
  });

  it("fabrique des clés d'étape uniques", () => {
    expect(cleEtape("Visa de l'élu")).toBe("visa-de-l-elu");
    expect(cleEtape("Relecture", ["relecture", "relecture-2"])).toBe("relecture-3");
    expect(cleEtape("…")).toBe("etape");
  });

  it("ne retient que les étapes dont la condition est vraie", () => {
    const d = def({
      etapes: [
        etape({
          cle: "visa",
          condition: {
            mode: "tous",
            tests: [{ champ: "gratuite_accordee", op: "est", valeur: true }],
          },
        }),
        etape({ cle: "relecture", nature: "relecture" }),
      ],
    });
    expect(etapesApplicables(d, asso).map((e) => e.cle)).toEqual(["relecture"]);
    expect(etapesApplicables(d, { ...asso, gratuite_accordee: true }).map((e) => e.cle)).toEqual([
      "visa",
      "relecture",
    ]);
  });
});

describe("aiguillage", () => {
  const circuit = (
    id: number,
    position: number,
    condition: Definition["condition"],
    parDefaut = false,
  ): CircuitPublie => ({
    id,
    versionId: id * 10,
    name: `Circuit ${id}`,
    position,
    parDefaut,
    definition: def({ condition }),
  });
  const assos = circuit(1, 2, {
    mode: "tous",
    tests: [{ champ: "type_demandeur", op: "parmi", valeur: ["association"] }],
  });
  const sports = circuit(2, 1, {
    mode: "tous",
    tests: [{ champ: "secteur", op: "parmi", valeur: ["sport"] }],
  });
  const defaut = circuit(3, 0, null, true);

  it("retient le premier circuit dont la règle est vraie, dans l'ordre des positions", () => {
    const a = aiguiller([defaut, assos, sports], { ...asso, secteur: "sport" });
    expect(a.retenu?.id).toBe(2);
    expect(a.examen.map((e) => [e.circuit.id, e.retenu])).toEqual([
      [2, true],
      [1, false],
      [3, false],
    ]);
  });

  it("explique pourquoi une règle ne s'applique pas", () => {
    const a = aiguiller([defaut, assos, sports], asso);
    expect(a.retenu?.id).toBe(1);
    expect(a.examen[0].raison).toBe("Règle non vérifiée : Secteur de l'espace : Sports");
  });

  it("retombe sur le circuit par défaut, examiné en dernier", () => {
    const a = aiguiller([defaut, assos, sports], { ...asso, type_demandeur: "particulier" });
    expect(a.retenu?.id).toBe(3);
  });

  it("ne retient rien sans circuit par défaut", () => {
    expect(aiguiller([sports], asso).retenu).toBeNull();
  });

  it("ignore un circuit sans règle qui n'est pas le circuit par défaut", () => {
    const a = aiguiller([circuit(4, 0, null), defaut], asso);
    expect(a.retenu?.id).toBe(3);
    expect(a.examen[0].raison).toBe("Aucune règle d'aiguillage.");
  });
});

describe("contrôles avant publication", () => {
  it("un circuit sans règle ne se publie que s'il est le circuit par défaut", () => {
    expect(controler({ name: "A", parDefaut: false }, def(), ref)).toHaveLength(1);
    expect(controler({ name: "A", parDefaut: true }, def(), ref)).toEqual([]);
  });

  it("refuse deux circuits par défaut et une règle sur le circuit par défaut", () => {
    const erreurs = controler(
      { name: "A", parDefaut: true },
      def({ condition: { mode: "tous", tests: [{ champ: "public", op: "est", valeur: true }] } }),
      ref,
      [{ name: "Standard", parDefaut: true }],
    );
    expect(erreurs).toHaveLength(2);
    expect(erreurs[1]).toContain("Standard");
  });

  it("refuse une étape sans libellé ou sans personne pour y répondre", () => {
    const erreurs = controler(
      { name: "A", parDefaut: true },
      def({
        etapes: [
          etape({ cle: "a", libelle: " " }),
          etape({ cle: "b", intervenant: { type: "service", id: 2 } }),
          etape({ cle: "c", intervenant: { type: "delegation", id: 2 } }),
          etape({ cle: "d", intervenant: { type: "service", id: 99 } }),
          etape({ cle: "e", intervenant: { type: "role", role: "elu" } }),
        ],
      }),
      ref,
    );
    expect(erreurs).toHaveLength(5);
    expect(erreurs[1]).toContain("Communication");
  });

  it("exige un service quand une étape s'adresse au service du dossier", () => {
    const d = def({ etapes: [etape({ intervenant: { type: "responsable_dossier" } })] });
    expect(controler({ name: "A", parDefaut: true }, d, ref)[0]).toContain("désignez le service");
    expect(controler({ name: "A", parDefaut: true }, { ...d, serviceId: 1 }, ref)).toEqual([]);
    expect(controler({ name: "A", parDefaut: true }, { ...d, serviceId: 2 }, ref)[0]).toContain(
      "pas de responsable",
    );
  });
});

describe("état des étapes", () => {
  it("lit l'état d'après la dernière ouverture", () => {
    expect(etatEtape(null)).toBe("a_demander");
    expect(etatEtape({ status: "annulee" })).toBe("a_demander");
    expect(etatEtape({ status: "ouverte" })).toBe("ouverte");
    expect(etatEtape({ status: "validee" })).toBe("validee");
    expect(etatEtape({ status: "refusee" })).toBe("refusee");
  });

  it("un avis ne retient jamais la décision", () => {
    const retenues = etapesRetenant([
      { cle: "avis", nature: "avis" as const, etat: "ouverte" as const },
      { cle: "visa", nature: "visa" as const, etat: "ouverte" as const },
      { cle: "relecture", nature: "relecture" as const, etat: "validee" as const },
      { cle: "visa2", nature: "visa" as const, etat: "refusee" as const },
    ]);
    expect(retenues.map((e) => e.cle)).toEqual(["visa", "visa2"]);
  });
});

describe("comparaison de versions", () => {
  it("dit ce qui a changé", () => {
    const avant = def({
      etapes: [etape({ cle: "a", libelle: "A" }), etape({ cle: "b", libelle: "B" })],
    });
    const apres = def({
      serviceId: 1,
      etapes: [etape({ cle: "a", libelle: "A", delaiJours: 5 }), etape({ cle: "c", libelle: "C" })],
    });
    expect(comparer(avant, apres, ref)).toEqual([
      "Service du circuit modifié.",
      "Étape modifiée : A.",
      "Étape ajoutée : C (Élu · Vie associative).",
      "Étape retirée : B.",
    ]);
  });

  it("signale un simple changement d'ordre", () => {
    const a = etape({ cle: "a" });
    const b = etape({ cle: "b" });
    expect(comparer(def({ etapes: [a, b] }), def({ etapes: [b, a] }), ref)).toEqual([
      "Ordre des étapes modifié.",
    ]);
  });
});
