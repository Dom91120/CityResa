/**
 * Démarrage du serveur Node : amorçage idempotent de la base (rôles, référentiels,
 * modèles de courriel, compte admin, configuration). Les tâches planifiées tournent via
 * /api/cron (conteneur cron) et, en développement, via le minuteur interne.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.CITYRESA_SKIP_BOOT === "true") return;
  try {
    const { amorcer } = await import("@/server/amorcage");
    await amorcer({ annoncer: true });
  } catch (e) {
    console.error("[boot] amorçage impossible :", e);
  }
  const dev =
    process.env.DEV_SCHEDULER ?? (process.env.NODE_ENV === "production" ? "false" : "true");
  if (dev === "true") {
    const { demarrerMinuteurDev } = await import("@/server/scheduler");
    demarrerMinuteurDev();
  }
}
