/**
 * Initialisation d'une base : rôles, référentiels, modèles de courriel, compte
 * administrateur (mot de passe aléatoire affiché en console, ou ADMIN_INITIAL_PASSWORD),
 * configuration copiée du .env si la table est vide. Idempotent.
 *
 *   pnpm db:init
 */
import "dotenv/config";
import { amorcer } from "@/server/amorcage";
import { prisma } from "@/server/db";

amorcer({ annoncer: true })
  .then(() => console.log("✓ Initialisation terminée."))
  .catch((e) => {
    console.error(e instanceof Error ? `✗ ${e.message}` : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
