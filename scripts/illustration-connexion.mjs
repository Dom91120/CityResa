/**
 * Fabrique l'illustration des pages de connexion, d'inscription et du bandeau d'accueil
 * du portail (public/img/illustration-cityresa.webp) : trois écrans du portail usager
 * en cascade, sur fond transparent.
 *
 *   1. capture des écrans sur le serveur de développement (pnpm dev), avec un compte
 *      usager de démonstration (pnpm db:demo) ;
 *   2. composition des écrans (coins arrondis, ombres) et export en WebP.
 *
 *   node scripts/illustration-connexion.mjs
 *
 * Variables facultatives :
 *   CITYRESA_URL           adresse du serveur (défaut http://localhost:3000)
 *   ILLUSTRATION_COMPTE    compte usager (défaut : l'association de basket de la démo)
 *   ILLUSTRATION_MDP       mot de passe (défaut : celui des comptes de démo, lu dans le README)
 *   CHROME_PATH            navigateur à utiliser (défaut : Chrome installé, sinon celui de Puppeteer)
 *
 * Pour changer les écrans ou leur cadrage : PAGES et SCENE ci-dessous.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import sharp from "sharp";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = path.join(racine, "public", "img", "illustration-cityresa.webp");
const BASE = process.env.CITYRESA_URL ?? "http://localhost:3000";
const COMPTE = process.env.ILLUSTRATION_COMPTE ?? "redouane.el-bennane@exemple.fr";

/** Les écrans capturés (taille CSS 1440 × 900, rendus en ×2). */
const W = 1440;
const H = 900;
const PAGES = {
  catalogue: "/portail",
  espace: "/portail/espaces/salle-gabriel-peri",
  reservation: "/portail/mes-reservations/1",
};

/**
 * La scène : pour chaque fenêtre, l'écran, la zone découpée [x, y, largeur, hauteur]
 * en px CSS, l'échelle et la position [gauche, haut] dans la scène.
 */
const SCENE = { largeur: 1120, hauteur: 630 };
const FENETRES = [
  { ecran: "catalogue", zone: [0, 0, W, H], echelle: 0.6, pos: [0, 0] },
  { ecran: "espace", zone: [150, 120, 1139, 416], echelle: 0.56, pos: [470, 250] },
  { ecran: "reservation", zone: [150, 80, 760, 180], echelle: 0.74, pos: [70, 470], rayon: 16 },
];

function motDePasseDemo() {
  if (process.env.ILLUSTRATION_MDP) return process.env.ILLUSTRATION_MDP;
  const readme = readFileSync(path.join(racine, "README.md"), "utf8");
  const m = /mot de passe commun \*\*`([^`]+)`\*\*/.exec(readme);
  if (!m) throw new Error("Mot de passe de démo introuvable : définissez ILLUSTRATION_MDP.");
  return m[1];
}

function cheminChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const windows = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  return existsSync(windows) ? windows : undefined;
}

const dossier = mkdtempSync(path.join(os.tmpdir(), "cityresa-illustration-"));
const browser = await puppeteer.launch({
  executablePath: cheminChrome(),
  headless: true,
  args: ["--allow-file-access-from-files"],
});
try {
  // 1. Captures du portail, connecté en usager.
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', COMPTE);
  await page.type('input[name="password"]', motDePasseDemo());
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('form button[type="submit"]'),
  ]);
  if (page.url().includes("/connexion")) throw new Error(`Connexion refusée pour ${COMPTE}.`);
  for (const [nom, url] of Object.entries(PAGES)) {
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle0" });
    // Le bandeau d'accueil contient l'illustration elle-même ; le badge de Next.js est masqué.
    await page.addStyleTag({
      content: "nextjs-portal{display:none!important} .hero{display:none!important}",
    });
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(dossier, `${nom}.png`) });
    console.log(`capturé : ${nom} (${url})`);
  }

  // 2. Composition : chaque fenêtre est un morceau de capture en image de fond.
  const fenetre = ({ ecran, zone: [x, y, l, h], echelle: s, pos: [g, t], rayon = 14 }) =>
    `<div class="fen" style="left:${g}px;top:${t}px;width:${l * s}px;height:${h * s}px;
      border-radius:${rayon}px;background-image:url('${pathToFileURL(path.join(dossier, `${ecran}.png`)).href}');
      background-size:${W * s}px ${H * s}px;background-position:-${x * s}px -${y * s}px"></div>`;
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;background:transparent}
    .scene{position:relative;width:${SCENE.largeur}px;height:${SCENE.hauteur}px}
    .fen{position:absolute;background-repeat:no-repeat;
         box-shadow:0 30px 60px -18px rgba(5,40,25,.45),0 0 0 1px rgba(15,23,42,.06)}
  </style></head><body><div class="scene">${FENETRES.map(fenetre).join("")}</div></body></html>`;
  const fichierHtml = path.join(dossier, "scene.html");
  writeFileSync(fichierHtml, html);
  const scene = await browser.newPage();
  await scene.setViewport({ width: SCENE.largeur, height: SCENE.hauteur, deviceScaleFactor: 2 });
  await scene.goto(pathToFileURL(fichierHtml).href, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 500));
  const png = await scene.screenshot({ omitBackground: true, type: "png" });
  await sharp(png).webp({ quality: 86 }).toFile(SORTIE);
  console.log(`illustration : ${path.relative(racine, SORTIE)}`);
} finally {
  await browser.close();
  rmSync(dossier, { recursive: true, force: true });
}
