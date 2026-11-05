import { describe, expect, it } from "vitest";
import {
  construireExport,
  decrireConservation,
  derniereActivite,
  dossierAPurger,
  dossierEnCours,
  etatInactivite,
  JOUR_MS,
  obstaclesAnonymisation,
  phraseObstacles,
  reglesDe,
  seuilInactivite,
  valeursAnonymes,
  valeursOrganisationAnonyme,
} from "@/lib/rgpd";

const now = new Date("2026-11-05T10:00:00Z");
const regles = reglesDe({
  RGPD_INACTIVITE_MOIS: 36,
  RGPD_PREAVIS_JOURS: 30,
  RGPD_CONSERVATION_ANNEES: 5,
});
const j = (n: number) => new Date(now.getTime() + n * JOUR_MS);
const compte = (extra: Partial<Parameters<typeof etatInactivite>[0]> = {}) => ({
  isActive: true,
  createdAt: j(-2000),
  lastLoginAt: j(-1200),
  inactivitePreavisAt: null,
  anonymiseAt: null,
  ...extra,
});

describe("inactivité", () => {
  it("la dernière activité est la connexion, sinon la création", () => {
    expect(derniereActivite({ createdAt: j(-10), lastLoginAt: j(-3) })).toEqual(j(-3));
    expect(derniereActivite({ createdAt: j(-10), lastLoginAt: null })).toEqual(j(-10));
  });

  it("le seuil recule de N mois", () => {
    expect(seuilInactivite(36, now).toISOString()).toBe("2023-11-05T10:00:00.000Z");
  });

  it("un compte récent est actif, un compte vieux est d'abord prévenu puis anonymisé", () => {
    expect(etatInactivite(compte({ lastLoginAt: j(-30) }), regles, now)).toBe("actif");
    expect(etatInactivite(compte(), regles, now)).toBe("a_prevenir");
    expect(etatInactivite(compte({ inactivitePreavisAt: j(-10) }), regles, now)).toBe("en_preavis");
    expect(etatInactivite(compte({ inactivitePreavisAt: j(-30) }), regles, now)).toBe(
      "a_anonymiser",
    );
  });

  it("un compte désactivé est anonymisé sans préavis ; un compte anonymisé reste tel quel", () => {
    expect(etatInactivite(compte({ isActive: false }), regles, now)).toBe("a_anonymiser");
    expect(etatInactivite(compte({ anonymiseAt: j(-1) }), regles, now)).toBe("anonymise");
  });

  it("le réglage à zéro coupe l'anonymisation automatique", () => {
    expect(etatInactivite(compte(), { ...regles, inactiviteMois: 0 }, now)).toBe("jamais");
  });
});

describe("obstacles et dossiers en cours", () => {
  it("un dossier non décidé ou à venir retient le compte, un dossier passé non", () => {
    expect(dossierEnCours({ status: "a_traiter", endAt: j(-100) }, now)).toBe(true);
    expect(dossierEnCours({ status: "confirmee", endAt: j(5) }, now)).toBe(true);
    expect(dossierEnCours({ status: "confirmee", endAt: j(-5) }, now)).toBe(false);
    expect(dossierEnCours({ status: "annulee", endAt: j(5) }, now)).toBe(false);
  });

  it("les obstacles sont énumérés en français", () => {
    expect(obstaclesAnonymisation({ dossiersEnCours: 0, facturesImpayees: 0 })).toEqual([]);
    expect(
      phraseObstacles(obstaclesAnonymisation({ dossiersEnCours: 2, facturesImpayees: 1 })),
    ).toBe(
      "Impossible pour le moment : 2 dossiers de réservation sont encore en cours et une facture reste à payer.",
    );
  });
});

describe("anonymisation", () => {
  it("remplace l'identité par des valeurs neutres et uniques", () => {
    const v = valeursAnonymes("cm1abcdefgh12345678", now);
    expect(v.email).toBe("anonyme-12345678@anonymise.invalid");
    expect(v.isActive).toBe(false);
    expect(v.phone).toBeNull();
    expect(v.anonymiseAt).toEqual(now);
  });

  it("un particulier perd son nom et son adresse, une association garde sa raison sociale", () => {
    const p = valeursOrganisationAnonyme({ id: 7, type: "particulier" });
    expect(p.name).toBe("Particulier anonymisé n°7");
    expect(p.address).toBeNull();
    const a = valeursOrganisationAnonyme({ id: 8, type: "association" });
    expect("name" in a).toBe(false);
    expect(a.legalLastName).toBeNull();
    expect(a.isActive).toBe(false);
  });
});

describe("purge des dossiers", () => {
  it("un dossier archivé fini depuis plus de N ans est purgé une seule fois", () => {
    const vieux = { status: "archivee", endAt: new Date("2020-06-01T00:00:00Z"), purgeAt: null };
    expect(dossierAPurger(vieux, regles, now)).toBe(true);
    expect(dossierAPurger({ ...vieux, purgeAt: j(-1) }, regles, now)).toBe(false);
    expect(dossierAPurger({ ...vieux, status: "confirmee" }, regles, now)).toBe(false);
    expect(dossierAPurger({ ...vieux, endAt: new Date("2022-06-01T00:00:00Z") }, regles, now)).toBe(
      false,
    );
    expect(dossierAPurger(vieux, { ...regles, conservationAnnees: 0 }, now)).toBe(false);
  });
});

describe("information et export", () => {
  it("décrit les durées en vigueur", () => {
    expect(decrireConservation(regles)).toContain("36 mois");
    expect(decrireConservation(regles)).toContain("conservés 5 ans");
    expect(decrireConservation({ ...regles, inactiviteMois: 0 })).toContain(
      "tant que vous ne demandez pas",
    );
  });

  it("l'export reprend le compte, l'organisation et les dossiers sans identifiants techniques", () => {
    const e = construireExport(
      {
        user: {
          email: "a@b.fr",
          firstName: "Ana",
          lastName: "Bé",
          phone: null,
          fonction: null,
          createdAt: j(-100),
          lastLoginAt: j(-1),
          acceptedCguAt: null,
          notifEmail: true,
        },
        organisation: {
          name: "Club",
          type: "association",
          siret: null,
          rna: null,
          address: "1 rue A",
          postalCode: "92320",
          city: "Châtillon",
          email: null,
          phone: null,
          legalFirstName: "Ana",
          legalLastName: "Bé",
        },
        reservations: [
          {
            numero: "RES-1",
            title: "Gala",
            status: "confirmee",
            startAt: j(1),
            endAt: j(1),
            montantTtc: 120,
            gratuit: false,
            createdAt: j(-5),
            espace: { name: "Salle" },
            creneaux: [{ startAt: j(1), endAt: j(1), status: "prevu" }],
          },
        ],
        messages: [{ createdAt: j(-4), body: "Bonjour", reservation: { numero: "RES-1" } }],
        documents: [],
        voeux: [],
        listeAttente: [],
        factures: [],
        subventions: [],
        notifications: [],
        courriels: [],
        journal: [],
      },
      now,
    );
    expect(e.compte.courriel).toBe("a@b.fr");
    expect(e.organisation?.adresse).toBe("1 rue A, 92320 Châtillon");
    expect(e.organisation?.representant).toBe("Ana Bé");
    expect(e.reservations[0]).toMatchObject({ numero: "RES-1", espace: "Salle", montant_ttc: 120 });
    expect(e.messages[0]).toMatchObject({ dossier: "RES-1", texte: "Bonjour" });
    expect(JSON.stringify(e)).not.toContain('"id"');
  });
});
