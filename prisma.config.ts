import { createRequire } from "node:module";
import { defineConfig } from "prisma/config";

// Prisma 7 : la configuration de la CLI (schema, migrations, seed, datasource) vit ici.
// Chargement DEFENSIF du .env : en production (image Docker minimale), `dotenv` peut etre
// absent et `DATABASE_URL` est deja dans l'environnement.
try {
  createRequire(import.meta.url)("dotenv/config");
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed-init.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
