# CityRésa — déploiement en production

Stack auto-hébergée avec Docker Compose : `app` (Next.js standalone + Prisma), `db`
(PostgreSQL 18), `cron` (déclencheur des tâches planifiées). L'application écoute en HTTP sur
`127.0.0.1:3000` ; un **reverse proxy TLS externe** (Caddy, Nginx, Traefik) la publie sur
Internet.

## 1. Prérequis

- Un serveur Linux (Debian 12 / Ubuntu 24.04 recommandés), 2 vCPU, 4 Go de RAM, 20 Go de disque
  (les pièces jointes sont stockées en base : prévoir la croissance).
- Docker Engine ≥ 24 et le plugin Docker Compose v2.
- Un nom de domaine pointant vers le serveur (ex. `reservations.ville-chatillon.fr`).
- Un compte SMTP d'envoi (Office 365, OVH, Brevo…) et, pour la signature par SMS, une passerelle
  HTTP (§ 8).
- Ports : 80 et 443 ouverts vers le reverse proxy ; 3000 et 5432 restent locaux.

Sans Docker (installation « nue »), il faut Node.js ≥ 22, pnpm 11, PostgreSQL ≥ 16, Chromium
(PDF) et `pg_dump` 18 ; les étapes sont les mêmes avec `pnpm build && pnpm start`.

## 2. Récupérer le code et configurer `.env`

```bash
git clone <dépôt> cityresa && cd cityresa
cp .env.example .env
```

Renseigner dans `.env` au minimum :

| Variable | Rôle |
| --- | --- |
| `APP_DOMAIN`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL` | Domaine public et URL complète vue par les navigateurs (`https://reservations.ville-chatillon.fr`), utilisée dans les courriels et par l'authentification. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Compte et base PostgreSQL du conteneur `db` ; `DATABASE_URL` est construite automatiquement par `docker-compose.yml`. |
| `BETTER_AUTH_SECRET` | Racine de tout ce qui est chiffré ou signé (sessions, secrets TOTP, mots de passe SMTP / SMS chiffrés en base, codes de signature). `openssl rand -base64 32`. **Ne jamais le changer** après la mise en service sans plan de rechiffrement. |
| `CRON_SECRET` | Secret partagé entre le conteneur `cron` et `/api/cron/*`. `openssl rand -hex 24`. |
| `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` | Compte administrateur créé par `db:init` (mot de passe aléatoire affiché en console si vide). |
| `TRUST_PROXY=true` | Derrière le reverse proxy, pour lire `X-Forwarded-For` (journal, limitation de connexions, IP de signature). |
| `SESSION_LIFETIME_MINUTES`, `PASSWORD_MIN_LENGTH`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `REQUIRE_2FA_ADMIN` | Sécurité (lus dans l'environnement seul). |
| `COLLECTIVITE_*`, `MAIL_*`, `SMS_*`, `*_ENABLED`, `TVA_TAUX`, `ACOMPTE_PCT`… | **Valeurs de départ** copiées en base au premier démarrage, puis gérées depuis **Paramètres** dans l'application. Le `.env` ne sert ensuite que de repli. |
| `BACKUP_DB_KEEP` | Nombre de sauvegardes conservées (le dossier est `/backups` dans le conteneur, `./backups` sur l'hôte). |

Le `.env` ne doit être lisible que par l'administrateur système (`chmod 600 .env`).

## 3. Démarrer

```bash
docker compose up -d --build        # construit l'image, démarre db, app, cron
docker compose logs -f app          # « -> prisma migrate deploy » puis démarrage
```

Au démarrage, `docker-entrypoint.sh` applique les migrations Prisma (`prisma migrate deploy`),
idempotent. L'amorçage (rôles, référentiels, modèles de courriel, configuration, compte
administrateur) s'exécute aussi au démarrage du serveur (`instrumentation.ts`) ; le mot de
passe administrateur aléatoire apparaît alors dans les journaux de `app`.

Pour une initialisation explicite et lisible d'une base vierge :

```bash
docker compose run --rm init        # pnpm db:init : affiche identifiant et mot de passe admin
```

Connectez-vous ensuite avec ce compte, changez le mot de passe depuis votre profil et activez
le second facteur. Le **jeu de démonstration** (`pnpm db:demo`) est réservé aux environnements
de test : ne pas le charger en production.

## 4. Reverse proxy TLS

L'application n'est publiée que sur `127.0.0.1:3000`. Exemple avec **Caddy** (certificats
Let's Encrypt automatiques) :

```
reservations.ville-chatillon.fr {
    encode gzip
    reverse_proxy 127.0.0.1:3000
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }
    request_body {
        max_size 32MB
    }
}
```

Exemple **Nginx** :

```nginx
server {
    listen 443 ssl http2;
    server_name reservations.ville-chatillon.fr;
    ssl_certificate     /etc/letsencrypt/live/reservations.ville-chatillon.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reservations.ville-chatillon.fr/privkey.pem;
    client_max_body_size 32m;              # pièces jointes (DOCUMENT_MAX_MB + marge)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 120s;           # génération des PDF
    }
}
server { listen 80; server_name reservations.ville-chatillon.fr; return 301 https://$host$request_uri; }
```

Le proxy doit transmettre `Host`, `X-Forwarded-For` et `X-Forwarded-Proto` ; `TRUST_PROXY=true`
côté application. L'application pose elle-même les en-têtes de sécurité (CSP à nonce,
`X-Frame-Options`, `Referrer-Policy`) : ne pas les dupliquer dans le proxy.

## 5. Tâches planifiées (cron)

Le conteneur `cron` appelle `http://app:3000/api/cron/tous` toutes les 5 minutes avec l'en-tête
`x-cron-secret`. L'application décide elle-même de ce qui est dû (`src/server/jobs-registre.ts`,
heure de Paris) :

