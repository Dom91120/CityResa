/**
 * Rassemble le guide utilisateur (docs/guide/*.md + captures) en un seul PDF A4 :
 * docs/guide/CityResa-guide-utilisateur.pdf.
 *
 *   node scripts/guide-pdf.mjs
 *
 * Le Markdown du guide n'utilise qu'un petit sous-ensemble (titres, paragraphes, listes,
 * tableaux, citations, images, gras, italique, code, liens), converti ici sans dépendance.
 * Variable facultative : CHROME_PATH.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import sharp from "sharp";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER = path.join(racine, "docs", "guide");
const SORTIE = path.join(DOSSIER, "CityResa-guide-utilisateur.pdf");

const echap = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Ancre d'un chapitre d'après son fichier (« 02-reservations.md » → « ch-02 »). */
const ancreFichier = (f) => `ch-${f.slice(0, 2)}`;

function enLigne(texte) {
  const codes = [];
  let s = echap(texte).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `${codes.length - 1}`;
  });
  s = s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, href) => {
      const m = /^(\d\d)-[\w-]+\.md$/.exec(href);
      return `<a href="${m ? `#ch-${m[1]}` : href}">${t}</a>`;
    });
  return s.replace(/(\d+)/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

function cellules(ligne) {
  return ligne
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

function versHtml(md) {
  const lignes = md.replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  const estBloc = (l) => /^(#{1,6} |```|> |\||- |\d+\. |---\s*$|!\[)/.test(l) || l.trim() === "";
  while (i < lignes.length) {
    const l = lignes[i];
    if (l.trim() === "") {
      i++;
    } else if (l.startsWith("```")) {
      const bloc = [];
      for (i++; i < lignes.length && !lignes[i].startsWith("```"); i++) bloc.push(lignes[i]);
      i++;
      out.push(`<pre><code>${echap(bloc.join("\n"))}</code></pre>`);
    } else if (/^#{1,6} /.test(l)) {
      const n = l.indexOf(" ");
      out.push(`<h${n}>${enLigne(l.slice(n + 1))}</h${n}>`);
      i++;
    } else if (/^---\s*$/.test(l)) {
      out.push("<hr>");
      i++;
    } else if (l.startsWith("![")) {
      const m = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(l);
      i++;
      while (i < lignes.length && lignes[i].trim() === "") i++;
      let legende = "";
      if (i < lignes.length && /^\*Figure/.test(lignes[i])) {
        const morceaux = [];
        while (i < lignes.length && lignes[i].trim() !== "") morceaux.push(lignes[i++]);
        legende = morceaux.join(" ").replace(/^\*|\*$/g, "");
      }
      out.push(
        `<figure><img src="${m[2]}" alt="${echap(m[1])}">${legende ? `<figcaption>${enLigne(legende)}</figcaption>` : ""}</figure>`,
      );
    } else if (l.startsWith("|")) {
      const rangees = [];
      while (i < lignes.length && lignes[i].startsWith("|")) rangees.push(lignes[i++]);
      const [tete, , ...corps] = rangees;
      out.push(
        `<table><thead><tr>${cellules(tete)
          .map((c) => `<th>${enLigne(c)}</th>`)
          .join("")}</tr></thead><tbody>${corps
          .map(
            (r) =>
              `<tr>${cellules(r)
                .map((c) => `<td>${enLigne(c)}</td>`)
                .join("")}</tr>`,
          )
          .join("")}</tbody></table>`,
      );
    } else if (l.startsWith("> ")) {
      const bloc = [];
      while (i < lignes.length && lignes[i].startsWith(">"))
        bloc.push(lignes[i++].replace(/^> ?/, ""));
      out.push(`<blockquote>${versHtml(bloc.join("\n"))}</blockquote>`);
    } else if (/^(- |\d+\. )/.test(l)) {
      const ordonnee = /^\d+\. /.test(l);
      const items = [];
      while (i < lignes.length && (/^(- |\d+\. )/.test(lignes[i]) || /^\s{2,}\S/.test(lignes[i]))) {
        if (/^(- |\d+\. )/.test(lignes[i])) items.push(lignes[i].replace(/^(- |\d+\. )/, ""));
        else items[items.length - 1] += ` ${lignes[i].trim()}`;
        i++;
      }
      const t = ordonnee ? "ol" : "ul";
      out.push(`<${t}>${items.map((it) => `<li>${enLigne(it)}</li>`).join("")}</${t}>`);
    } else {
      const para = [];
      while (i < lignes.length && !estBloc(lignes[i])) para.push(lignes[i++]);
      if (!para.length) para.push(lignes[i++]);
      out.push(`<p>${enLigne(para.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}

const chapitres = readdirSync(DOSSIER)
  .filter((f) => /^\d\d-.*\.md$/.test(f))
  .sort();
const intro = readFileSync(path.join(DOSSIER, "README.md"), "utf8")
  .replace(/## Mettre à jour les captures[\s\S]*$/, "")
  .replace(/^# .*\n/, "");
const titres = chapitres.map((f) => {
  const t = /^# (.+)$/m.exec(readFileSync(path.join(DOSSIER, f), "utf8"))?.[1] ?? f;
  return [f, t];
});

const corps = chapitres
  .map(
    (f) =>
      `<section class="chapitre" id="${ancreFichier(f)}">${versHtml(readFileSync(path.join(DOSSIER, f), "utf8"))}</section>`,
  )
  .join("\n");

const date = new Date().toLocaleDateString("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Guide utilisateur de CityRésa</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  body { font: 10.5pt/1.5 "Segoe UI", system-ui, sans-serif; color: #1f2a24; }
  h1 { font-size: 22pt; color: #0f6b46; margin: 0 0 8pt; border-bottom: 2pt solid #0f6b46; padding-bottom: 4pt; }
  h2 { font-size: 14pt; color: #0f6b46; margin: 18pt 0 6pt; break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 12pt 0 4pt; break-after: avoid; }
  .chapitre { break-before: page; }
  p, li { orphans: 3; widows: 3; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 9pt; break-inside: auto; }
  th, td { border: 0.5pt solid #c9d6cf; padding: 3pt 5pt; vertical-align: top; text-align: left; }
  th { background: #e8f3ed; }
  tr { break-inside: avoid; }
  figure { margin: 8pt 0 12pt; break-inside: avoid; }
  figure img { display: block; max-width: 100%; max-height: 225mm; margin: 0 auto; border: 0.5pt solid #c9d6cf; border-radius: 4pt; }
  figcaption { font-size: 8.5pt; color: #5b6b63; text-align: center; margin-top: 4pt; }
  blockquote { margin: 8pt 0; padding: 4pt 10pt; border-left: 3pt solid #0f6b46; background: #f1f7f3; break-inside: avoid; }
  blockquote p { margin: 2pt 0; }
  code { font-family: Consolas, monospace; font-size: 9pt; background: #f1f4f2; padding: 0 2pt; border-radius: 2pt; }
  pre { background: #f1f4f2; padding: 6pt; font-size: 8.5pt; }
  hr { border: 0; border-top: 0.5pt solid #c9d6cf; margin: 14pt 0; }
  a { color: #0f6b46; text-decoration: none; }
  .couverture { height: 250mm; display: flex; flex-direction: column; justify-content: center; }
  .couverture .titre { font-size: 32pt; font-weight: 700; color: #0f6b46; }
  .couverture .sous { font-size: 14pt; margin-top: 6pt; }
  .couverture .date { margin-top: 30pt; color: #5b6b63; }
  .sommaire ol { font-size: 12pt; line-height: 2; }
</style></head><body>
<div class="couverture">
  <img src="../../public/img/illustration-cityresa.webp" style="width:150mm;margin-bottom:20pt" alt="">
  <div class="titre">Guide utilisateur de CityRésa</div>
  <div class="sous">Réservation des espaces municipaux · Ville de Châtillon</div>
  <div class="sous">Fonctionnalités détaillées et parcours métier</div>
  <div class="date">Édition du ${date}</div>
</div>
<section class="chapitre sommaire"><h1>Présentation</h1>${versHtml(intro.replace(/## Sommaire[\s\S]*?(?=## )/, ""))}
<h2>Sommaire</h2><ol>${titres.map(([f, t]) => `<li><a href="#${ancreFichier(f)}">${enLigne(t.replace(/^\d+\.\s*/, ""))}</a></li>`).join("")}</ol></section>
${corps}
</body></html>`;

// Captures réduites pour l'A4 (environ 150 ppp sur la largeur utile), en JPEG : le PDF reste léger.
const IMAGES = path.join(DOSSIER, ".guide-pdf-images");
mkdirSync(IMAGES, { recursive: true });
for (const f of readdirSync(path.join(DOSSIER, "captures"))) {
  await sharp(path.join(DOSSIER, "captures", f))
    .resize({ width: 1300, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(path.join(IMAGES, f.replace(/\.\w+$/, ".jpg")));
}
const fichierHtml = path.join(DOSSIER, ".guide-pdf.html");
writeFileSync(
  fichierHtml,
  html.replace(/src="captures\/([\w-]+)\.webp"/g, 'src=".guide-pdf-images/$1.jpg"'),
);
const windows = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? (existsSync(windows) ? windows : undefined),
  headless: true,
  args: ["--allow-file-access-from-files"],
});
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(fichierHtml).href, { waitUntil: "load", timeout: 120_000 });
  await page.pdf({
    path: SORTIE,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="font:8pt Segoe UI,sans-serif;color:#5b6b63;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>Guide utilisateur de CityRésa</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
  });
  console.log(`PDF : ${path.relative(racine, SORTIE)}`);
} finally {
  await browser.close();
  if (!process.env.GUIDE_GARDER_HTML) {
    rmSync(fichierHtml, { force: true });
    rmSync(IMAGES, { recursive: true, force: true });
  }
}
