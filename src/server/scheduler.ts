/**
 * Minuteur interne de développement : sans conteneur cron, les tâches planifiées tournent
 * quand même, à leurs horaires, dans le processus Next.
 */
import { getSettings } from "@/server/config-store";
import { tachesDues } from "@/server/jobs-registre";
import { executerTaches } from "@/server/taches";

const PAS_MS = 60_000;
const partage = globalThis as unknown as { __cityresaMinuteur?: boolean };

export function demarrerMinuteurDev(): void {
  if (partage.__cityresaMinuteur) return;
  partage.__cityresaMinuteur = true;
  let dernier = new Date();
  const tick = async () => {
    const maintenant = new Date();
    try {
      const cfg = await getSettings();
      const ids = tachesDues(cfg, dernier, maintenant).map((t) => t.id);
      if (ids.length) await executerTaches(ids);
    } catch (e) {
      console.error("[scheduler-dev] passage en erreur :", e);
    }
    dernier = maintenant;
  };
  const minuteur = setInterval(tick, PAS_MS);
  minuteur.unref?.();
  console.log("[scheduler-dev] minuteur interne démarré (passage chaque minute)");
}
