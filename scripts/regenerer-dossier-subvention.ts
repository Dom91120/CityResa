/**
 * Régénère le PDF enregistré des dossiers de subvention depuis la ligne de commande (même service
 * que le dépôt), par exemple après un changement de présentation du dossier :
 *
 *   pnpm tsx scripts/regenerer-dossier-subvention.ts           # les dossiers qui ont déjà un PDF enregistré
 *   pnpm tsx scripts/regenerer-dossier-subvention.ts 3 4       # ces dossiers-là, PDF enregistré ou non
 *   pnpm tsx scripts/regenerer-dossier-subvention.ts --deposes # tous les dossiers déposés
 *
 * Les brouillons n'ont pas de PDF enregistré : le leur se produit à la demande.
 */
import "dotenv/config";
import { chargerSubvention } from "@/modules/subventions/server";
import { prisma } from "@/server/db";
import { genererDossierPdf } from "@/server/subventions-dossier";

async function cibles(args: string[]): Promise<number[]> {
  const ids = args.filter((a) => /^\d+$/.test(a)).map(Number);
  if (ids.length) return ids;
  const deposes = args.includes("--deposes");
  const inconnus = args.filter((a) => a !== "--deposes");
  if (inconnus.length)
    throw new Error(
      `Argument inconnu : ${inconnus.join(" ")}. Usage : tsx scripts/regenerer-dossier-subvention.ts [id…] [--deposes]`,
    );
  const lignes = await prisma.subvention.findMany({
    where: deposes
      ? { status: { not: "brouillon" } }
      : {
          OR: [{ dossierDocumentId: { not: null } }, { documents: { some: { kind: "dossier" } } }],
        },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return lignes.map((l) => l.id);
}

async function main() {
  const ids = await cibles(process.argv.slice(2));
  if (!ids.length) {
    console.log("Aucun dossier à régénérer : aucun n'a de PDF enregistré.");
    return;
  }
  for (const id of ids) {
    const s = await chargerSubvention(id);
    if (!s) {
      console.warn(`Dossier ${id} introuvable, ignoré.`);
      continue;
    }
    if (s.status === "brouillon") {
      console.warn(`Dossier ${s.numero} en rédaction, ignoré : son PDF se produit à la demande.`);
      continue;
    }
    const docId = await genererDossierPdf(s, "script");
    console.log(`Dossier ${s.numero} édité : document #${docId}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // Le navigateur du générateur PDF reste ouvert : on termine le processus explicitement.
    process.exit(process.exitCode ?? 0);
  });
