/**
 * Met en page les scénarios de test et de prise en main (docs/SCENARIOS.md) en un PDF A4 :
 * docs/CityResa-scenarios.pdf, avec la même présentation que le guide utilisateur.
 *
 *   node scripts/scenarios-pdf.mjs
 *
 * Conversion Markdown sans dépendance, comme scripts/guide-pdf.mjs, qui gère en plus les blocs
 * de code et les paragraphes placés sous un élément de liste (indentés).
 * Variables facultatives : CHROME_PATH, SCENARIOS_GARDER_HTML (garde le HTML intermédiaire).
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(racine, "docs", "SCENARIOS.md");
const SORTIE = path.join(racine, "docs", "CityResa-scenarios.pdf");

const echap = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function enLigne(texte) {
  const codes = [];
  let s = echap(texte).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `${codes.length - 1}`;
  });
  s = s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s.replace(/(\d+)/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

const cellules = (l) =>
  l
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

function versHtml(md) {
  const lignes = md.replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  const debutListe = /^(- |\d+\. )/;
  const estBloc = (l) => /^(#{1,6} |```|>|\||- |\d+\. |---\s*$)/.test(l) || l.trim() === "";
  while (i < lignes.length) {
    const l = lignes[i];
    if (l.trim() === "") i++;
    else if (l.startsWith("```")) {
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
    } else if (l.startsWith(">")) {
      const bloc = [];
      while (i < lignes.length && lignes[i].startsWith(">"))
        bloc.push(lignes[i++].replace(/^> ?/, ""));
      out.push(`<blockquote>${versHtml(bloc.join("\n"))}</blockquote>`);
    } else if (debutListe.test(l)) {
      const ordonnee = /^\d+\. /.test(l);
      const depart = ordonnee ? Number(/^(\d+)/.exec(l)[1]) : 1;
      const items = [];
      while (i < lignes.length) {
        const c = lignes[i];
        if (debutListe.test(c) && /^\d+\. /.test(c) === ordonnee) {
          items.push([c.replace(debutListe, "")]);
          i++;
        } else if (/^\s{2,}\S/.test(c)) {
          items[items.length - 1].push(c.replace(/^\s{2,4}/, ""));
          i++;
        } else if (c.trim() === "") {
          let j = i;
          while (j < lignes.length && lignes[j].trim() === "") j++;
          if (j < lignes.length && /^\s{2,}\S/.test(lignes[j])) {
            items[items.length - 1].push("");
            i++;
          } else break;
        } else break;
      }
      const t = ordonnee ? "ol" : "ul";
      const rendu = items.map((it) => {
        const html = versHtml(it.join("\n"));
        const simple = /^<p>[\s\S]*<\/p>$/.test(html) && !html.includes("</p>\n");
        return `<li>${simple ? html.slice(3, -4) : html}</li>`;
      });
      out.push(
        `<${t}${ordonnee && depart !== 1 ? ` start="${depart}"` : ""}>${rendu.join("")}</${t}>`,
      );
    } else {
      const para = [];
      while (i < lignes.length && !estBloc(lignes[i])) para.push(lignes[i++]);
      if (!para.length) para.push(lignes[i++]);
      out.push(`<p>${enLigne(para.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}

const md = readFileSync(SOURCE, "utf8");
const date = new Date().toLocaleDateString("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>CityRésa — scénarios</title>
<style>
  body { font: 10.5pt/1.5 "Segoe UI", system-ui, sans-serif; color: #1f2a24; }
  h1 { font-size: 20pt; color: #0f6b46; margin: 0 0 4pt; border-bottom: 2pt solid #0f6b46; padding-bottom: 4pt; }
  .date { color: #5b6b63; margin-bottom: 12pt; }
  h2 { font-size: 14pt; color: #0f6b46; margin: 18pt 0 6pt; break-after: avoid; }
  h2:not(:first-of-type) { break-before: page; }
  h3 { font-size: 11.5pt; margin: 12pt 0 4pt; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  li { margin: 2pt 0; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 9pt; }
  th, td { border: 0.5pt solid #c9d6cf; padding: 3pt 5pt; vertical-align: top; text-align: left; }
  th { background: #e8f3ed; }
  tr { break-inside: avoid; }
  blockquote { margin: 8pt 0; padding: 4pt 10pt; border-left: 3pt solid #0f6b46; background: #f1f7f3; break-inside: avoid; }
  blockquote p { margin: 2pt 0; }
  code { font-family: Consolas, monospace; font-size: 9pt; background: #f1f4f2; padding: 0 2pt; border-radius: 2pt; }
  pre { background: #f1f4f2; padding: 6pt; font-size: 8.5pt; }
  pre code { padding: 0; }
  hr { border: 0; border-top: 0.5pt solid #c9d6cf; margin: 14pt 0; }
  a { color: #0f6b46; text-decoration: none; }
</style></head><body>
${versHtml(md).replace("</h1>", `</h1><div class="date">Édition du ${date}</div>`)}
</body></html>`;

const fichierHtml = path.join(racine, "docs", ".scenarios-pdf.html");
writeFileSync(fichierHtml, html);
const windows = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? (existsSync(windows) ? windows : undefined),
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(fichierHtml).href, { waitUntil: "load" });
  await page.pdf({
    path: SORTIE,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="font:8pt Segoe UI,sans-serif;color:#5b6b63;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>CityRésa — scénarios de test et de prise en main</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
  });
  console.log(`PDF : ${path.relative(racine, SORTIE)}`);
} finally {
  await browser.close();
  if (!process.env.SCENARIOS_GARDER_HTML) rmSync(fichierHtml, { force: true });
}
