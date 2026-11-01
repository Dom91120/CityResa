#!/bin/sh
set -e

# Applique les migrations Prisma au demarrage (idempotent).
echo "-> prisma migrate deploy"
node_modules/.bin/prisma migrate deploy

echo "-> demarrage de CityResa"
exec "$@"
