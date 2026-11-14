import { describe, expect, it } from "vitest";
import {
  ancreTitre,
  guideVersHtml,
  sansTitre,
  sectionsGuide,
  texteBrut,
  titreGuide,
} from "@/lib/guide";

describe("titres et ancres", () => {
  it("lit le titre du chapitre et le retire du corps", () => {
    const md = "# 3. Planning et **campagnes**\n\nTexte.\n";
    expect(titreGuide(md)).toBe("3. Planning et campagnes");
    expect(sansTitre(md)).toBe("\nTexte.\n");
    expect(titreGuide("Sans titre")).toBeNull();
  });

  it("retire la mise en forme d'un titre", () => {
    expect(texteBrut("Le bouton **Valider** et `code` ([lien](x.md))")).toBe(
      "Le bouton Valider et code (lien)",
    );
  });

  it("fabrique une ancre sans accent ni ponctuation", () => {
    expect(ancreTitre("3.2 La vue jour")).toBe("3-2-la-vue-jour");
    expect(ancreTitre("À quoi ça sert ?")).toBe("a-quoi-ca-sert");
    expect(ancreTitre("…")).toBe("section");
  });

  it("liste les sections de niveau 2, avec des ancres uniques, hors blocs de code", () => {
    const md = "## Un\n\n### Sous-titre\n\n```\n## pas un titre\n```\n\n## Un\n\n## Deux\n";
    expect(sectionsGuide(md)).toEqual([
      { id: "un", titre: "Un" },
      { id: "un-2", titre: "Un" },
      { id: "deux", titre: "Deux" },
    ]);
  });
});

describe("guideVersHtml", () => {
  it("rend titres, paragraphes et mise en forme en ligne, texte échappé", () => {
    const html = guideVersHtml(
      "## Titre <b>\n\nUn **gras**, un *italique*, du `code <x>`\nsur deux lignes.",
    );
    expect(html).toBe(
      '<h2 id="titre-b">Titre &lt;b&gt;</h2>\n<p>Un <strong>gras</strong>, un <em>italique</em>, du <code>code &lt;x&gt;</code> sur deux lignes.</p>',
    );
  });

  it("donne aux titres les mêmes ancres que sectionsGuide", () => {
    const md = "## Un\n\n## Un\n\n### Détail\n";
    const html = guideVersHtml(md);
    for (const s of sectionsGuide(md)) expect(html).toContain(`<h2 id="${s.id}">`);
    expect(html).toContain('<h3 id="detail">Détail</h3>');
  });

  it("ne met pas en forme le contenu du code en ligne", () => {
    expect(guideVersHtml("Le chemin `**/portail**`.")).toBe(
      "<p>Le chemin <code>**/portail**</code>.</p>",
    );
  });

  it("rend listes, citations, filets et blocs de code", () => {
    expect(guideVersHtml("- un\n- deux\n  suite\n\n1. a\n2. b")).toBe(
      "<ul><li>un</li><li>deux suite</li></ul>\n<ol><li>a</li><li>b</li></ol>",
    );
    expect(guideVersHtml("> **Astuce** — utile.")).toBe(
      "<blockquote><p><strong>Astuce</strong> — utile.</p></blockquote>",
    );
    expect(guideVersHtml("---")).toBe("<hr>");
    expect(guideVersHtml("```\npnpm dev <x>\n```")).toBe(
      "<pre><code>pnpm dev &lt;x&gt;</code></pre>",
    );
  });

  it("rend un tableau dans un conteneur défilant", () => {
    const html = guideVersHtml("| A | B |\n| --- | --- |\n| 1 | **2** |");
    expect(html).toBe(
      '<div class="table-responsive"><table class="table"><thead><tr><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody><tr><td>1</td><td><strong>2</strong></td></tr></tbody></table></div>',
    );
  });

  it("rend une image avec sa légende et réécrit les adresses", () => {
    const html = guideVersHtml(
      "![Le planning](captures/planning.webp)\n\n*Figure — la semaine.*\n\nVoir [les réservations](02-reservations.md) et [le site](https://exemple.fr).",
      {
        image: (src) => `/guide/${src}`,
        lien: (href) => href.replace(/^(\d\d-[\w-]+)\.md$/, "/guide/$1"),
      },
    );
    expect(html).toBe(
      '<figure><img src="/guide/captures/planning.webp" alt="Le planning" loading="lazy"><figcaption>Figure — la semaine.</figcaption></figure>\n' +
        '<p>Voir <a href="/guide/02-reservations">les réservations</a> et <a href="https://exemple.fr" target="_blank" rel="noopener">le site</a>.</p>',
    );
  });
});
