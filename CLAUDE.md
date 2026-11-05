# CLAUDE.md

« CityRésa » : gestion des réservations des espaces municipaux (salles, équipements sportifs,
matériel), des usagers (associations, entreprises, particuliers, services) et des demandes de
subvention des associations, pour la Ville de Châtillon. Même socle technique que
`../sentinelle-next` (Next.js 16, Prisma 7 / PostgreSQL 18, Better Auth, Bootstrap + feuille
maison, formulaires POST réécrits vers `/envoi`, CSP à nonce). Thème Vert.
Les conventions de code vivent dans `docs/CONVENTIONS.md`, le périmètre fonctionnel dans
`docs/CAHIER-DES-CHARGES.md`.

## Commandes

```powershell
pnpm dev                 # serveur de développement (port 3000)
pnpm lint ; pnpm typecheck ; pnpm test
pnpm build
pnpm db:migrate          # migrations Prisma (dev)
pnpm db:init             # rôles, référentiels, modèles de courriel, compte admin
pnpm db:demo             # jeu de données de démonstration (sites, espaces, usagers, réservations)
node scripts/build-lucide-sprite.mjs   # régénère public/vendor/lucide.svg après ajout d'une icône
pnpm illustration        # refait l'illustration de la connexion (captures du portail, serveur dev + démo)
pnpm tsx scripts/regenerer-convention.ts <id>   # réédite la convention d'un dossier hors interface
```

Base locale : conteneur Docker `cityresa-pg` (PostgreSQL 18, port 5435) ; voir `.env.example`.

## Conventions

- UI et messages en français. Deux populations : AGENTS (back-office, `src/app/(app)`) et
  USAGERS (portail, `src/app/(portail)`). Droits par catégorie et par rôle (`src/server/guards.ts`).
- Toute écriture passe par une route POST sous `src/app/envoi/…` : CSRF vérifié, session requise
  puis `requireEdit` / `requireDelete` / `requireAdmin` / `requireUsager`.
- Toute règle métier (créneaux, récurrences, tarifs, transitions de statut) vit dans `src/lib`
  (pure, testée) ou `src/server/reservations.ts` ; les pages n'en réimplémentent aucune.
- Un module entier se déclare dans `src/server/features.ts` ; un réglage dans
  `src/server/config-store.ts` (clé `MANAGED`, repli `.env`).
- Dates : instants `timestamptz` en base, saisie et affichage en heure de Paris (`src/lib/paris-time.ts`).
- Schéma : toute évolution passe par une migration Prisma.
- Compte admin : mot de passe aléatoire affiché en console, jamais de mot de passe par défaut.
