/**
 * Les tâches planifiées, et leur exécution tracée (scheduler_run).
 */
import { STATUTS_FERMES } from "@/lib/constantes";
import { dateCourte, montant } from "@/lib/libelles";
import { addParisDays, parisMidnight, todayParisISO } from "@/lib/paris-time";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { backupDatabase } from "@/server/db-backup";
import { TACHES as REGISTRE } from "@/server/jobs-registre";
import { envoyerDepuisModele } from "@/server/mailer";
import { notifier } from "@/server/notifications";
import { changerStatut, chargerReservation, courrielUsager } from "@/server/reservations";

type Resultat = { ok: boolean; message: string };

async function rappels(): Promise<Resultat> {
  const cfg = await getSettings();
  const today = todayParisISO();
  let n = 0;
  for (const [jours, key, actif] of [
    [7, "rappel_j7", cfg.RAPPEL_J7],
    [1, "rappel_j1", cfg.RAPPEL_J1],
  ] as const) {
    if (!actif) continue;
    const debut = addParisDays(parisMidnight(today), jours);
    const fin = addParisDays(debut, 1);
    const creneaux = await prisma.creneau.findMany({
      where: {
        status: "prevu",
        startAt: { gte: debut, lt: fin },
        reservation: { status: { in: STATUTS_FERMES } },
      },
      select: { reservationId: true },
      distinct: ["reservationId"],
    });
    for (const c of creneaux) {
      const deja = await prisma.mailLog.findFirst({
        where: { templateKey: key, reservationId: c.reservationId, sentAt: { gte: debut } },
      });
      if (deja) continue;
      const r = await chargerReservation(c.reservationId);
      if (!r) continue;
      await courrielUsager(r, key);
      n += 1;
    }
  }
  return { ok: true, message: `${n} rappel(s) envoyé(s)` };
}

async function relancesSignature(): Promise<Resultat> {
  const cfg = await getSettings();
  const seuil = new Date(Date.now() - (cfg.RELANCE_SIGNATURE_JOURS || 3) * 86_400_000);
  const en_attente = await prisma.reservation.findMany({
    where: {
      status: "acceptee",
      signedAt: null,
      decisionAt: { lt: seuil },
      startAt: { gt: new Date() },
    },
    select: { id: true },
  });
  let n = 0;
  for (const x of en_attente) {
    const deja = await prisma.mailLog.findFirst({
      where: { templateKey: "convention_a_signer", reservationId: x.id, sentAt: { gte: seuil } },
    });
    if (deja) continue;
    const r = await chargerReservation(x.id);
    if (!r) continue;
    await courrielUsager(r, "convention_a_signer");
    n += 1;
  }
  return { ok: true, message: `${n} relance(s) de signature` };
}

async function relancesPaiement(): Promise<Resultat> {
  const echues = await prisma.facture.findMany({
    where: { status: "a_payer", dueAt: { lt: new Date() } },
    include: { reservation: { select: { id: true, userId: true, numero: true } } },
  });
  let n = 0;
  for (const f of echues) {
    const deja = await prisma.notification.findFirst({
      where: {
        type: "paiement",
        title: { contains: f.numero },
        createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
      },
    });
    if (deja || !f.reservation?.userId) continue;
    await notifier(
      f.reservation.userId,
      "paiement",
      `Facture ${f.numero} échue`,
      `${montant(f.montantTtc)} à régler`,
      `/portail/mes-reservations/${f.reservation.id}`,
    );
    n += 1;
  }
  return { ok: true, message: `${n} relance(s) de paiement` };
}

async function terminer(): Promise<Resultat> {
  const passees = await prisma.reservation.findMany({
    where: { status: "confirmee", endAt: { lt: new Date() } },
    select: { id: true },
  });
  for (const r of passees)
    await changerStatut(r.id, "terminee", { name: "système", isAgent: true }, { parSysteme: true });
  return { ok: true, message: `${passees.length} réservation(s) terminée(s)` };
}

