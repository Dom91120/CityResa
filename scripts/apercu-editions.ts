/**
 * Aperçu des éditions au format calendrier, hors interface : écrit dans un dossier le PDF et
 * une image PNG du planning hebdomadaire d'un espace, de sa semaine type et de sa feuille de
 * salle. pnpm tsx scripts/apercu-editions.ts <espaceId> <lundi YYYY-MM-DD> <dossier de sortie>
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";
import { saisonActive } from "@/server/calendrier";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import {
  evtsDeSeries,
  htmlFeuilleSalle,
  htmlPlanningSemaine,
  libellesJours,
  libellesJoursType,
  occupationsSemaine,
  pdfFeuilleSalle,
  pdfPlanningSemaine,
  qrSvg,
  seriesSemaineType,
  urlPublique,
} from "@/server/editions";

async function png(html: string, chemin: string, largeur: number, hauteur: number) {
  const b = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await b.newPage();
    await page.setViewport({ width: largeur, height: hauteur, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: chemin, fullPage: true });
  } finally {
    await b.close();
  }
}

async function main() {
  const espaceId = Number(process.argv[2]);
  const lundi = process.argv[3];
  const sortie = process.argv[4];
  if (!espaceId || !lundi || !sortie) throw new Error("Usage : <espaceId> <lundi> <dossier>");
  mkdirSync(sortie, { recursive: true });
  const e = await prisma.espace.findUniqueOrThrow({
    where: { id: espaceId },
    include: { site: true },
  });
  const cfg = await getSettings();
  const grille = {
    espace: { id: e.id, name: e.name, site: e.site.name },
    jours: libellesJours(lundi),
    evts: await occupationsSemaine([e.id], lundi),
  };
  const planning = {
    titre: "Planning hebdomadaire",
    sousTitre: `Semaine du ${grille.jours[0]} au ${grille.jours[6]}`,
    format: "A4" as const,
    collectivite: cfg.COLLECTIVITE_NOM,
    grilles: [grille],
  };
  writeFileSync(join(sortie, "planning.pdf"), await pdfPlanningSemaine(planning));
  await png(htmlPlanningSemaine(planning), join(sortie, "planning.png"), 1123, 794);
  const saison = await saisonActive();
  if (saison) {
    const type = {
      ...planning,
      titre: `Semaine type · ${saison.label}`,
      sousTitre: `Semaine type · saison ${saison.label}`,
      format: "A3" as const,
      grilles: [
        {
          ...grille,
          jours: libellesJoursType(),
          evts: evtsDeSeries(await seriesSemaineType([e.id], saison)),
        },
      ],
    };
    writeFileSync(join(sortie, "semaine-type.pdf"), await pdfPlanningSemaine(type));
    await png(htmlPlanningSemaine(type), join(sortie, "semaine-type.png"), 1587, 1123);
  }
  const url = await urlPublique(e.slug);
  const feuille = {
    espace: {
      name: e.name,
      site: e.site.name,
      adresse: [e.site.address, e.site.city].filter(Boolean).join(", "),
      instructions: e.instructions,
      rules: e.rules,
    },
    lundi,
    evts: grille.evts,
    url,
    qr: await qrSvg(url),
    collectivite: cfg.COLLECTIVITE_NOM,
  };
  writeFileSync(join(sortie, "feuille.pdf"), await pdfFeuilleSalle(feuille));
  await png(htmlFeuilleSalle(feuille), join(sortie, "feuille.png"), 794, 1123);
  console.log("OK", sortie);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
