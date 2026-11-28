import { describe, expect, it } from "vitest";
import {
  conditionsAAccepter,
  connexionOuverte,
  pagePortailOuverte,
  pageReglementaire,
  sansLiensPortail,
} from "@/lib/portail";

describe("connexion portail coupé", () => {
  it("ne bloque jamais un agent ni un administrateur", () => {
    expect(connexionOuverte("agent", false)).toBe(true);
    expect(connexionOuverte("agent", true)).toBe(true);
  });

  it("ferme la connexion aux seuls usagers, et seulement portail coupé", () => {
    expect(connexionOuverte("usager", false)).toBe(false);
    expect(connexionOuverte("usager", true)).toBe(true);
  });

  it("une nature inconnue n'est pas traitée comme un usager", () => {
    expect(connexionOuverte("", false)).toBe(true);
  });
});

describe("pages du portail", () => {
  it("les pages réglementaires restent lisibles portail coupé", () => {
    expect(pageReglementaire("/portail/accessibilite")).toBe(true);
    expect(pageReglementaire("/portail/mentions-legales/")).toBe(true);
    expect(pagePortailOuverte("/portail/donnees-personnelles", false)).toBe(true);
  });

  it("tout le reste se ferme, espace personnel compris", () => {
    expect(pagePortailOuverte("/portail", false)).toBe(false);
    expect(pagePortailOuverte("/portail/mes-reservations", false)).toBe(false);
    expect(pagePortailOuverte("/portail/mon-compte", false)).toBe(false);
    expect(pagePortailOuverte("/portail/mes-reservations", true)).toBe(true);
  });
});

describe("acceptation des conditions d'utilisation", () => {
  const invite = { kind: "usager", acceptedCguAt: null };

  it("un usager sans date d'acceptation doit accepter, si un texte existe", () => {
    expect(conditionsAAccepter(invite, "Article 1…")).toBe(true);
  });

  it("sans texte saisi par la collectivité, il n'y a rien à accepter", () => {
    expect(conditionsAAccepter(invite, "")).toBe(false);
    expect(conditionsAAccepter(invite, "   \n")).toBe(false);
    expect(conditionsAAccepter(invite, null)).toBe(false);
  });

  it("un usager qui a déjà accepté n'est plus sollicité", () => {
    expect(conditionsAAccepter({ kind: "usager", acceptedCguAt: new Date() }, "Article 1…")).toBe(
      false,
    );
  });

  it("un agent n'est jamais concerné", () => {
    expect(conditionsAAccepter({ kind: "agent", acceptedCguAt: null }, "Article 1…")).toBe(false);
  });
});

describe("courriels sans renvoi au portail", () => {
  const L =
    '<a href="https://resa.exemple.fr/portail/mes-reservations/12">https://resa.exemple.fr/portail/mes-reservations/12</a>';

  it("retire le paragraphe qui ne fait que renvoyer au portail", () => {
    expect(sansLiensPortail(`<p>Bonjour,</p><p>Votre dossier : ${L}</p><p>Cordialement</p>`)).toBe(
      "<p>Bonjour,</p><p>Cordialement</p>",
    );
  });

  it("ne retire que la phrase du lien quand le paragraphe dit autre chose", () => {
    expect(
      sansLiensPortail(
        `<p>Elle sera examinée dans les meilleurs délais. Vous pouvez la suivre depuis votre espace : ${L}</p>`,
      ),
    ).toBe("<p>Elle sera examinée dans les meilleurs délais.</p>");
    expect(
      sansLiensPortail(`<p>Aucune retenue. Les photos sont dans votre dossier : ${L}</p>`),
    ).toBe("<p>Aucune retenue.</p>");
  });

  it("le point d'une adresse ne coupe pas la phrase", () => {
    expect(sansLiensPortail(`<p>Le dossier est là : ${L}. Merci de votre confiance.</p>`)).toBe(
      "<p>Merci de votre confiance.</p>",
    );
  });

  it("laisse les liens qui ne mènent pas au portail", () => {
    const bo = '<p><a href="https://resa.exemple.fr/reservations/12">Traiter la demande</a></p>';
    const mdp =
      '<p>Suivez ce lien : <a href="https://resa.exemple.fr/reinitialiser?token=x">ici</a></p>';
    expect(sansLiensPortail(bo)).toBe(bo);
    expect(sansLiensPortail(mdp)).toBe(mdp);
    expect(sansLiensPortail('<p><a href="/portailleurs">x</a></p>')).toBe(
      '<p><a href="/portailleurs">x</a></p>',
    );
  });

  it("traite aussi un lien relatif et un élément de liste", () => {
    expect(sansLiensPortail('<ul><li>Un</li><li><a href="/portail">Portail</a></li></ul>')).toBe(
      "<ul><li>Un</li></ul>",
    );
  });
});
