# CityRésa

Gestion des réservations d'espaces municipaux (salles, gymnases, terrains, matériel), des
usagers (associations, entreprises, particuliers, services) et des demandes de subvention des
associations, pour la **Ville de Châtillon (92320)**.

Next.js 16 (App Router) · Prisma 7 / PostgreSQL 18 · Better Auth · Bootstrap 5 + charte
charte rose · Vitest · Docker Compose.

## Ce que fait l'application

**Portail public (usagers)**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Ville de Châtillon · Réservez une salle ou un équipement de la ville │
├──────────────────────────────────────────────────────────────────────┤
│ [Site ▾] [Nature ▾] [Capacité ≥ ___] [Équipements ▾] [Date ______]   │
│                                                                      │
│  ┌ Salle des fêtes ─────────┐  ┌ Gymnase omnisports ───────┐         │
│  │ (photo)                  │  │ (photo)                   │         │
│  │ 250 assis · 380 m²       │  │ 500 debout · tribunes     │         │
│  │ Scène · Cuisine · PMR    │  │ Vestiaires · Douches      │         │
│  │ À partir de 350 € / soir.│  │ Gratuit (assoc. commune)  │         │
│  └──────────────────────────┘  └───────────────────────────┘         │
└──────────────────────────────────────────────────────────────────────┘
```

Catalogue avec filtres, fiche d'espace (photos, équipements, horaires, tarifs du profil,
règlement, calendrier de disponibilité, carte), compte usager, demande en ligne avec
récurrences et **devis en direct**, suivi des dossiers, messagerie, **signature électronique de
la convention par code SMS**, factures, annulation, flux ICS personnel, demandes de subvention.

**Back-office (agents)**

```
┌ CityRésa ─────────┬───────────────────────────────────────────────────┐
│ Tableau de bord   │ Réservations  47        [À traiter 7] [En trait. 4]│
│ Réservations  ●7  │                                                   │
│ Planning          │ N°            Espace          Dates        Statut │
│ Sites et espaces  │ RES-2026-0005 Salle des fêtes Sam. 02 janv. ● À tr.│
│ Matériel          │ RES-2026-0006 Auditorium      Jeu. 15 déc.  ● À tr.│
│ Usagers       ●1  │ RES-2026-0016 Salle des fêtes Dim. 29 nov.  ● Acc. │
│ Messages      ●3  │ …                                                 │
│ Paiements         │                                                   │
│ Subventions   ●2  │                               ‹ 1 2 3 ›  25 / page│
│ Statistiques      │                                                   │
│ Paramètres        │                                                   │
└───────────────────┴───────────────────────────────────────────────────┘
```

Traitement des demandes (statuts, motifs, notes internes, historique), planning multi-espaces,
sites / espaces / sous-espaces modulables / tarifs par profil / options / indisponibilités,
matériel et stocks, organisations et comptes, conventions PDF et signature, factures
(acompte, solde, caution) et paiements, module ASSO (instruction, avis des élus, vote,
versement), notifications et modèles de courriel, statistiques et export Excel, rôles et
permissions par catégorie, référentiels, audit, tâches planifiées, sauvegardes.

Le périmètre détaillé et les règles de gestion sont dans [`docs/CAHIER-DES-CHARGES.md`](docs/CAHIER-DES-CHARGES.md).

## Démarrage en développement

Prérequis : Node.js ≥ 22, pnpm 11 (`corepack enable`), Docker.

```powershell
# 1. PostgreSQL 18 local (port 5435, conteneur cityresa-pg)
docker run -d --name cityresa-pg -p 5435:5432 `
  -e POSTGRES_USER=cityresa -e POSTGRES_PASSWORD=cityresa -e POSTGRES_DB=cityresa `
  -v cityresa-pgdata:/var/lib/postgresql postgres:18-alpine

# 2. Dépendances (génère aussi le client Prisma)
pnpm install

# 3. Configuration
cp .env.example .env
#   DATABASE_URL=postgresql://cityresa:cityresa@localhost:5435/cityresa?schema=public
#   BETTER_AUTH_SECRET=<openssl rand -base64 32>   CRON_SECRET=<openssl rand -hex 24>
#   ADMIN_EMAIL=admin@chatillon92.fr               DEV_SCHEDULER=true

# 4. Schéma, amorçage, jeu de démonstration
pnpm db:migrate      # migrations Prisma (dev)
pnpm db:init         # rôles, référentiels, modèles de courriel, compte admin (mot de passe affiché)
pnpm db:demo         # sites, espaces (photos générées), usagers, réservations, factures, subventions

