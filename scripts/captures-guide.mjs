/**
 * Captures d'écran du guide utilisateur (docs/guide/captures/*.webp).
 *
 *   node scripts/captures-guide.mjs [nom…]
 *
 * Prérequis : serveur de développement lancé (pnpm dev) et jeu de démonstration chargé
 * (pnpm db:demo). Les écrans d'administration demandent un compte administrateur :
 * GUIDE_ADMIN / GUIDE_ADMIN_MDP (défaut : ADMIN_EMAIL du .env ; mot de passe à fournir).
 * Sans argument, refait toutes les captures ; sinon seulement celles nommées.
 *
 * Variables facultatives : CITYRESA_URL (défaut http://localhost:3000), CHROME_PATH.
 * Pour ajouter un écran : une ligne dans CAPTURES ci-dessous, puis la référencer dans le guide.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import puppeteer from "puppeteer";
import sharp from "sharp";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = path.join(racine, "docs", "guide", "captures");
const BASE = process.env.CITYRESA_URL ?? "http://localhost:3000";

const readme = readFileSync(path.join(racine, "README.md"), "utf8");
const MDP_DEMO = /mot de passe commun \*\*`([^`]+)`\*\*/.exec(readme)?.[1];

/** Les comptes utilisés (voir README, « Comptes de démonstration »). */
const COMPTES = {
  admin: [
    process.env.GUIDE_ADMIN ?? process.env.ADMIN_EMAIL ?? "admin@localhost",
    process.env.GUIDE_ADMIN_MDP,
  ],
  gestionnaire: ["sophie.martin@exemple.fr"],
  agent: ["karim.benali@exemple.fr"],
  elu: ["pierre.durand@exemple.fr"],
  particulier: ["martine.dupont@exemple.fr"],
  association: ["sandra.da-silva@exemple.fr"],
  basket: ["redouane.el-bennane@exemple.fr"],
  yoga: ["madeleine.legouez@exemple.fr"],
  entreprise: ["isabelle.roux@exemple.fr"],
  avalider: ["josette.nickels@exemple.fr"],
  service: ["lea.fontaine@exemple.fr"],
  twirling: ["sylvie.savignac@exemple.fr"],
};

/**
 * Une capture : `compte` (null = visiteur), `url`, `hauteur` max de la page entière (px CSS),
 * `lien` (texte d'un lien de la page à suivre), `lienVers` (fragment de l'adresse d'un lien à suivre),
 * `clic` (sélecteur cliqué avant la capture), `script` (code exécuté dans la page avant), `selecteur` (un élément seul), `fenetre`.
 */
