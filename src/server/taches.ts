/**
 * Les tâches planifiées, et leur exécution tracée (scheduler_run).
 */
import { DOCUMENT_KINDS, STATUTS_FERMES } from "@/lib/constantes";
import { dateCourte, dateHeure, montant } from "@/lib/libelles";
import { STATUTS_OPTION, trierOptions } from "@/lib/options";
import { addParisDays, parisMidnight, todayParisISO } from "@/lib/paris-time";
import { joursRestants } from "@/lib/pieces";
import { courrielAvenantASigner } from "@/server/avenant";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { backupDatabase } from "@/server/db-backup";
import { TACHES as REGISTRE } from "@/server/jobs-registre";
import { envoyerDepuisModele } from "@/server/mailer";
import { notifier, notifierAgents } from "@/server/notifications";
import { envoyerPlanningsPersonnel } from "@/server/personnel";
import { envoyerPlanningsHebdo } from "@/server/planning-hebdo";
import { changerStatut, chargerReservation, courrielUsager } from "@/server/reservations";
import { executerRgpd } from "@/server/rgpd";

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
  // Les avenants non signés sont relancés au même rythme.
  const avenants = await prisma.avenant.findMany({
    where: {
      signedAt: null,
      createdAt: { lt: seuil },
      reservation: { startAt: { gt: new Date() } },
    },
  });
  let na = 0;
  for (const a of avenants) {
    const deja = await prisma.mailLog.findFirst({
      where: {
        templateKey: "avenant_a_signer",
        reservationId: a.reservationId,
        sentAt: { gte: seuil },
      },
    });
    if (deja) continue;
    const r = await chargerReservation(a.reservationId);
    if (!r) continue;
    await courrielAvenantASigner(r, a);
    na += 1;
  }
  return {
    ok: true,
    message: `${n} relance(s) de signature${na ? `, ${na} relance(s) d'avenant` : ""}`,
  };
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

/**
 * Pièces datées des usagers : à J-N (ALERTE_PIECES_JOURS) puis le jour de l'expiration,
 * courriel aux comptes de l'organisation, cloche pour eux et pour les gestionnaires.
 * Un même courriel n'est pas renvoyé dans la journée (trace mail_log).
 */
async function alertesPieces(): Promise<Resultat> {
  const cfg = await getSettings();
  if (!cfg.DOCUMENTS_ENABLED) return { ok: true, message: "module désactivé" };
  const today = todayParisISO();
  const seuil = cfg.ALERTE_PIECES_JOURS ?? 30;
  const debutJour = parisMidnight(today);
  const pieces = await prisma.document.findMany({
    where: {
      organisationId: { not: null },
      validUntil: { not: null },
      organisation: { isActive: true },
    },
    include: {
      organisation: {
        select: {
          id: true,
          name: true,
          email: true,
          users: { where: { isActive: true, notifEmail: true }, select: { id: true, email: true } },
        },
      },
    },
  });
  let n = 0;
  for (const p of pieces) {
    if (!p.validUntil || !p.organisation) continue;
    const restants = joursRestants(p.validUntil, today);
    if (restants !== seuil && restants !== 0) continue;
    const piece = p.title || DOCUMENT_KINDS[p.kind] || p.filename;
    const echeance = restants === 0 ? "expire aujourd'hui" : `expire dans ${restants} jours`;
    const destinataires = [
      ...new Set(
        [...p.organisation.users.map((u) => u.email), p.organisation.email].filter(
          (e): e is string => Boolean(e),
        ),
      ),
    ];
    if (!destinataires.length) continue;
    const deja = await prisma.mailLog.findFirst({
      where: {
        templateKey: "piece_expiration",
        recipient: { contains: destinataires[0] },
        subject: { contains: piece },
        sentAt: { gte: debutJour },
      },
    });
    if (deja) continue;
    await envoyerDepuisModele("piece_expiration", destinataires, {
      piece,
      organisation: p.organisation.name,
      echeance: echeance.charAt(0).toUpperCase() + echeance.slice(1),
      echeance_phrase: `${echeance} (${dateCourte(p.validUntil)})`,
      lien: `${cfg.APP_BASE_URL}/portail/mon-organisation`,
    });
    for (const u of p.organisation.users)
      await notifier(
        u.id,
        "rappel",
        `${piece} : ${echeance}`,
        "Déposez la nouvelle version depuis « Mon organisation ».",
        "/portail/mon-organisation",
      );
    await notifierAgents(
      null,
      "usager",
      `${p.organisation.name} : ${piece.toLowerCase()} ${echeance}`,
      null,
      `/usagers/${p.organisation.id}#documents`,
    );
    n += 1;
  }
  return { ok: true, message: `${n} alerte(s) de pièce envoyée(s)` };
}

