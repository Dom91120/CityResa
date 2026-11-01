import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";

/**
 * Autorisation des routes `/api/cron/*` : secret partagé avec le conteneur cron, comparé
 * à temps constant. Pas de secret configuré → aucune route ouverte.
 */
export function autoriseCron(h: Headers, env: NodeJS.ProcessEnv = process.env): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const provided = h.get("x-cron-secret");
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAuthorizedCron(): Promise<boolean> {
  return autoriseCron(await headers());
}
