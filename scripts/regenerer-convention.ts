/**
 * Régénère la convention d'un dossier depuis la ligne de commande (même service que le bouton
 * de la fiche) : pnpm tsx scripts/regenerer-convention.ts <id>
 */
import "dotenv/config";
import { genererConvention } from "@/server/convention";
import { prisma } from "@/server/db";
import { chargerReservation } from "@/server/reservations";

async function main() {
  const id = Number(process.argv[2]);
  if (!Number.isInteger(id)) throw new Error("Usage : tsx scripts/regenerer-convention.ts <id>");
  const r = await chargerReservation(id);
  if (!r) throw new Error(`Dossier ${id} introuvable`);
  const docId = await genererConvention(r, "script");
  console.log(`Convention de ${r.numero} éditée : document #${docId}`);
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
