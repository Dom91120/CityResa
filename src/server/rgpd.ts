/**
 * RGPD : export des données d'un usager, anonymisation d'un compte (à sa demande, par un
 * agent, ou par la tâche planifiée après préavis), purge des données personnelles des
 * dossiers archivés au-delà de la durée de conservation. Règles pures dans src/lib/rgpd.ts.
 */
import { dateCourte } from "@/lib/libelles";
import {
  CHAMPS_PURGES,
  construireExport,
  dateAnonymisation,
  dossierAPurger,
  dossierEnCours,
  etatInactivite,
  obstaclesAnonymisation,
  phraseObstacles,
  type ReglesRgpd,
  reglesDe,
  valeursAnonymes,
  valeursOrganisationAnonyme,
} from "@/lib/rgpd";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { envoyerDepuisModele } from "@/server/mailer";

export async function reglesRgpd(): Promise<ReglesRgpd> {
  return reglesDe(await getSettings());
}

/** Tout ce que l'application sait d'un usager, prêt à lui être remis (JSON). */
export async function exportDonneesUsager(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organisation: true },
  });
  if (!user) throw new UserFacingError("Compte introuvable.");
  const orgId = user.organisationId;
  const [
    reservations,
    messages,
    documents,
    voeux,
    listeAttente,
    factures,
    subventions,
    notifications,
    courriels,
    journal,
  ] = await Promise.all([
    prisma.reservation.findMany({
      where: orgId ? { OR: [{ userId }, { organisationId: orgId }] } : { userId },
      include: { espace: { select: { name: true } }, creneaux: { orderBy: { startAt: "asc" } } },
      orderBy: { startAt: "desc" },
    }),
    prisma.message.findMany({
      where: { authorId: userId },
      include: { reservation: { select: { numero: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.document.findMany({ where: { uploadedById: userId }, orderBy: { createdAt: "asc" } }),
    prisma.voeu.findMany({
      where: { userId },
      include: { espace: { select: { name: true } }, campagne: { select: { label: true } } },
    }),
    prisma.listeAttente.findMany({
      where: { userId },
      include: { espace: { select: { name: true } } },
    }),
    orgId ? prisma.facture.findMany({ where: { organisationId: orgId } }) : Promise.resolve([]),
    orgId ? prisma.subvention.findMany({ where: { organisationId: orgId } }) : Promise.resolve([]),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.mailLog.findMany({
      where: { recipient: user.email },
      orderBy: { sentAt: "asc" },
      select: { sentAt: true, subject: true },
    }),
    prisma.actionLog.findMany({
      where: { username: user.email },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, action: true, detail: true },
    }),
  ]);
  return construireExport({
    user,
    organisation: user.organisation,
    reservations,
    messages,
    documents,
    voeux,
    listeAttente,
    factures,
    subventions,
    notifications,
    courriels,
    journal,
  });
}

/** Réponse HTTP : le fichier JSON à télécharger. */
export function reponseJson(donnees: unknown, filename: string): Response {
  return new Response(JSON.stringify(donnees, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Ce qui empêche d'anonymiser le compte maintenant (vide = rien). */
export async function obstaclesDe(userId: string, now = new Date()): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organisationId: true },
  });
  if (!user) return [];
  const dernierMembre =
    user.organisationId !== null &&
    (await prisma.user.count({
      where: { organisationId: user.organisationId, id: { not: userId }, anonymiseAt: null },
    })) === 0;
  const where =
    dernierMembre && user.organisationId
      ? { OR: [{ userId }, { organisationId: user.organisationId }] }
      : { userId };
  const dossiers = await prisma.reservation.findMany({
    where: { ...where, status: { notIn: ["archivee", "terminee", "refusee", "annulee"] } },
    select: { status: true, endAt: true },
  });
  const facturesImpayees =
    dernierMembre && user.organisationId
      ? await prisma.facture.count({
          where: { organisationId: user.organisationId, status: "a_payer" },
        })
      : 0;
  return obstaclesAnonymisation({
    dossiersEnCours: dossiers.filter((r) => dossierEnCours(r, now)).length,
    facturesImpayees,
  });
}

/**
 * Efface l'identité d'un compte usager : courriel, nom, téléphone, mot de passe, sessions,
 * second facteur, notifications, liste d'attente. Le compte reste (désactivé) pour que
 * l'historique des dossiers garde un auteur ; l'organisation perd ses coordonnées de
 * personnes physiques si c'était son dernier membre. Échoue si un dossier est en cours.
 */
export async function anonymiserCompte(
  userId: string,
  acteur: string,
  motif: "demande" | "inactivite" | "agent",
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.kind !== "usager") throw new UserFacingError("Compte introuvable.");
  if (user.anonymiseAt) throw new UserFacingError("Ce compte est déjà anonymisé.");
  const obstacles = await obstaclesDe(userId);
  if (obstacles.length) throw new UserFacingError(phraseObstacles(obstacles));
  const now = new Date();
  const email = user.email;
  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId } });
    await tx.authAccount.deleteMany({ where: { userId } });
    await tx.twoFactor.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.listeAttente.deleteMany({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: valeursAnonymes(userId, now) });
    if (user.organisationId) {
      const autres = await tx.user.count({
        where: { organisationId: user.organisationId, anonymiseAt: null },
      });
      if (autres === 0) {
        const org = await tx.organisation.findUnique({
          where: { id: user.organisationId },
          select: { id: true, type: true },
        });
        if (org)
          await tx.organisation.update({
            where: { id: org.id },
            data: valeursOrganisationAnonyme(org),
          });
      }
    }
  });
  const libelle = { demande: "à sa demande", inactivite: "compte inactif", agent: "par un agent" }[
    motif
  ];
  await auditRecord("anonymisation compte usager", `${email} (${libelle})`, "usagers", acteur);
}

