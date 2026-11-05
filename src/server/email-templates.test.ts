import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATE_SEEDS, escapeHtml, rendre, versTexte } from "@/server/email-templates";

describe("escapeHtml", () => {
  it("échappe les caractères dangereux", () => {
    expect(escapeHtml('<a href="x">Tom & Jerry</a>')).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;",
    );
    expect(escapeHtml("rien à échapper")).toBe("rien à échapper");
  });
});

describe("rendre", () => {
  it("remplace les {{variables}} en les échappant", () => {
    expect(rendre("<p>Bonjour {{prenom}},</p>", { prenom: "<b>Nadia</b> & Cie" })).toBe(
      "<p>Bonjour &lt;b&gt;Nadia&lt;/b&gt; &amp; Cie,</p>",
    );
  });

  it("tolère les espaces dans les accolades et les nombres", () => {
    expect(rendre("{{ numero }} · {{montant}}", { numero: "RES-2026-0001", montant: 150 })).toBe(
      "RES-2026-0001 · 150",
    );
  });

  it("une variable absente, nulle ou indéfinie devient une chaîne vide", () => {
    expect(rendre("[{{a}}][{{b}}][{{c}}]", { b: null, c: undefined })).toBe("[][][]");
  });

  it("{{{brut}}} insère du HTML tel quel", () => {
    expect(
      rendre("<div>{{{tableau}}}</div>", { tableau: "<table><tr><td>1</td></tr></table>" }),
    ).toBe("<div><table><tr><td>1</td></tr></table></div>");
  });

  it("ne touche pas aux accolades qui ne forment pas une variable", () => {
    expect(rendre("{{non valide}} {x} {{}}", {})).toBe("{{non valide}} {x} {{}}");
  });

  it("rend les modèles de départ sans laisser de variable connue", () => {
    const vars = {
      prenom: "Nadia",
      numero: "RES-2026-0001",
      espace: "Gymnase",
      dates: "lundi",
      lien: "http://x",
      collectivite: "Ville",
    };
    const html = rendre(EMAIL_TEMPLATE_SEEDS[0].body, vars);
    expect(html).toContain("Bonjour Nadia");
    expect(html).toContain("RES-2026-0001");
    expect(html).not.toMatch(/\{\{\s*(prenom|numero|espace|dates|lien|collectivite)\s*\}\}/);
  });
});

describe("versTexte", () => {
  it("transforme un corps HTML simple en texte lisible", () => {
    const html =
      '<p>Bonjour,<br>ligne</p><ul><li>un</li><li>deux</li></ul><p><a href="http://x">http://x</a> et <a href="http://y">Lien</a></p>';
    expect(versTexte(html)).toBe("Bonjour,\nligne\n• un\n• deux\n\nhttp://x et Lien (http://y)");
  });

  it("décode les entités et resserre les lignes vides", () => {
    expect(versTexte("<p>Tom &amp; Jerry &lt;3 &quot;ok&quot;</p>\n\n\n\n<p>fin</p>")).toBe(
      'Tom & Jerry <3 "ok"\n\n\n\nfin'.replace(/\n{3,}/g, "\n\n"),
    );
    expect(versTexte("<h2>Titre</h2><blockquote>citation</blockquote>")).toBe("Titre\ncitation");
  });

  it("retire les balises et les attributs", () => {
    expect(versTexte('<strong style="font-size:1.4em">123456</strong>')).toBe("123456");
  });
});

describe("EMAIL_TEMPLATE_SEEDS", () => {
  it("a des clés uniques, un sujet, un corps et une aide", () => {
    const keys = EMAIL_TEMPLATE_SEEDS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of EMAIL_TEMPLATE_SEEDS) {
      expect(s.key).toMatch(/^[a-z0-9_]+$/);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.subject.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
      expect(s.aide.length).toBeGreaterThan(0);
    }
  });

  it("contient les modèles attendus par les services", () => {
    const keys = new Set(EMAIL_TEMPLATE_SEEDS.map((s) => s.key));
    for (const k of [
      "reservation_recue",
      "reservation_nouvelle_agent",
      "reservation_infos",
      "reservation_acceptee",
      "convention_a_signer",
      "signature_code",
      "reservation_signee",
      "reservation_confirmee",
      "reservation_refusee",
      "reservation_annulee",
      "fermeture_exceptionnelle",
      "creneaux_modifies",
      "priorite_municipale",
      "avenant_a_signer",
      "avenant_code",
      "avenant_signe",
      "campagne_decisions",
      "option_relance",
      "liste_attente_liberee",
      "caution_restituee",
      "caution_retenue",
      "message_recu",
      "rappel_j7",
      "rappel_j1",
      "facture_emise",
      "paiement_recu",
      "compte_cree",
      "compte_valide",
      "compte_inactif",
      "subvention_recue",
      "subvention_decision",
      "digest_agents",
      "mot_de_passe",
    ])
      expect(keys.has(k), k).toBe(true);
  });
});