| Tâche | Horaire | Condition |
| --- | --- | --- |
| Sauvegarde de la base (`pg_dump`, rotation) | 01:00 | `BACKUP_DB_DIR` défini (toujours le cas en Docker) |
| Archivage des dossiers terminés | 02:00 | — |
| Purge des vieilles notifications | 03:00 | — |
| Clôture des réservations passées | toutes les heures | — |
| Rappels J-7 / J-1 aux usagers | 07:00 | rappels activés |
| Relances de signature | 07:15 | module signature |
| Relances des factures échues | 07:30 | module paiements |
| Récapitulatif quotidien des agents | 07:45 | — |

Chaque exécution est tracée (table `scheduler_run`) et visible dans **Tâches** du back-office,
où une tâche peut être lancée manuellement. Pour appeler une tâche depuis un cron externe :
`curl -fsS -H "x-cron-secret: $CRON_SECRET" https://…/api/cron/backup_database`.

Hors Docker, `DEV_SCHEDULER=true` fait tourner un minuteur interne au processus Next.

## 6. Sauvegardes et restauration

### Sauvegardes automatiques

`pg_dump --format=custom` quotidien dans `./backups/cityresa_AAAAMMJJ_HHMMSS.dump`, rotation
selon `BACKUP_DB_KEEP`. Les sauvegardes se listent, se téléchargent et se suppriment depuis
**Sauvegardes** (administrateur). Les pièces jointes étant en base, une sauvegarde contient
tout ; copiez le dossier `backups/` hors du serveur (rsync, S3, bande).

Export manuel, même si le conteneur `app` est arrêté :

```bash
docker compose exec --user 10001:10001 cron backup.sh     # → /backups/cityresa-<date>.sql.gz
```

### Restauration

```bash
docker compose stop app cron
# base vide (ou nouvelle base) :
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS cityresa;"
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE cityresa OWNER $POSTGRES_USER;"
# format custom (sauvegarde automatique) :
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d cityresa --no-owner --no-privileges < backups/cityresa_20261031_010000.dump
# format SQL gzip (backup.sh) :
gunzip -c backups/cityresa-20261031-010000.sql.gz | docker compose exec -T db psql -U "$POSTGRES_USER" -d cityresa
docker compose up -d app cron
```

Vérifiez ensuite la connexion et quelques dossiers. Le `BETTER_AUTH_SECRET` du `.env` doit être
**celui de la sauvegarde** : sans lui, les secrets chiffrés (mot de passe SMTP, clé SMS, TOTP)
sont illisibles et devront être ressaisis.

Testez une restauration sur une base de recette au moins une fois par trimestre.

## 7. Courriels (SMTP)

