/**
 * Le registre des tâches planifiées : identifiants et horaires (Europe/Paris, heure du
 * serveur en production via TZ). Le conteneur cron appelle /api/cron/tous toutes les
 * 5 minutes ; `tachesDues` dit lesquelles exécuter.
 */
import type { AppSettings } from "@/server/config-store";

export type Tache = {
  id: string;
  label: string;
  heure?: number;
  minute?: number;
  intervalleMinutes?: number;
  actif?: (cfg: AppSettings) => boolean;
};

export const TACHES: Tache[] = [
  {
    id: "backup_database",
    label: "Sauvegarde de la base",
    heure: 1,
    minute: 0,
    actif: (c) => Boolean(c.BACKUP_DB_DIR),
  },
  { id: "archivage_auto", label: "Archivage des dossiers terminés", heure: 2, minute: 0 },
  { id: "purge_notifications", label: "Purge des vieilles notifications", heure: 3, minute: 0 },
  { id: "terminer_reservations", label: "Clôture des réservations passées", intervalleMinutes: 60 },
  {
    id: "rappels_usagers",
    label: "Rappels J-7 / J-1 aux usagers",
    heure: 7,
    minute: 0,
    actif: (c) => Boolean(c.RAPPEL_J7 || c.RAPPEL_J1),
  },
  {
    id: "relances_signature",
    label: "Relances de signature",
    heure: 7,
    minute: 15,
    actif: (c) => Boolean(c.SIGNATURE_ENABLED),
  },
  {
    id: "relances_paiement",
    label: "Relances des factures échues",
    heure: 7,
    minute: 30,
    actif: (c) => Boolean(c.PAIEMENTS_ENABLED),
  },
  {
    id: "options",
    label: "Options : relance avant échéance et libération d'office",
    heure: 7,
    minute: 40,
  },
  { id: "digest_agents", label: "Récapitulatif quotidien des agents", heure: 7, minute: 45 },
  {
    id: "alertes_pieces",
    label: "Alertes d'expiration des pièces justificatives",
    heure: 7,
    minute: 50,
    actif: (c) => Boolean(c.DOCUMENTS_ENABLED),
  },
];

export function tachesActives(cfg: AppSettings): Tache[] {
  return TACHES.filter((t) => !t.actif || t.actif(cfg));
}

/** La prochaine exécution d'une tâche (heure locale du serveur). */
export function prochaineExecution(t: Tache, now = new Date()): Date {
  if (t.intervalleMinutes) {
    const pas = t.intervalleMinutes * 60_000;
    return new Date(Math.ceil((now.getTime() + 1) / pas) * pas);
  }
  const d = new Date(now);
  d.setHours(t.heure ?? 0, t.minute ?? 0, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** Les tâches dont l'heure tombe dans la fenêtre [depuis, jusqua[. */
export function tachesDues(cfg: AppSettings, depuis: Date, jusqua: Date): Tache[] {
  const dues: Tache[] = [];
  for (const t of tachesActives(cfg)) {
    if (t.intervalleMinutes) {
      const pas = t.intervalleMinutes * 60_000;
      const prochain = Math.ceil(depuis.getTime() / pas) * pas;
      if (prochain >= depuis.getTime() && prochain < jusqua.getTime()) dues.push(t);
      continue;
    }
    const d = new Date(depuis);
    d.setHours(t.heure ?? 0, t.minute ?? 0, 0, 0);
    for (const candidat of [d, new Date(d.getTime() + 86_400_000)]) {
      if (candidat.getTime() >= depuis.getTime() && candidat.getTime() < jusqua.getTime())
        dues.push(t);
    }
  }
  return dues;
}
