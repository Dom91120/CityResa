/**
 * Audit d'accessibilité automatisé (règles RGAA de src/lib/accessibilite.ts) sur les pages
 * de l'application, via Chromium headless (Puppeteer, déjà utilisé pour les PDF).
 *
 *   pnpm tsx scripts/audit-accessibilite.ts [url…]
 *
 * Variables : AUDIT_BASE (défaut : APP_BASE_URL ou http://localhost:3000),
 * AUDIT_EMAIL / AUDIT_MDP (un compte pour auditer les pages connectées : agent ou usager).
 * Sans argument, audite les pages publiques du portail, puis, si un compte est fourni, les
 * pages principales de sa population. Sortie non nulle s'il reste un manquement majeur.
 */
import "dotenv/config";
import puppeteer from "puppeteer";
import { aDesMajeurs, auditer, rapport, type Violation } from "@/lib/accessibilite";
import { extraireInstantane } from "@/lib/accessibilite-extracteur";

const PUBLIQUES = [
  "/portail",
  "/connexion",
  "/portail/accessibilite",
  "/portail/mentions-legales",
  "/portail/donnees-personnelles",
];
const USAGER = [
  "/portail/mes-reservations",
  "/portail/mon-compte",
  "/portail/mon-organisation",
  "/portail/mes-messages",
];
const AGENT = [
  "/",
  "/reservations",
  "/planning",
  "/espaces",
  "/usagers",
  "/materiel",
  "/statistiques",
  "/parametres",
];

async function main() {
  const base = (
    process.env.AUDIT_BASE ??
    process.env.APP_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const email = process.env.AUDIT_EMAIL;
  const mdp = process.env.AUDIT_MDP;
  const explicites = process.argv.slice(2);
  const b = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await b.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const resultats: { url: string; violations: Violation[] }[] = [];
  const auditerUrl = async (chemin: string) => {
    const rep = await page.goto(`${base}${chemin}`, { waitUntil: "networkidle0", timeout: 60_000 });
    const statut = rep?.status() ?? 0;
    if (statut >= 400) {
      resultats.push({
        url: chemin,
        violations: [
          {
            regle: `Page en erreur (HTTP ${statut}).`,
            rgaa: "—",
            gravite: "majeur",
            elements: [chemin],
          },
        ],
      });
      return;
    }
    // tsx (esbuild) décore les fonctions d’un appel __name : on le neutralise dans la page.
    await page.evaluate("globalThis.__name = (f) => f");
    const instantane = await page.evaluate(extraireInstantane);
    resultats.push({ url: instantane.url, violations: auditer(instantane) });
  };
  try {
    let population: "agent" | "usager" | null = null;
    if (email && mdp) {
      await page.goto(`${base}/connexion`, { waitUntil: "networkidle0" });
      await page.type('input[name="email"]', email);
      await page.type('input[name="password"]', mdp);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle0" }),
        page.click('button[type="submit"]'),
      ]);
      population = page.url().includes("/portail") ? "usager" : "agent";
      console.log(`Connecté : ${email} (${population}) → ${page.url()}`);
    }
    const liste = explicites.length
      ? explicites
      : [...PUBLIQUES, ...(population === "usager" ? USAGER : population === "agent" ? AGENT : [])];
    // Git Bash sous Windows transforme « /portail » en chemin de fichier : on ne garde que la fin.
    const SECTIONS =
      "portail|reservations|planning|espaces|usagers|materiel|statistiques|parametres|connexion";
    const normaliser = (a: string) => {
      const sansDisque = /^[A-Za-z]:[\\/]/.test(a)
        ? a.replace(new RegExp(`^.*?(?=/(?:${SECTIONS})(?:/|$))`), "")
        : a;
      return `/${sansDisque.replace(/^\/+/, "")}`;
    };
    for (const chemin of liste) await auditerUrl(normaliser(chemin));
  } finally {
    await b.close();
  }
  console.log(rapport(resultats));
  process.exitCode = aDesMajeurs(resultats) ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