async function archiver(): Promise<Resultat> {
  const cfg = await getSettings();
  const seuil = new Date(Date.now() - (cfg.ARCHIVAGE_AUTO_JOURS || 30) * 86_400_000);
  const r = await prisma.reservation.updateMany({
    where: {
      status: { in: ["terminee", "refusee", "annulee"] },
      updatedAt: { lt: seuil },
      archivedAt: null,
    },
    data: { status: "archivee", archivedAt: new Date() },
  });
  return { ok: true, message: `${r.count} dossier(s) archivé(s)` };
}

async function purgeNotifications(): Promise<Resultat> {
  const r = await prisma.notification.deleteMany({
    where: { readAt: { not: null, lt: new Date(Date.now() - 90 * 86_400_000) } },
  });
  const l = await prisma.mailLog.deleteMany({
    where: { sentAt: { lt: new Date(Date.now() - 365 * 86_400_000) } },
  });
  return { ok: true, message: `${r.count} notification(s) et ${l.count} trace(s) purgées` };
}

async function digest(): Promise<Resultat> {
  const cfg = await getSettings();
  const today = todayParisISO();
  const debut = parisMidnight(today);
  const fin = addParisDays(debut, 1);
  const [a_traiter, messages, signatures, factures, aujourdhui] = await Promise.all([
    prisma.reservation.count({ where: { status: { in: ["a_traiter", "en_traitement"] } } }),
    prisma.message.count({ where: { readAt: null, authorKind: "usager", isInternal: false } }),
    prisma.reservation.count({ where: { status: "acceptee", signedAt: null } }),
    prisma.facture.count({ where: { status: "a_payer" } }),
    prisma.creneau.count({
      where: {
        status: "prevu",
        startAt: { gte: debut, lt: fin },
        reservation: { status: { in: STATUTS_FERMES } },
      },
    }),
  ]);
  const agents = await prisma.user.findMany({
    where: {
      kind: "agent",
      isActive: true,
      notifEmail: true,
      role: { in: ["admin", "gestionnaire", "agent"] },
    },
    select: { email: true },
  });
  if (!agents.length) return { ok: true, message: "aucun destinataire" };
  await envoyerDepuisModele(
    "digest_agents",
    agents.map((a) => a.email),
    {
      date: dateCourte(new Date()),
      nb_a_traiter: a_traiter,
      nb_messages: messages,
      nb_signatures: signatures,
      nb_factures: factures,
      nb_aujourdhui: aujourdhui,
      lien: `${cfg.APP_BASE_URL}/`,
    },
  );
  return { ok: true, message: `récapitulatif envoyé à ${agents.length} agent(s)` };
}

async function sauvegarde(): Promise<Resultat> {
  const cfg = await getSettings();
  const chemin = await backupDatabase(cfg);
  return { ok: true, message: `sauvegarde écrite : ${chemin}` };
}

export const TACHES: Record<string, () => Promise<Resultat>> = {
  backup_database: sauvegarde,
  archivage_auto: archiver,
  purge_notifications: purgeNotifications,
  terminer_reservations: terminer,
  rappels_usagers: rappels,
  relances_signature: relancesSignature,
  relances_paiement: relancesPaiement,
  digest_agents: digest,
};

export const LIBELLES_TACHES: Record<string, string> = Object.fromEntries(
  REGISTRE.map((t) => [t.id, t.label]),
);

/** Exécute une tâche en la traçant. */
export async function executerTache(id: string): Promise<Resultat & { id: string }> {
  const fn = TACHES[id];
  if (!fn) return { id, ok: false, message: "tâche inconnue" };
  const run = await prisma.schedulerRun.create({ data: { task: id } });
  try {
    const res = await fn();
    await prisma.schedulerRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: res.ok ? "ok" : "erreur", message: res.message },
    });
    return { id, ...res };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.schedulerRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: "erreur", message },
    });
    return { id, ok: false, message };
  } finally {
    // Garde 500 traces.
    const vieux = await prisma.schedulerRun.findMany({
      orderBy: { startedAt: "desc" },
      skip: 500,
      select: { id: true },
    });
    if (vieux.length)
      await prisma.schedulerRun.deleteMany({ where: { id: { in: vieux.map((v) => v.id) } } });
  }
}

export async function executerTaches(ids: string[]): Promise<(Resultat & { id: string })[]> {
  const out: (Resultat & { id: string })[] = [];
  for (const id of ids) out.push(await executerTache(id));
  return out;
}