# 5. Serveur de développement
pnpm dev             # http://localhost:3000  (portail : /portail)
```

Sans SMTP, les courriels sont simulés et journalisés ; le fournisseur SMS `console` écrit les
codes de signature dans la console du serveur.

## Comptes de démonstration

Chargés par `pnpm db:demo` (mot de passe commun **`Demo-2026!!`**, adresses fictives
`@exemple.fr`). Le compte administrateur et son mot de passe sont ceux affichés par `pnpm db:init`.

| Rôle                   | Compte                           | Qui                                                                                                          |
| ---------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Gestionnaire           | `sophie.martin@exemple.fr`       | Sophie Martin — Vie associative et location de salles (Espace Maison Blanche, salles de quartier)            |
| Agent                  | `karim.benali@exemple.fr`        | Karim Benali — équipements sportifs (gymnases, stade, salle sportive, terrain multisport)                    |
| Élu                    | `pierre.durand@exemple.fr`       | Pierre Durand — adjoint au maire (avis sur les subventions)                                                  |
| Association            | `redouane.el-bennane@exemple.fr` | Association sportive Châtillon Basket - ASCB (créneau hebdomadaire au gymnase les Sablons, subvention votée) |
| Association            | `jean-luc.vandamme@exemple.fr`   | Tennis de Table Municipal de Châtillon - TTMC                                                                |
| Association            | `sandra.da-silva@exemple.fr`     | Around dance                                                                                                 |
| Association            | `sylvie.savignac@exemple.fr`     | Sport Gym Danse Twirling 92                                                                                  |
| Association extérieure | `josette.nickels@exemple.fr`     | GAMA, aïkido (Fontenay-aux-Roses) — fiche **à valider**                                                      |
| Entreprise             | `julien.bernard@exemple.fr`      | Atelier Numérique SAS                                                                                        |
| Entreprise             | `isabelle.roux@exemple.fr`       | Médéric Formation (Boulogne)                                                                                 |
| Particulier            | `martine.dupont@exemple.fr`      | Martine Dupont (Châtillon)                                                                                   |
| Particulier extérieur  | `antoine.garcia@exemple.fr`      | Antoine Garcia (Vanves)                                                                                      |
| Service interne        | `lea.fontaine@exemple.fr`        | Service Culturel                                                                                             |

Le jeu contient les 8 salles et 8 équipements sportifs de la ville (13 sites, 16 espaces), les
41 associations sportives du guide des sports 2023-2024 (un compte `prenom.nom@exemple.fr` chacune,
voir `prisma/seed-associations.ts`),
6 matériels, une cinquantaine de réservations à tous les statuts sur −3 / +3 mois (dont des
récurrences hebdomadaires et mensuelle), des messages, des factures et paiements, 4 demandes de
subvention et des notifications. Les dossiers « acceptés » se signent avec le code **`123456`**.
`pnpm db:demo --reset` vide les tables métier et recharge le jeu (l'administrateur, les rôles,
les référentiels et la configuration sont conservés).

## Commandes

| Commande                                     | Effet                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`                                   | Serveur de développement (port 3000).                                     |
| `pnpm build` / `pnpm start`                  | Build de production (standalone) et démarrage.                            |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Biome, TypeScript, Vitest (tests unitaires purs, sans base).              |
| `pnpm biome check --write .`                 | Corrige le formatage.                                                     |
| `pnpm db:migrate` / `pnpm db:deploy`         | Migrations Prisma (dev / production).                                     |
| `pnpm db:init`                               | Amorçage idempotent (rôles, référentiels, modèles, admin, configuration). |
| `pnpm db:demo [--reset]`                     | Jeu de données de démonstration.                                          |
| `pnpm db:studio`                             | Prisma Studio.                                                            |
| `node scripts/build-lucide-sprite.mjs`       | Régénère le sprite d'icônes après ajout d'une icône.                      |

## Structure

```
prisma/              schema.prisma, migrations, seed-init.ts (amorçage), seed-demo.ts (démo)
src/lib/             logique PURE testée : constantes, créneaux et récurrences, tarification,
                     libellés français, dates Paris, périodes, utilitaires de formulaire
src/server/          services : db, auth, guards (droits), config-store, reservations, convention,
                     signature, factures, mailer, sms, notifications, documents, dashboard,
                     recherche, ics, taches / jobs-registre, db-backup, amorcage, log…
src/modules/<x>/     server.ts (lecture des formulaires, requêtes) + vues.tsx d'un module
src/components/      gabarits partagés (shell, liste, fiche, formulaire, macros, documents)
src/app/(app)/       back-office (agents)        src/app/(portail)/   portail et espace usager
src/app/(auth)/      connexion, 2FA, inscription src/app/envoi/       gestionnaires POST
src/app/api/         JSON (auth, cron, devis, disponibilités, notifications)
src/app/ics/         flux iCalendar              public/              CSS, JS, icônes
cron/                conteneur cron (crontab, backup.sh)
docs/                CONVENTIONS.md, CAHIER-DES-CHARGES.md, DEPLOY.md
Documents/           cahier des charges d'origine (Synbird, AgoraManager, Mariloo)
```

## Documentation

- [`docs/CAHIER-DES-CHARGES.md`](docs/CAHIER-DES-CHARGES.md) — périmètre fonctionnel, acteurs,
  parcours, règles de gestion, couverture du cahier des charges d'origine, limites.
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — déploiement Docker Compose, reverse proxy TLS, cron,
  sauvegardes et restauration, SMTP, SMS, mise à jour, dépannage.
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — conventions de développement (pages, fiches,
  formulaires, gestionnaires POST, droits, services).
- [`CLAUDE.md`](CLAUDE.md) — repères pour les agents de développement.
