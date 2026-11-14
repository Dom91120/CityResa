import { describe, expect, it } from "vitest";
import {
  avecRetour,
  cheminFiche,
  cheminInterne,
  emplacementAscii,
  libelleRetour,
  retourMemorise,
} from "@/lib/url";

describe("emplacementAscii", () => {
  it("encode les accents et les espaces en UTF-8 sans toucher au reste", () => {
    expect(emplacementAscii("/portail/reserver/x?date=2026-12-12&title=Entraînement d'été")).toBe(
      "/portail/reserver/x?date=2026-12-12&title=Entra%C3%AEnement%20d'%C3%A9t%C3%A9",
    );
  });

  it("laisse intact un chemin déjà encodé", () => {
    const deja = "/connexion?next=%2Fportail%2Freserver%3Ftitle%3DEntra%C3%AEnement";
    expect(emplacementAscii(deja)).toBe(deja);
    expect(emplacementAscii("/reservations/12#documents")).toBe("/reservations/12#documents");
  });
});

describe("adresse de retour", () => {
  it("n'accepte qu'un chemin de l'application", () => {
    expect(cheminInterne("/planning?vue=mois&date=2026-12-01")).toBe(
      "/planning?vue=mois&date=2026-12-01",
    );
    expect(cheminInterne("//exemple.fr/planning")).toBeNull();
    expect(cheminInterne("https://exemple.fr/")).toBeNull();
    expect(cheminInterne("/\\exemple.fr")).toBeNull();
    expect(cheminInterne("/planning\n")).toBeNull();
    expect(cheminInterne("planning")).toBeNull();
    expect(cheminInterne("")).toBeNull();
    expect(cheminInterne(undefined)).toBeNull();
  });

  it("ajoute le retour avant l'ancre, encodé", () => {
    expect(avecRetour("/espaces/3#indisponibilites", "/planning?vue=mois&site=1")).toBe(
      "/espaces/3?retour=%2Fplanning%3Fvue%3Dmois%26site%3D1#indisponibilites",
    );
    expect(avecRetour("/reservations/7?onglet=x", "/planning")).toBe(
      "/reservations/7?onglet=x&retour=%2Fplanning",
    );
    expect(avecRetour("/reservations/7", undefined)).toBe("/reservations/7");
  });

  it("nomme l'endroit où la flèche ramène", () => {
    expect(libelleRetour("/planning?vue=mois")).toBe("Retour au planning");
    expect(libelleRetour("/planning/semaine-type?saison=2")).toBe("Retour à la semaine type");
    expect(libelleRetour("/personnel/personnes/4")).toBe("Retour à la fiche de la personne");
    expect(libelleRetour("/personnel/personnes")).toBe("Retour");
    expect(libelleRetour("/personnel?vue=jour")).toBe("Retour au planning de service");
    expect(libelleRetour("/personnel")).toBe("Retour au planning de service");
    expect(libelleRetour("/espaces")).toBe("Retour");
    expect(libelleRetour("/plannings")).toBe("Retour");
  });
});

describe("origine d'une fiche gardée en mémoire", () => {
  const fiche = "/reservations/12";
  const planning = "/planning?vue=mois&date=2026-12-01";

  it("ne suit que les fiches d'espace, de dossier et de personne", () => {
    expect(cheminFiche("/espaces/3")).toBe("/espaces/3");
    expect(cheminFiche("/reservations/12")).toBe("/reservations/12");
    expect(cheminFiche("/reservations/12/accepter")).toBeNull();
    expect(cheminFiche("/reservations/nouvelle")).toBeNull();
    expect(cheminFiche("/personnel/personnes/4")).toBe("/personnel/personnes/4");
    expect(cheminFiche("/personnel/personnes")).toBeNull();
    expect(cheminFiche("/usagers/4")).toBeNull();
  });

  it("retient l'origine indiquée dans l'adresse", () => {
    expect(retourMemorise({ fiche, param: planning, cookie: null, referent: "/planning" })).toEqual(
      { retour: planning, cookie: `${fiche}|${planning}` },
    );
    // Déjà retenue : rien à réécrire.
    expect(
      retourMemorise({ fiche, param: planning, cookie: `${fiche}|${planning}`, referent: null }),
    ).toEqual({ retour: planning, cookie: undefined });
  });

  it("la garde après une action ou un passage par une sous-page", () => {
    const cookie = `${fiche}|${planning}`;
    expect(retourMemorise({ fiche, param: null, cookie, referent: fiche })).toEqual({
      retour: planning,
    });
    expect(retourMemorise({ fiche, param: null, cookie, referent: `${fiche}/modifier` })).toEqual({
      retour: planning,
    });
  });

  it("l'oublie quand on arrive d'ailleurs ou sur une autre fiche", () => {
    const cookie = `${fiche}|${planning}`;
    const oubli = { retour: null, cookie: null };
    expect(retourMemorise({ fiche, param: null, cookie, referent: "/reservations" })).toEqual(
      oubli,
    );
    expect(retourMemorise({ fiche, param: null, cookie, referent: "/reservations/123" })).toEqual(
      oubli,
    );
    expect(retourMemorise({ fiche, param: null, cookie, referent: null })).toEqual(oubli);
    expect(
      retourMemorise({
        fiche: "/reservations/13",
        param: null,
        cookie,
        referent: "/reservations/13",
      }),
    ).toEqual(oubli);
  });

  it("écarte une origine externe, dans l'adresse comme dans le cookie", () => {
    expect(retourMemorise({ fiche, param: "//exemple.fr", cookie: null, referent: fiche })).toEqual(
      { retour: null },
    );
    expect(
      retourMemorise({ fiche, param: null, cookie: `${fiche}|//exemple.fr`, referent: fiche }),
    ).toEqual({ retour: null, cookie: null });
  });
});