/** Options : relance avant l'échéance, puis libération d'office (annulation sans frais). */
async function options(): Promise<Resultat> {
  const cfg = await getSettings();
  const now = new Date();
  const dossiers = await prisma.reservation.findMany({
    where: { optionExpiresAt: { not: null }, status: { in: [...STATUTS_OPTION] } },
    select: { id: true, status: true, optionExpiresAt: true, optionRelanceAt: true },
  });
  const { aRelancer, expirees } = trierOptions(dossiers, now, cfg.OPTION_RELANCE_JOURS || 3);
  for (const id of aRelancer) {
    const r = await chargerReservation(id);
    if (!r?.optionExpiresAt) continue;
    await courrielUsager(r, "option_relance", {
      echeance: dateHeure(r.optionExpiresAt),
      suite:
        r.status === "acceptee"
          ? "Il vous reste à signer la convention depuis votre espace pour confirmer la réservation."
          : "La collectivité attend votre réponse ou les précisions demandées pour confirmer la réservation.",
    });
    await prisma.reservation.update({ where: { id }, data: { optionRelanceAt: now } });
    await notifierAgents(
      r.espaceId,
      "reservation",
      `Option ${r.numero} : échéance le ${dateHeure(r.optionExpiresAt)}`,
      r.espace.name,
      `/reservations/${r.id}`,
    );
  }
  for (const id of expirees) {
    const r = await chargerReservation(id);
    if (!r?.optionExpiresAt) continue;
    await changerStatut(
      id,
      "annulee",
      { name: "système", isAgent: true },
      {
        parSysteme: true,
        sansFrais: true,
        motif: `Option expirée le ${dateHeure(r.optionExpiresAt)} sans confirmation.`,
      },
    );
    await notifierAgents(
      r.espaceId,
      "reservation",
      `Option ${r.numero} expirée : créneau libéré`,
      r.espace.name,
      `/reservations/${r.id}`,
    );
  }
  return {
    ok: true,
    message: `${aRelancer.length} relance(s) d'option, ${expirees.length} option(s) libérée(s)`,
  };
}

async function rgpd(): Promise<Resultat> {
  const b = await executerRgpd();
  return {
    ok: true,
    message: `${b.prevenus} préavis envoyé(s), ${b.anonymises} compte(s) anonymisé(s), ${b.purges} dossier(s) purgé(s)`,
  };
}

async function planningHebdo(): Promise<Resultat> {
  const b = await envoyerPlanningsHebdo();
  return { ok: true, message: b };
}

async function planningPersonnel(): Promise<Resultat> {
  return { ok: true, message: await envoyerPlanningsPersonnel() };
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
  rgpd: rgpd,
  terminer_reservations: terminer,
  rappels_usagers: rappels,
  relances_signature: relancesSignature,
  relances_paiement: relancesPaiement,
  options: options,
  digest_agents: digest,
  planning_hebdo: planningHebdo,
  planning_personnel: planningPersonnel,
  alertes_pieces: alertesPieces,
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