/** Purge un dossier : messages, pièces et photos, notes et signature. L'espace, les dates et les montants restent. */
export async function purgerDossier(id: number, now = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.message.deleteMany({ where: { reservationId: id } });
    await tx.document.deleteMany({
      where: { OR: [{ reservationId: id }, { etatDesLieux: { reservationId: id } }] },
    });
    await tx.etatDesLieux.updateMany({
      where: { reservationId: id },
      data: { signataire: null, observations: null },
    });
    await tx.reservation.update({
      where: { id },
      data: { ...CHAMPS_PURGES, purgeAt: now },
    });
  });
}

export type BilanRgpd = { prevenus: number; anonymises: number; purges: number };

/** La tâche planifiée : préavis aux comptes inactifs, anonymisation à l'échéance, purge des dossiers. */
export async function executerRgpd(now = new Date()): Promise<BilanRgpd> {
  const cfg = await getSettings();
  const regles = reglesDe(cfg);
  const bilan: BilanRgpd = { prevenus: 0, anonymises: 0, purges: 0 };
  if (regles.inactiviteMois) {
    const comptes = await prisma.user.findMany({
      where: { kind: "usager", anonymiseAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        inactivitePreavisAt: true,
        anonymiseAt: true,
      },
    });
    for (const u of comptes) {
      const etat = etatInactivite(u, regles, now);
      if (etat === "a_prevenir") {
        if (await obstaclesDe(u.id, now).then((o) => o.length)) continue;
        await envoyerDepuisModele("compte_inactif", u.email, {
          prenom: u.firstName,
          mois: regles.inactiviteMois,
          date: dateCourte(dateAnonymisation(now, regles)),
          lien: `${cfg.APP_BASE_URL}/connexion`,
        });
        await prisma.user.update({ where: { id: u.id }, data: { inactivitePreavisAt: now } });
        bilan.prevenus += 1;
      } else if (etat === "a_anonymiser") {
        try {
          await anonymiserCompte(u.id, "système", "inactivite");
          bilan.anonymises += 1;
        } catch (e) {
          if (!(e instanceof UserFacingError)) throw e;
        }
      }
    }
  }
  if (regles.conservationAnnees) {
    const dossiers = await prisma.reservation.findMany({
      where: {
        purgeAt: null,
        status: { in: ["archivee", "terminee", "refusee", "annulee"] },
      },
      select: { id: true, numero: true, status: true, endAt: true, purgeAt: true },
    });
    for (const r of dossiers) {
      if (!dossierAPurger(r, regles, now)) continue;
      await purgerDossier(r.id, now);
      bilan.purges += 1;
    }
    if (bilan.purges)
      await auditRecord("purge rgpd", `${bilan.purges} dossier(s)`, "reservations", "système");
  }
  return bilan;
}