Dans **Paramètres → Messagerie** (ou en repli `.env`) : serveur, port (587 STARTTLS ou 465 TLS),
identifiant, mot de passe (chiffré en base), expéditeur. Le bouton « Envoyer un courriel de
test » valide la configuration. Pour une bonne délivrabilité : SPF, DKIM et DMARC du domaine
expéditeur, adresse `noreply@` existante ou alias. `MAIL_ENABLED=false` (ou SMTP absent) :
les courriels sont seulement journalisés (statut « simulé ») — utile en recette.

## 8. SMS (signature électronique)

Deux fournisseurs dans **Paramètres → SMS** :

- `console` : le SMS est écrit dans le journal, rien n'est envoyé (démonstration, recette).
- `http` : passerelle générique. L'application fait un `POST` JSON sur `SMS_API_URL` avec l'en-tête
  `Authorization: Bearer <SMS_API_KEY>` et le corps :

  ```json
  { "to": "+33612345678", "from": "VilleChat", "text": "Ville de Châtillon : votre code de signature de la convention RES-2026-0012 est 482913 (valable 72 h)." }
  ```

  Toute réponse HTTP 2xx vaut succès (délai 15 s). La plupart des opérateurs (Brevo, OVH SMS,
  SMSFactor, Twilio…) s'y adaptent par un petit adaptateur HTTP ou acceptent ce format via leur
  API « simple ». `SMS_SENDER` est l'émetteur alphanumérique (11 caractères max). Les numéros
  sont normalisés en `+33 6/7…` ; sans numéro mobile valide, le code part par courriel.

## 9. Mise à jour

```bash
git pull
docker compose build app cron
docker compose up -d                 # migrations appliquées au démarrage
docker compose logs -f app
docker image prune -f
```

Faites une sauvegarde avant toute mise à jour qui apporte une migration (`prisma/migrations`).
La version de l'application est visible dans **Aide**.

## 10. Dépannage

| Symptôme | Piste |
| --- | --- |
| `prisma migrate deploy` échoue au démarrage | Base inaccessible ou identifiants incohérents : `docker compose logs db`, vérifier `POSTGRES_*` et que le volume `pgdata18` n'a pas été créé avec un autre mot de passe. |
| Page blanche / 502 depuis le proxy | `docker compose ps`, `docker compose logs app` ; l'app écoute-t-elle sur 3000 ? Le proxy pointe-t-il vers `127.0.0.1:3000` ? |
| Connexion impossible, redirections en boucle | `APP_URL` / `BETTER_AUTH_URL` doivent être l'URL publique exacte (https, sans slash final) ; le cookie `Secure` exige HTTPS (ou `ALLOW_INSECURE_COOKIES=true` en test LAN). |
| « BETTER_AUTH_SECRET manquant » | Variable absente du `.env` ou vide. |
| Courriels non reçus | **Paramètres → Messagerie → tester** ; journal des envois (Paramètres → Journal des courriels) ; MAIL_ENABLED ; port 587/465 ouvert en sortie ; SPF/DKIM. |
| SMS non envoyé, le code arrive par courriel | SMS désactivé, numéro invalide, passerelle en erreur : voir le journal des envois (canal `sms`). |
| PDF (convention, facture) non généré | Chromium absent ou mémoire insuffisante : `docker compose logs app` (« [convention] »), `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` est posé dans l'image. |
| Tâches planifiées jamais exécutées | Conteneur `cron` arrêté ou `CRON_SECRET` différent entre `cron` et `app` ; voir **Tâches** (dernière exécution) et `docker compose logs cron`. |
| Sauvegarde en échec | `pg_dump` introuvable (image), dossier `/backups` non inscriptible (droits de `./backups` sur l'hôte : UID 10001). |
| Compte administrateur perdu | `docker compose run --rm init` réinitialise le mot de passe si l'administrateur n'en a pas ; sinon `ADMIN_INITIAL_PASSWORD` + suppression du `auth_account` concerné, ou un autre administrateur depuis **Utilisateurs**. |
| Verrouillage après essais infructueux | `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCKOUT_MINUTES` ; la table `login_throttle` se vide d'elle-même. |

Journaux : `docker compose logs -f app` (format JSON en production, clés sensibles masquées),
**Audit** (actions des utilisateurs), **Journal des courriels**, **Tâches**.