const CAPTURES = [
  // Accès
  { nom: "connexion", compte: null, url: "/connexion", hauteur: 900 },
  { nom: "inscription", compte: null, url: "/inscription", hauteur: 1500 },
  { nom: "mot-de-passe-oublie", compte: null, url: "/mot-de-passe-oublie", hauteur: 900 },

  // Portail public
  { nom: "portail-accueil", compte: null, url: "/portail", hauteur: 1800 },
  {
    nom: "portail-espace",
    compte: null,
    url: "/portail/espaces/salle-gabriel-peri",
    hauteur: 3200,
  },
  { nom: "portail-accessibilite", compte: null, url: "/portail/accessibilite", hauteur: 1400 },

  // Espace usager : particulier
  {
    nom: "usager-mes-reservations",
    compte: "particulier",
    url: "/portail/mes-reservations",
    hauteur: 1800,
  },
  {
    nom: "usager-demande",
    compte: "particulier",
    url: "/portail/reserver/salle-gabriel-peri",
    hauteur: 3000,
  },
  {
    nom: "usager-dossier-a-signer",
    compte: "particulier",
    url: "/portail/mes-reservations/17",
    hauteur: 2600,
  },
  {
    nom: "usager-dossier-confirme",
    compte: "particulier",
    url: "/portail/mes-reservations/25",
    hauteur: 2600,
  },
  { nom: "usager-messages", compte: "particulier", url: "/portail/mes-messages", hauteur: 1400 },
  { nom: "usager-mon-compte", compte: "particulier", url: "/portail/mon-compte", hauteur: 2400 },

  // Espace usager : association
  {
    nom: "asso-mes-reservations",
    compte: "association",
    url: "/portail/mes-reservations",
    hauteur: 1800,
  },
  {
    nom: "asso-mon-organisation",
    compte: "association",
    url: "/portail/mon-organisation",
    hauteur: 2600,
  },
  {
    nom: "asso-mes-subventions",
    compte: "association",
    url: "/portail/mes-subventions",
    hauteur: 1400,
  },
  {
    nom: "asso-subvention",
    compte: "association",
    url: "/portail/mes-subventions/3",
    hauteur: 2200,
  },
  {
    nom: "asso-dossier-subvention",
    compte: "yoga",
    url: "/portail/mes-subventions/5/dossier/budget",
    hauteur: 2600,
  },
  {
    nom: "asso-subvention-pieces",
    compte: "yoga",
    url: "/portail/mes-subventions/5/dossier/pieces",
    hauteur: 1800,
  },
  {
    nom: "asso-subvention-attestation",
    compte: "yoga",
    url: "/portail/mes-subventions/5/dossier/attestation",
    hauteur: 2600,
  },
  { nom: "asso-mes-voeux", compte: "twirling", url: "/portail/mes-voeux", hauteur: 2200 },
  {
    nom: "asso-dossier-recurrent",
    compte: "association",
    url: "/portail/mes-reservations/2",
    hauteur: 2600,
  },
  { nom: "asso-a-valider", compte: "avalider", url: "/portail/mon-organisation", hauteur: 1800 },

  // Espace usager : entreprise
  {
    nom: "entreprise-dossier-signe",
    compte: "entreprise",
    url: "/portail/mes-reservations/19",
    hauteur: 2600,
  },

  // Back-office : quotidien
  { nom: "tableau-de-bord", compte: "gestionnaire", url: "/", hauteur: 2200 },
  { nom: "recherche", compte: "gestionnaire", url: "/recherche?q=Dupont", hauteur: 1200 },
  { nom: "notifications", compte: "gestionnaire", url: "/notifications", hauteur: 1400 },
  { nom: "profil", compte: "gestionnaire", url: "/profil", hauteur: 2000 },
  { nom: "aide", compte: "gestionnaire", url: "/aide", hauteur: 1800 },

  // Réservations
  { nom: "reservations-liste", compte: "gestionnaire", url: "/reservations", hauteur: 1500 },
  {
    nom: "reservations-a-traiter",
    compte: "gestionnaire",
    url: "/reservations?statut=a_traiter",
    hauteur: 1100,
  },
  { nom: "reservation-a-traiter", compte: "gestionnaire", url: "/reservations/4", hauteur: 3200 },
  { nom: "reservation-acceptee", compte: "gestionnaire", url: "/reservations/17", hauteur: 3200 },
  { nom: "reservation-confirmee", compte: "gestionnaire", url: "/reservations/25", hauteur: 3600 },
  { nom: "reservation-recurrente", compte: "gestionnaire", url: "/reservations/1", hauteur: 3200 },
  {
    nom: "reservation-nouvelle",
    compte: "gestionnaire",
    url: "/reservations/nouvelle?espace=7&date=2026-12-12&organisation=11",
    hauteur: 3400,
  },
  {
    nom: "reservation-modifier",
    compte: "gestionnaire",
    url: "/reservations/4/modifier",
    hauteur: 2400,
  },
  {
    nom: "creneau-modifier",
    compte: "gestionnaire",
    url: "/reservations/1/creneaux/10/modifier",
    hauteur: 1600,
  },
  {
    nom: "creneau-requisition",
    compte: "gestionnaire",
    // L'identifiant du créneau dépend du jeu chargé : on suit le lien de réquisition de la fiche.
    url: "/reservations/25",
    lienVers: "/requisition",
    hauteur: 1800,
  },

  // Planning
  { nom: "planning-semaine", compte: "gestionnaire", url: "/planning", hauteur: 1500 },
  {
    nom: "planning-jour",
    compte: "gestionnaire",
    url: "/planning?vue=jour&date=2027-01-09",
    hauteur: 1500,
  },
  { nom: "planning-mois", compte: "gestionnaire", url: "/planning?vue=mois", hauteur: 1500 },
  { nom: "planning-liste", compte: "gestionnaire", url: "/planning?vue=liste", hauteur: 1500 },
  {
    nom: "planning-semaine-type",
    compte: "gestionnaire",
    url: "/planning/semaine-type",
    hauteur: 1600,
  },
  { nom: "planning-presences", compte: "gestionnaire", url: "/planning/presences", hauteur: 1500 },

  // Campagnes
  { nom: "campagnes", compte: "gestionnaire", url: "/campagnes", hauteur: 1100 },
  { nom: "campagne", compte: "gestionnaire", url: "/campagnes/1", hauteur: 2600 },

  // Sites, espaces, matériel
  { nom: "sites", compte: "gestionnaire", url: "/sites", hauteur: 1400 },
  { nom: "site", compte: "gestionnaire", url: "/sites/1", hauteur: 2200 },
  { nom: "espaces", compte: "gestionnaire", url: "/espaces", hauteur: 1500 },
  { nom: "espace", compte: "gestionnaire", url: "/espaces/5", hauteur: 3600 },
  { nom: "espace-modifier", compte: "gestionnaire", url: "/espaces/5/modifier", hauteur: 3600 },
  { nom: "materiel", compte: "gestionnaire", url: "/materiel", hauteur: 1100 },
  { nom: "materiel-fiche", compte: "gestionnaire", url: "/materiel/1", hauteur: 2000 },

  // Usagers, équipe, messages
  { nom: "usagers", compte: "gestionnaire", url: "/usagers", hauteur: 1500 },
  { nom: "usager-a-valider", compte: "gestionnaire", url: "/usagers/1", hauteur: 2600 },
  { nom: "usager-fiche", compte: "gestionnaire", url: "/usagers/11", hauteur: 2600 },
  { nom: "usager-nouveau", compte: "gestionnaire", url: "/usagers/nouveau", hauteur: 2400 },
  { nom: "messages", compte: "gestionnaire", url: "/messages", hauteur: 1200 },
  { nom: "equipe", compte: "gestionnaire", url: "/equipe", hauteur: 1400 },

  // Personnel de service
  { nom: "personnel-planning", compte: "gestionnaire", url: "/personnel", hauteur: 1500 },
  {
    nom: "personnel-jour",
    compte: "gestionnaire",
    url: "/personnel?vue=jour&date=2026-12-02",
    hauteur: 1300,
  },
  {
    nom: "personnel-a-couvrir",
    compte: "gestionnaire",
    url: "/personnel?onglet=a_couvrir",
    hauteur: 1100,
  },
  {
    nom: "personnel-personnes",
    compte: "gestionnaire",
    url: "/personnel/personnes",
    hauteur: 1100,
  },
  { nom: "personnel-fiche", compte: "gestionnaire", url: "/personnel/personnes/2", hauteur: 2600 },
  {
    nom: "personnel-propositions",
    compte: "gestionnaire",
    url: "/personnel?onglet=propositions",
    hauteur: 1400,
  },

  // Paiements
  { nom: "paiements", compte: "gestionnaire", url: "/paiements", hauteur: 1500 },
  { nom: "facture", compte: "gestionnaire", url: "/paiements/5", hauteur: 1800 },
  { nom: "facture-nouvelle", compte: "gestionnaire", url: "/paiements/nouvelle", hauteur: 1600 },

  // Subventions et valorisation
  { nom: "subventions", compte: "gestionnaire", url: "/subventions", hauteur: 1500 },
  {
    nom: "subventions-campagne",
    compte: "gestionnaire",
    url: "/subventions/campagnes",
    hauteur: 900,
  },
  {
    nom: "subvention-dossier-fiche",
    compte: "gestionnaire",
    url: "/subventions/5/dossier/budget",
    hauteur: 2400,
  },
  { nom: "subvention-instruction", compte: "gestionnaire", url: "/subventions/3", hauteur: 3200 },
  { nom: "subvention-elu", compte: "elu", url: "/subventions/3", hauteur: 2600 },
  { nom: "valorisation", compte: "gestionnaire", url: "/valorisation", hauteur: 1600 },

  // Statistiques et tableaux de bord
  { nom: "statistiques", compte: "gestionnaire", url: "/statistiques", hauteur: 3000 },
  { nom: "tableau-de-bord-elu", compte: "elu", url: "/", hauteur: 1800 },
  { nom: "tableau-de-bord-agent", compte: "agent", url: "/", hauteur: 1800 },

  // Administration
  { nom: "parametres", compte: "admin", url: "/parametres", hauteur: 2200 },
  {
    nom: "parametres-reservations",
    compte: "admin",
    url: "/parametres",
    clic: "#ong-reservations",
    hauteur: 3000,
  },
  {
    nom: "parametres-modules",
    compte: "admin",
    url: "/parametres",
    clic: "#ong-modules",
    hauteur: 1800,
  },
  {
    nom: "parametres-convention",
    compte: "admin",
    url: "/parametres",
    clic: "#ong-convention",
    hauteur: 1800,
  },
  { nom: "utilisateurs", compte: "admin", url: "/utilisateurs", hauteur: 1100 },
  {
    nom: "utilisateur",
    compte: "admin",
    // L'identifiant d'un compte change à chaque rechargement du jeu de démonstration :
    // la fiche s'ouvre en suivant le lien de la liste.
    url: "/utilisateurs",
    lien: "Karim Benali",
    hauteur: 2000,
  },
  { nom: "roles", compte: "admin", url: "/roles", hauteur: 2200 },
  { nom: "referentiels", compte: "admin", url: "/referentiels", hauteur: 2000 },
  { nom: "calendrier", compte: "admin", url: "/calendrier", hauteur: 2400 },
  { nom: "modeles-courriel", compte: "admin", url: "/modeles-courriel", hauteur: 1600 },
  {
    nom: "modele-courriel",
    compte: "admin",
    url: "/modeles-courriel/reservation_acceptee",
    hauteur: 1800,
  },
  { nom: "audit", compte: "admin", url: "/audit?categorie=reservations", hauteur: 1300 },
  { nom: "taches", compte: "admin", url: "/taches", hauteur: 1500 },
  {
    nom: "sauvegardes",
    compte: "admin",
    url: "/sauvegardes",
    hauteur: 1100,
    // Le dossier du poste de développement est remplacé par un chemin de serveur.
    script: `for (const c of document.querySelectorAll("code")) if (/^[A-Z]:[\\\\/]/.test(c.textContent)) c.textContent = "/srv/cityresa/backups";`,
  },
];

