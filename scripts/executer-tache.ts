/**
 * Exécute une tâche planifiée hors interface : pnpm tsx scripts/executer-tache.ts <id>
 * (identifiants dans src/server/jobs-registre.ts : options, rappels_usagers, relances_signature…).
 */
import "dotenv/config";
import { prisma } from "@/server/db";
import { TACHES } from "@/server/taches";

async function main() {
  const id = process.argv[2];
  const t = TACHES[id];
  if (!t) throw new Error(`tâche inconnue : ${id}`);
  console.log(await t());
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
