import { describe, expect, it } from "vitest";
import { corpsVide, normaliserCorps } from "@/lib/courriel-html";

describe("normaliserCorps", () => {
  it("garde les balises admises et retire les attributs", () => {
    expect(
      normaliserCorps(
        '<p class="x" style="color:red">Bonjour <strong id="s">{{prenom}}</strong>,</p><p>Voir <a href="{{lien}}" target="_blank" onclick="x()">ici</a>.</p>',
      ),
    ).toBe('<p>Bonjour <strong>{{prenom}}</strong>,</p><p>Voir <a href="{{lien}}">ici</a>.</p>');
  });

  it("renomme ce que produit un éditeur ou un collage, et retire le reste", () => {
    expect(
      normaliserCorps(
        '<div>Un <b>gras</b> et <i>italique</i></div><h2>Titre</h2><span style="font:x">texte</span><img src="x.png"><script>alert(1)</script><table><tr><td>cellule</td></tr></table>',
      ),
    ).toBe("<p>Un <strong>gras</strong> et <em>italique</em></p><p>Titre</p>textecellule");
  });

  it("n'admet que des liens http, mailto ou variable", () => {
    expect(normaliserCorps('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(normaliserCorps('<a href="mailto:a@b.fr">x</a>')).toBe('<a href="mailto:a@b.fr">x</a>');
    expect(normaliserCorps("<a href='https://x.fr/?a=1&b=2'>x</a>")).toBe(
      '<a href="https://x.fr/?a=1&b=2">x</a>',
    );
  });

  it("nettoie les espaces insécables, les paragraphes vides et les sauts de ligne", () => {
    expect(
      normaliserCorps("<p>a&nbsp;b</p>\n  <p><br></p>\n<p> </p><ul>\n <li>un</li>\n</ul>"),
    ).toBe("<p>a b</p><ul><li>un</li></ul>");
    expect(normaliserCorps("<p>x​{{y}}​</p>")).toBe("<p>x{{y}}</p>");
  });

  it("dit si le corps est vide", () => {
    expect(corpsVide("<p><br></p><p>&nbsp;</p>")).toBe(true);
    expect(corpsVide("<p>x</p>")).toBe(false);
  });
});