const FENETRE = [1440, 900];
const ECHELLE = 1.5;

function cheminChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const windows = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  return existsSync(windows) ? windows : undefined;
}

async function seConnecter(page, cle) {
  const [email, mdp] = COMPTES[cle];
  await page.goto(`${BASE}/deconnexion`, { waitUntil: "networkidle0" }).catch(() => {});
  const client = await page.createCDPSession();
  await client.send("Network.clearBrowserCookies");
  await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', mdp ?? MDP_DEMO);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('form button[type="submit"]'),
  ]);
  if (page.url().includes("/connexion")) throw new Error(`Connexion refusée pour ${email}.`);
}

const demandes = process.argv.slice(2);
const liste = demandes.length ? CAPTURES.filter((c) => demandes.includes(c.nom)) : CAPTURES;
mkdirSync(SORTIE, { recursive: true });

const browser = await puppeteer.launch({ executablePath: cheminChrome(), headless: true });
try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.setViewport({ width: FENETRE[0], height: FENETRE[1], deviceScaleFactor: ECHELLE });
  // Regroupés par compte pour ne se connecter qu'une fois chacun.
  const ordre = [...liste].sort((a, b) => String(a.compte).localeCompare(String(b.compte)));
  let courant;
  for (const c of ordre) {
    if (c.compte !== courant) {
      if (c.compte) await seConnecter(page, c.compte);
      else {
        const client = await page.createCDPSession();
        await client.send("Network.clearBrowserCookies");
      }
      courant = c.compte;
    }
    let rep = await page.goto(`${BASE}${c.url}`, { waitUntil: "networkidle0", timeout: 120_000 });
    if ((c.lien || c.lienVers) && (rep?.status() ?? 0) < 400) {
      const href = await page.evaluate(
        (texte, vers) =>
          [...document.querySelectorAll("main a")]
            .find((a) =>
              vers ? (a.getAttribute("href") ?? "").includes(vers) : a.textContent.includes(texte),
            )
            ?.getAttribute("href"),
        c.lien ?? "",
        c.lienVers ?? "",
      );
      if (!href) {
        console.warn(
          `! ${c.nom} : lien « ${c.lien ?? c.lienVers} » introuvable, capture conservée`,
        );
        continue;
      }
      rep = await page.goto(`${BASE}${href}`, { waitUntil: "networkidle0", timeout: 120_000 });
    }
    // Une page en erreur (identifiant absent de la base…) ne remplace pas la capture existante.
    if ((rep?.status() ?? 0) >= 400) {
      console.warn(`! ${c.nom} : HTTP ${rep?.status()}, capture conservée`);
      continue;
    }
    await page.addStyleTag({
      content:
        "nextjs-portal{display:none!important} html{scroll-behavior:auto!important} *{transition:none!important;animation:none!important}",
    });
    if (c.script) await page.evaluate(c.script);
    if (c.clic) {
      await page.click(c.clic);
      await new Promise((r) => setTimeout(r, 400));
    }
    await new Promise((r) => setTimeout(r, 600));
    const png = c.selecteur
      ? await (await page.$(c.selecteur)).screenshot()
      : await (async () => {
          const totale = await page.evaluate(() => document.documentElement.scrollHeight);
          const h = Math.min(totale, c.hauteur ?? FENETRE[1]);
          // Fenêtre à la hauteur capturée : la barre latérale (100vh) suit.
          await page.setViewport({ width: FENETRE[0], height: h, deviceScaleFactor: ECHELLE });
          await new Promise((r) => setTimeout(r, 400));
          const img = await page.screenshot();
          await page.setViewport({
            width: FENETRE[0],
            height: FENETRE[1],
            deviceScaleFactor: ECHELLE,
          });
          return img;
        })();
    await sharp(png)
      .webp({ quality: 82 })
      .toFile(path.join(SORTIE, `${c.nom}.webp`));
    console.log(
      `capturé : ${c.nom} (${c.compte ?? "visiteur"} ${c.url}) ${page.url() !== `${BASE}${c.url}` ? `→ ${page.url()}` : ""}`,
    );
  }
} finally {
  await browser.close();
}
