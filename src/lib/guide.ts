/**
 * Le guide utilisateur (docs/guide/*.md) rendu en HTML pour la page « Guide » de l'application.
 *
 * Le Markdown du guide n'utilise qu'un petit sous-ensemble (titres, paragraphes, listes, tableaux,
 * citations, images avec légende « *Figure … * », gras, italique, code, liens), converti ici sans
 * dépendance. scripts/guide-pdf.mjs porte la même conversion pour le PDF : une évolution de la
 * syntaxe du guide se reporte dans les deux. Logique PURE : guide.test.ts.
 */

export type OptionsGuide = {
  /** Réécrit la cible d'un lien (« 02-reservations.md » → « /guide/02-reservations »). */
  lien?: (href: string) => string;
  /** Réécrit la source d'une image (« captures/x.webp » → « /guide/captures/x.webp »). */
  image?: (src: string) => string;
};

export type SectionGuide = { id: string; titre: string };

const echap = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Le texte d'un titre sans sa mise en forme Markdown (« **Astuce** » → « Astuce »). */
export function texteBrut(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

/** L'ancre d'un titre : « 3.2 La vue jour » → « 3-2-la-vue-jour ». */
export function ancreTitre(titre: string): string {
  return (
    texteBrut(titre)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

/** Le titre du chapitre (son premier « # … »), null s'il n'en a pas. */
export function titreGuide(md: string): string | null {
  const m = /^# (.+)$/m.exec(md);
  return m ? texteBrut(m[1] ?? "") : null;
}

/** Le chapitre sans sa ligne de titre « # … » (la page l'affiche dans son en-tête). */
export function sansTitre(md: string): string {
  return md.replace(/^# .+\r?\n?/m, "");
}

/** Les sections d'un chapitre (ses « ## … »), pour le sommaire de la page. */
export function sectionsGuide(md: string): SectionGuide[] {
  const vues = new Map<string, number>();
  const sections: SectionGuide[] = [];
  let dansCode = false;
  for (const l of md.replace(/\r/g, "").split("\n")) {
    if (l.startsWith("```")) dansCode = !dansCode;
    if (dansCode || !l.startsWith("## ")) continue;
    const titre = texteBrut(l.slice(3));
    sections.push({ id: ancreUnique(titre, vues), titre });
  }
  return sections;
}

/** Une ancre qui ne répète pas une ancre déjà émise dans le document (suffixe « -2 », « -3 »…). */
function ancreUnique(titre: string, vues: Map<string, number>): string {
  const base = ancreTitre(titre);
  const n = (vues.get(base) ?? 0) + 1;
  vues.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

/** Marqueur du code en ligne mis de côté : un caractère de la zone d'usage privé. */
const MARQUE = "";

function enLigne(texte: string, o: OptionsGuide): string {
  const codes: string[] = [];
  // Le code en ligne est mis de côté (marqueurs en zone d'usage privé, absents du texte courant) : son contenu n'est pas mis en forme.
  let s = echap(texte).replace(/`([^`]+)`/g, (_, c: string) => {
    codes.push(c);
    return `${MARQUE}${codes.length - 1}${MARQUE}`;
  });
  s = s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t: string, href: string) => {
      const cible = o.lien ? o.lien(href) : href;
      const externe = /^https?:\/\//.test(cible);
      return `<a href="${cible}"${externe ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
    });
  return s.replace(
    new RegExp(`${MARQUE}(\\d+)${MARQUE}`, "g"),
    (_, i: string) => `<code>${codes[Number(i)] ?? ""}</code>`,
  );
}

function cellules(ligne: string): string[] {
  return ligne
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

const estBloc = (l: string) =>
  /^(#{1,6} |```|> |\||- |\d+\. |---\s*$|!\[)/.test(l) || l.trim() === "";

/** Convertit le Markdown du guide en HTML (texte échappé ; les titres de niveau 2 et 3 portent une ancre). */
export function guideVersHtml(md: string, o: OptionsGuide = {}): string {
  return blocs(md, o, new Map());
}

function blocs(md: string, o: OptionsGuide, vues: Map<string, number>): string {
  const lignes = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lignes.length) {
    const l = lignes[i] ?? "";
    if (l.trim() === "") {
      i++;
    } else if (l.startsWith("```")) {
      const bloc: string[] = [];
      for (i++; i < lignes.length && !(lignes[i] ?? "").startsWith("```"); i++)
        bloc.push(lignes[i] ?? "");
      i++;
      out.push(`<pre><code>${echap(bloc.join("\n"))}</code></pre>`);
    } else if (/^#{1,6} /.test(l)) {
      const n = l.indexOf(" ");
      const titre = l.slice(n + 1);
      const id = n === 2 || n === 3 ? ` id="${ancreUnique(titre, vues)}"` : "";
      out.push(`<h${n}${id}>${enLigne(titre, o)}</h${n}>`);
      i++;
    } else if (/^---\s*$/.test(l)) {
      out.push("<hr>");
      i++;
    } else if (l.startsWith("![")) {
      const m = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(l);
      i++;
      while (i < lignes.length && (lignes[i] ?? "").trim() === "") i++;
      let legende = "";
      if (i < lignes.length && /^\*Figure/.test(lignes[i] ?? "")) {
        const morceaux: string[] = [];
        while (i < lignes.length && (lignes[i] ?? "").trim() !== "")
          morceaux.push(lignes[i++] ?? "");
        legende = morceaux.join(" ").replace(/^\*|\*$/g, "");
      }
      if (m) {
        const src = o.image ? o.image(m[2] ?? "") : (m[2] ?? "");
        out.push(
          `<figure><img src="${echap(src)}" alt="${echap(m[1] ?? "")}" loading="lazy">${
            legende ? `<figcaption>${enLigne(legende, o)}</figcaption>` : ""
          }</figure>`,
        );
      }
    } else if (l.startsWith("|")) {
      const rangees: string[] = [];
      while (i < lignes.length && (lignes[i] ?? "").startsWith("|"))
        rangees.push(lignes[i++] ?? "");
      const [tete = "", , ...corps] = rangees;
      out.push(
        `<div class="table-responsive"><table class="table"><thead><tr>${cellules(tete)
          .map((c) => `<th scope="col">${enLigne(c, o)}</th>`)
          .join("")}</tr></thead><tbody>${corps
          .map(
            (r) =>
              `<tr>${cellules(r)
                .map((c) => `<td>${enLigne(c, o)}</td>`)
                .join("")}</tr>`,
          )
          .join("")}</tbody></table></div>`,
      );
    } else if (l.startsWith("> ")) {
      const bloc: string[] = [];
      while (i < lignes.length && (lignes[i] ?? "").startsWith(">"))
        bloc.push((lignes[i++] ?? "").replace(/^> ?/, ""));
      out.push(`<blockquote>${blocs(bloc.join("\n"), o, vues)}</blockquote>`);
    } else if (/^(- |\d+\. )/.test(l)) {
      const ordonnee = /^\d+\. /.test(l);
      const items: string[] = [];
      while (
        i < lignes.length &&
        (/^(- |\d+\. )/.test(lignes[i] ?? "") || /^\s{2,}\S/.test(lignes[i] ?? ""))
      ) {
        const courante = lignes[i] ?? "";
        if (/^(- |\d+\. )/.test(courante)) items.push(courante.replace(/^(- |\d+\. )/, ""));
        else items[items.length - 1] += ` ${courante.trim()}`;
        i++;
      }
      const t = ordonnee ? "ol" : "ul";
      out.push(`<${t}>${items.map((it) => `<li>${enLigne(it, o)}</li>`).join("")}</${t}>`);
    } else {
      const para: string[] = [];
      while (i < lignes.length && !estBloc(lignes[i] ?? "")) para.push(lignes[i++] ?? "");
      if (!para.length) para.push(lignes[i++] ?? "");
      out.push(`<p>${enLigne(para.join(" "), o)}</p>`);
    }
  }
  return out.join("\n");
}
