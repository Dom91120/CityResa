import { describe, expect, it } from "vitest";
import {
  type Acteur,
  agitPour,
  factureOuverte,
  fileDeTravail,
  type ServiceBrut,
  servicesAgis,
  suppleanceEnCours,
} from "@/lib/services";

const service = (id: number, plus: Partial<ServiceBrut> = {}): ServiceBrut => ({
  id,
  isActive: true,
  responsableId: null,
  membres: [],
  suppleantId: null,
  suppleanceDu: null,
  suppleanceAu: null,
  ...plus,
});

const FETES = 1;
const COM = 2;
const SPORTS = 3;
const services = [
  service(FETES, {
    membres: ["sophie"],
    suppleantId: COM,
    suppleanceDu: "2026-08-01",
    suppleanceAu: "2026-08-15",
  }),
  service(COM, { membres: ["camille"], responsableId: "claire" }),
  service(SPORTS, { membres: ["karim"] }),
];

describe("suppléance", () => {
  it("court entre ses deux dates, bornes comprises", () => {
    const s = services[0];
    expect(suppleanceEnCours(s, "2026-07-31")).toBe(false);
    expect(suppleanceEnCours(s, "2026-08-01")).toBe(true);
    expect(suppleanceEnCours(s, "2026-08-15")).toBe(true);
    expect(suppleanceEnCours(s, "2026-08-16")).toBe(false);
  });

  it("sans date, vaut tant qu'un suppléant est désigné", () => {
    expect(suppleanceEnCours(service(9, { suppleantId: 2 }), "2030-01-01")).toBe(true);
    expect(suppleanceEnCours(service(9), "2030-01-01")).toBe(false);
  });
});

describe("services pour lesquels une personne agit", () => {
  it("membre ou responsable", () => {
    expect(servicesAgis("sophie", services, "2026-06-01")).toEqual([FETES]);
    expect(servicesAgis("claire", services, "2026-06-01")).toEqual([COM]);
    expect(servicesAgis("inconnu", services, "2026-06-01")).toEqual([]);
  });

  it("le suppléant agit pour le service suppléé pendant la période seulement", () => {
    expect(servicesAgis("camille", services, "2026-08-10")).toEqual([FETES, COM]);
    expect(servicesAgis("claire", services, "2026-08-10")).toEqual([FETES, COM]);
    expect(servicesAgis("camille", services, "2026-08-20")).toEqual([COM]);
  });

  it("la suppléance ne se transmet pas en chaîne et ne joue pas dans l'autre sens", () => {
    const chaine = [...services, service(4, { suppleantId: FETES, membres: ["zoe"] })];
    expect(servicesAgis("camille", chaine, "2026-08-10")).toEqual([FETES, COM]);
    expect(servicesAgis("sophie", chaine, "2026-08-10")).toEqual([FETES, 4]);
  });

  it("ignore les services inactifs, suppléants compris", () => {
    const inactifs = [
      { ...services[0], isActive: false },
      services[1],
      { ...services[2], isActive: false },
    ];
    expect(servicesAgis("sophie", inactifs, "2026-08-10")).toEqual([]);
    expect(servicesAgis("camille", inactifs, "2026-08-10")).toEqual([COM]);
    expect(servicesAgis("karim", inactifs, "2026-08-10")).toEqual([]);
  });
});

describe("droits qui découlent du service", () => {
  const sophie: Acteur = { actif: true, isAdmin: false, services: [FETES] };
  const lecteur: Acteur = { actif: true, isAdmin: false, services: [] };
  const admin: Acteur = { actif: true, isAdmin: true, services: [] };

  it("décider revient aux personnes du service et aux administrateurs", () => {
    expect(agitPour(sophie, FETES)).toBe(true);
    expect(agitPour(sophie, SPORTS)).toBe(false);
    expect(agitPour(lecteur, FETES)).toBe(false);
    expect(agitPour(admin, FETES)).toBe(true);
  });

  it("un dossier sans service reste ouvert à tous", () => {
    expect(agitPour(sophie, null)).toBe(true);
    expect(agitPour(lecteur, undefined)).toBe(true);
  });

  it("module coupé : aucune limite", () => {
    const coupe: Acteur = { ...lecteur, actif: false };
    expect(agitPour(coupe, FETES)).toBe(true);
    expect(fileDeTravail({ ...sophie, actif: false })).toBeNull();
  });

  it("la file de travail se limite aux services de l'agent, s'il en a", () => {
    expect(fileDeTravail(sophie)).toEqual([FETES]);
    expect(fileDeTravail(lecteur)).toBeNull();
    expect(fileDeTravail(admin)).toBeNull();
  });

  it("un agent sans service encaisse pour tous, un agent d'un autre service non", () => {
    expect(factureOuverte(lecteur, FETES)).toBe(true);
    expect(factureOuverte(sophie, FETES)).toBe(true);
    expect(factureOuverte(sophie, SPORTS)).toBe(false);
    expect(factureOuverte(sophie, null)).toBe(true);
  });
});
