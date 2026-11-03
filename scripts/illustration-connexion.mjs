/**
 * Fabrique l'illustration des pages de connexion, d'inscription et du bandeau d'accueil
 * du portail (public/img/illustration-cityresa.webp) : trois éléments du portail en
 * cascade, coins arrondis, sur fond transparent.
 *
 *   1. capture sur le serveur de développement (pnpm dev, jeu de démo pnpm db:demo) :
 *      le catalogue des espaces, la galerie de photos d'un gymnase, et la carte d'une
 *      réservation (vue par l'usager de démonstration qui en est titulaire) ;
 *   2. composition : cadre blanc arrondi autour des éléments qui n'en ont pas, ombres,
 *      export en WebP.
 *
 *   node scripts/illustration-connexion.mjs
 *
 * Variables facultatives :
 *   CITYRESA_URL           adresse du serveur (défaut http://localhost:3000)
 *   ILLUSTRATION_COMPTE    compte usager (défaut : l'association de basket de la démo)
 *   ILLUSTRATION_MDP       mot de passe (défaut : celui des comptes de démo, lu dans le README)
 *   CHROME_PATH            navigateur à utiliser (défaut : Chrome installé, sinon celui de Puppeteer)
 *
 * Pour changer les éléments ou leur disposition : CAPTURES et SCENE ci-dessous.
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

/**
 * Les captures (rendues en ×2). `selecteur` : un élément seul ; sinon la fenêtre, défilée
 * de `defilement` px. `connecte` : capturée après connexion du compte usager.
 */
const CAPTURES = [
  {
    nom: "catalogue",
    url: "/portail",
    fenetre: [1192, 890],
    defilement: 329,
  },
  {
    nom: "galerie",
    url: "/portail/espaces/gymnase-les-sablons",
    fenetre: [1192, 830],
    selecteur: ".galerie",
  },
  {
    nom: "reservation",
    url: "/portail/mes-reservations?onglet=passees",
    fenetre: [843, 830],
    selecteur: ".resa-carte",
    bloc: ".data-card", // la carte avec son fond blanc et son contour
    connecte: true,
  },
];

/**
 * La scène : largeur des éléments en px dans la scène, position [gauche, haut], et
 * `cadre` = cadre blanc arrondi ajouté autour (pour les éléments sans contour propre).
 */
const SCENE = { largeur: 1120, hauteur: 660 };
const ELEMENTS = [
  { capture: "catalogue", largeur: 700, pos: [0, 0], cadre: true },
  { capture: "galerie", largeur: 560, pos: [530, 170], cadre: true },
  { capture: "reservation", largeur: 690, pos: [150, 470], cadre: false },
];
const CADRE = 10; // épaisseur du cadre blanc (px dans la scène)

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

async function seConnecter(page) {
  await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', COMPTE);
  await page.type('input[name="password"]', motDePasseDemo());
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('form button[type="submit"]'),
  ]);
  if (page.url().includes("/connexion")) throw new Error(`Connexion refusée pour ${COMPTE}.`);
}

const dossier = mkdtempSync(path.join(os.tmpdir(), "cityresa-illustration-"));
const browser = await puppeteer.launch({
  executablePath: cheminChrome(),
  headless: true,
  args: ["--allow-file-access-from-files"],
});
try {
  // 1. Captures : d'abord en visiteur, puis connecté.
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  const tailles = {};
  let connecte = false;
  for (const c of [...CAPTURES].sort((a, b) => Number(a.connecte ?? 0) - Number(b.connecte ?? 0))) {
    if (c.connecte && !connecte) {
      await seConnecter(page);
      connecte = true;
    }
    await page.setViewport({ width: c.fenetre[0], height: c.fenetre[1], deviceScaleFactor: 2 });
    await page.goto(`${BASE}${c.url}`, { waitUntil: "networkidle0" });
    await page.addStyleTag({
      content: "nextjs-portal{display:none!important} html{scroll-behavior:auto!important}",
    });
    const fichier = path.join(dossier, `${c.nom}.png`);
    if (c.selecteur) {
      const el = await page.$(c.selecteur);
      if (!el) throw new Error(`Élément ${c.selecteur} introuvable sur ${c.url}.`);
      const cible = c.bloc ? await el.evaluateHandle((e, b) => e.closest(b) ?? e, c.bloc) : el;
      await new Promise((r) => setTimeout(r, 1000));
      await cible.screenshot({ path: fichier, omitBackground: true });
    } else {
      if (c.defilement) await page.evaluate((y) => window.scrollTo(0, y), c.defilement);
      await new Promise((r) => setTimeout(r, 1000));
      await page.screenshot({ path: fichier });
    }
    const meta = await sharp(fichier).metadata();
    tailles[c.nom] = [meta.width, meta.height];
    console.log(`capturé : ${c.nom} (${c.url})`);
  }

  // 2. Composition.
  const bloc = ({ capture, largeur, pos: [g, t], cadre }) => {
    const [lw, lh] = tailles[capture];
    const hauteur = Math.round((largeur * lh) / lw);
    const src = pathToFileURL(path.join(dossier, `${capture}.png`)).href;
    const style = `left:${g}px;top:${t}px;`;
    return cadre
      ? `<div class="el cadre" style="${style}"><img src="${src}" style="width:${largeur}px;height:${hauteur}px"></div>`
      : `<div class="el" style="${style}"><img src="${src}" style="width:${largeur}px;height:${hauteur}px"></div>`;
  };
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;background:transparent}
    .scene{position:relative;width:${SCENE.largeur}px;height:${SCENE.hauteur}px}
    .el{position:absolute;border-radius:16px;box-shadow:0 30px 60px -18px rgba(5,40,25,.45)}
    .el img{display:block;border-radius:16px}
    .cadre{background:#fff;padding:${CADRE}px;border-radius:${16 + CADRE}px}
    .cadre img{border-radius:12px}
  </style></head><body><div class="scene">${ELEMENTS.map(bloc).join("")}</div></body></html>`;
  const fichierHtml = path.join(dossier, "scene.html");
  writeFileSync(fichierHtml, html);
  const scene = await browser.newPage();
  await scene.setViewport({ width: SCENE.largeur, height: SCENE.hauteur, deviceScaleFactor: 2 });
  await scene.goto(pathToFileURL(fichierHtml).href, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 500));
  const png = await scene.screenshot({ omitBackground: true, type: "png" });
  await sharp(png).webp({ quality: 88 }).toFile(SORTIE);
  console.log(`illustration : ${path.relative(racine, SORTIE)}`);
} finally {
  await browser.close();
  rmSync(dossier, { recursive: true, force: true });
}
