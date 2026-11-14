# syntax=docker/dockerfile:1

##########
# 1. Base : Node 22 LTS sur Alpine + pnpm via corepack
##########
FROM node:22-alpine AS base
# openssl est requis par le moteur Prisma sur Alpine
RUN apk add --no-cache openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

##########
# 2. Dependencies : installe toutes les deps (cache séparé du code)
##########
FROM base AS deps
# pnpm-workspace.yaml porte les réglages pnpm 11 (allowBuilds, overrides) : indispensable
# pour une installation --frozen-lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --ignore-scripts : le postinstall (`prisma generate`) tourne au stage builder.
# Chromium n'est pas téléchargé : le paquet Alpine est utilisé au runtime.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

##########
# 3. Builder : génère le client Prisma + build Next.js (standalone)
##########
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

##########
# 4. Runner : image finale minimale, non-root
##########
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Chromium système + polices : génération PDF des conventions et factures (Puppeteer).
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Client PostgreSQL (pg_dump/psql) : sauvegardes de la base. Version 18 = celle du service db.
RUN apk add --no-cache postgresql18-client

# Utilisateur non-root (UID 10001, hors de la plage des comptes humains de l'hôte).
RUN addgroup --system --gid 10001 nodejs \
    && adduser --system --uid 10001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Guide utilisateur affiché aux agents (pages /guide, captures, PDF) ; le reste de docs/ reste hors
# de l'image (.dockerignore).
COPY --from=builder /app/docs/guide ./docs/guide

# Prisma : schéma + migrations + config + CLI pour `migrate deploy` au démarrage
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
