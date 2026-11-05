/**
 * Campagnes annuelles d'attribution des créneaux : cycle de vie d'une campagne, dépôt et
 * retrait des vœux (portail), décisions, arbitrage automatique, création des dossiers à
 * l'attribution, courriel groupé des décisions. Règles pures dans src/lib/campagnes.ts.
 */
import type { Prisma } from "@/generated/prisma/client";
import {
  arbitrer,
  type CampagneStatus,
  decrireCreneauHebdo,
  prioriteDe,
  TRANSITIONS_CAMPAGNE,
  type VoeuArbitrable,
  verifierCreneauHebdo,
  voeuVersDemande,
} from "@/lib/campagnes";
import { reglesAuCreneau, verifierRegles } from "@/lib/creneaux";
import { pluriel } from "@/lib/libelles";
import { auditRecord } from "@/server/audit";
import { saisonLue } from "@/server/calendrier";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { enabledIn } from "@/server/features";
import { horairesSaisonDe } from "@/server/horaires";
import { envoyerDepuisModele } from "@/server/mailer";
import { invalidateNavCounts } from "@/server/nav";
import { notifier } from "@/server/notifications";
import { chargerReservation, creerReservation } from "@/server/reservations";

export const INCLUDE_CAMPAGNE = {
  saison: true,
  espaces: { include: { espace: { include: { site: true } } } },
  voeux: {
    include: {
      organisation: { select: { id: true, name: true, type: true, conventionnee: true } },
      espace: { select: { id: true, name: true, shortName: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      reservation: { select: { id: true, numero: true, status: true } },
    },
    orderBy: [
      { espaceId: "asc" as const },
      { weekday: "asc" as const },
      { startMin: "asc" as const },
    ],
  },
  _count: { select: { voeux: true } },
} satisfies Prisma.CampagneInclude;

export type CampagneComplete = Prisma.CampagneGetPayload<{ include: typeof INCLUDE_CAMPAGNE }>;
export type VoeuComplet = CampagneComplete["voeux"][number];

export async function chargerCampagne(id: number): Promise<CampagneComplete | null> {
  return prisma.campagne.findUnique({ where: { id }, include: INCLUDE_CAMPAGNE });
}

export async function campagnes(): Promise<CampagneComplete[]> {
  return prisma.campagne.findMany({ include: INCLUDE_CAMPAGNE, orderBy: { createdAt: "desc" } });
}

/** La campagne dont le dépôt est ouvert (une seule à la fois), pour le portail. */
export async function campagneOuverte(): Promise<CampagneComplete | null> {
  return prisma.campagne.findFirst({
    where: { status: "ouverte" },
    include: INCLUDE_CAMPAGNE,
    orderBy: { createdAt: "desc" },
  });
}

/** Les espaces où l'on peut déposer un vœu : ceux de la campagne, sinon tous les espaces actifs réservables. */
export async function espacesDeCampagne(
  c: CampagneComplete,
): Promise<{ id: number; name: string; siteName: string; slotStepMin: number }[]> {
  const rows = c.espaces.length
    ? c.espaces.map((e) => e.espace)
    : await prisma.espace.findMany({
        where: { isActive: true, isPublic: true },
        include: { site: true },
        orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
      });
  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    siteName: e.site.name,
    slotStepMin: e.slotStepMin,
  }));
}

// ── Cycle de vie ──

export type CampagneEntree = {
  saisonId: number;
  label: string;
  closeDate: Date | null;
  consignes: string | null;
  espaceIds: number[];
};

async function verifierEntree(e: CampagneEntree): Promise<void> {
  if (!e.label.trim()) throw new UserFacingError("Donnez un nom à la campagne.");
  const s = await prisma.saison.findUnique({ where: { id: e.saisonId } });
  if (!s) throw new UserFacingError("Choisissez la saison de la campagne.");
}

export async function creerCampagne(e: CampagneEntree, acteur: string): Promise<number> {
  await verifierEntree(e);
  const c = await prisma.campagne.create({
    data: {
      saisonId: e.saisonId,
      label: e.label.trim().slice(0, 120),
      closeDate: e.closeDate,
      consignes: e.consignes,
      createdBy: acteur,
      espaces: { create: e.espaceIds.map((espaceId) => ({ espaceId })) },
    },
  });
  await auditRecord("creation campagne", c.label, "reservations", acteur);
  return c.id;
}

export async function modifierCampagne(
  id: number,
  e: CampagneEntree,
  acteur: string,
): Promise<void> {
  await verifierEntree(e);
  await prisma.$transaction([
    prisma.campagne.update({
      where: { id },
      data: {
        saisonId: e.saisonId,
        label: e.label.trim().slice(0, 120),
        closeDate: e.closeDate,
        consignes: e.consignes,
      },
    }),
    prisma.campagneEspace.deleteMany({ where: { campagneId: id } }),
    prisma.campagneEspace.createMany({
      data: e.espaceIds.map((espaceId) => ({ campagneId: id, espaceId })),
    }),
  ]);
  await auditRecord("modification campagne", e.label, "reservations", acteur);
}

export async function changerStatutCampagne(
  c: CampagneComplete,
  nouveau: CampagneStatus,
  acteur: string,
): Promise<void> {
  const admis = TRANSITIONS_CAMPAGNE[c.status as CampagneStatus] ?? [];
  if (!admis.includes(nouveau)) throw new UserFacingError("Ce changement d'état est impossible.");
  if (nouveau === "ouverte") {
    const autre = await prisma.campagne.findFirst({
      where: { status: "ouverte", id: { not: c.id } },
    });
    if (autre)
      throw new UserFacingError(
        `La campagne « ${autre.label} » est déjà ouverte : clôturez-la d'abord.`,
      );
  }
  if (nouveau === "cloturee" && c.voeux.some((v) => v.status === "en_attente"))
    throw new UserFacingError(
      "Des vœux sont encore en attente : attribuez-les ou refusez-les avant de clôturer.",
    );
  await prisma.campagne.update({ where: { id: c.id }, data: { status: nouveau } });
  await auditRecord(`campagne ${nouveau}`, c.label, "reservations", acteur);
}

export async function supprimerCampagne(c: CampagneComplete, acteur: string): Promise<void> {
  if (c.voeux.some((v) => v.reservationId))
    throw new UserFacingError(
      "Des dossiers ont été créés depuis cette campagne : elle se conserve.",
    );
  await prisma.campagne.delete({ where: { id: c.id } });
  await auditRecord("suppression campagne", c.label, "reservations", acteur);
}

// ── Vœux (portail) ──

export type VoeuEntree = {
  espaceId: number;
  title: string;
  participants: number | null;
  description: string | null;
  weekday: number;
  startMin: number;
  endMin: number;
  horsVacances: boolean;
};

export async function deposerVoeu(
  c: CampagneComplete,
  org: { id: number; name: string },
  userId: string | null,
  e: VoeuEntree,
): Promise<number> {
  if (c.status !== "ouverte") throw new UserFacingError("Le dépôt des vœux est clos.");
  const ouverts = await espacesDeCampagne(c);
  const espace = ouverts.find((x) => x.id === e.espaceId);
  if (!espace) throw new UserFacingError("Cet espace n'est pas ouvert à la campagne.");
  if (!e.title.trim()) throw new UserFacingError("Indiquez l'activité prévue.");
  const erreurs = verifierCreneauHebdo(e, espace.slotStepMin);
  if (erreurs.length) throw new UserFacingError(erreurs.join(" "));
  // Les règles de l'espace (durées, horaires d'ouverture de la saison) sur la première occurrence.
  const complet = await prisma.espace.findUniqueOrThrow({ where: { id: espace.id } });
  const { premier } = voeuVersDemande(e, saisonLue(c.saison));
  const regles = reglesAuCreneau(complet, await horairesSaisonDe(espace.id), premier);
  const manques = verifierRegles(regles, premier, new Date(), { ignorerDelai: true });
  if (manques.length) throw new UserFacingError(manques.join(" "));
  const doublon = c.voeux.find(
    (v) =>
      v.organisationId === org.id &&
      v.espaceId === e.espaceId &&
      v.weekday === e.weekday &&
      v.startMin === e.startMin &&
      v.endMin === e.endMin,
  );
  if (doublon) throw new UserFacingError("Vous avez déjà déposé ce vœu.");
  const v = await prisma.voeu.create({
    data: {
      campagneId: c.id,
      organisationId: org.id,
      userId,
      espaceId: e.espaceId,
      title: e.title.trim().slice(0, 160),
      participants: e.participants,
      description: e.description,
      weekday: e.weekday,
      startMin: e.startMin,
      endMin: e.endMin,
      horsVacances: e.horsVacances,
    },
  });
  return v.id;
}

export async function retirerVoeu(
  c: CampagneComplete,
  voeuId: number,
  orgId: number,
): Promise<void> {
  const v = c.voeux.find((x) => x.id === voeuId && x.organisationId === orgId);
  if (!v) throw new UserFacingError("Vœu introuvable.");
  if (c.status !== "ouverte" || v.status !== "en_attente")
    throw new UserFacingError("Ce vœu ne peut plus être retiré.");
  await prisma.voeu.delete({ where: { id: v.id } });
}

/** Les vœux d'une organisation, toutes campagnes confondues (les plus récentes d'abord). */
export async function voeuxDe(orgId: number) {
  return prisma.voeu.findMany({
    where: { organisationId: orgId },
    include: {
      campagne: { include: { saison: true } },
      espace: { select: { id: true, name: true, shortName: true } },
      reservation: { select: { id: true, numero: true, status: true } },
    },
    orderBy: [{ campagne: { createdAt: "desc" } }, { weekday: "asc" }, { startMin: "asc" }],
  });
}

// ── Instruction ──

export function arbitrables(c: CampagneComplete): VoeuArbitrable[] {
  return c.voeux.map((v) => ({
    id: v.id,
    espaceId: v.espaceId,
    weekday: v.weekday,
    startMin: v.startMin,
    endMin: v.endMin,
    status: v.status,
    priorite: prioriteDe(v.organisation),
    createdAt: v.createdAt,
  }));
}

function verifierInstruction(c: CampagneComplete): void {
  if (c.status !== "instruction")
    throw new UserFacingError("Les décisions se prennent quand la campagne est en instruction.");
}

/** Attribue un vœu : crée le dossier sur toute la saison (accepté à signer, ou confirmé sans signature). */
export async function attribuerVoeu(
  c: CampagneComplete,
  voeuId: number,
  acteur: { name: string; email: string },
): Promise<string> {
  verifierInstruction(c);
  const v = c.voeux.find((x) => x.id === voeuId);
  if (!v) throw new UserFacingError("Vœu introuvable.");
  if (v.status === "attribue" && v.reservationId)
    throw new UserFacingError("Ce vœu est déjà attribué.");
  const cfg = await getSettings();
  const { premier, recurrence } = voeuVersDemande(v, saisonLue(c.saison));
  const r = await creerReservation(
    {
      espaceId: v.espaceId,
      title: v.title,
      natureId: null,
      description: v.description,
      participants: v.participants,
      isPublicEvent: false,
      premier,
      recurrence,
      options: [],
      materiels: [],
      organisationId: v.organisationId,
      userId: v.userId,
      source: "backoffice",
      ignorerDelai: true,
      statutInitial: enabledIn(cfg, "signature") ? "acceptee" : "confirmee",
      sansCourriel: true,
    },
    acteur.name,
  );
  if (r.status === "acceptee") {
    const { genererConvention } = await import("@/server/convention");
    const maj = await chargerReservation(r.id);
    if (maj)
      await genererConvention(maj, acteur.name).catch((e) => console.error("[convention]", e));
  }
  await prisma.$transaction([
    prisma.voeu.update({
      where: { id: v.id },
      data: {
        status: "attribue",
        reservationId: r.id,
        decisionNote: null,
        decidedAt: new Date(),
        decidedBy: acteur.name,
        notifiedAt: null,
      },
    }),
    prisma.reservationHistory.create({
      data: {
        reservationId: r.id,
        action: "Attribué par la campagne",
        comment: `${c.label} · ${decrireCreneauHebdo(v)}`,
        performedBy: acteur.name,
      },
    }),
  ]);
  invalidateNavCounts();
  return r.numero;
}

export async function refuserVoeu(
  c: CampagneComplete,
  voeuId: number,
  note: string | null,
  acteur: { name: string },
): Promise<void> {
  verifierInstruction(c);
  const v = c.voeux.find((x) => x.id === voeuId);
  if (!v) throw new UserFacingError("Vœu introuvable.");
  if (v.reservationId)
    throw new UserFacingError("Ce vœu a donné un dossier : annulez le dossier depuis sa fiche.");
  await prisma.voeu.update({
    where: { id: v.id },
    data: {
      status: "refuse",
      decisionNote: note,
      decidedAt: new Date(),
      decidedBy: acteur.name,
      notifiedAt: null,
    },
  });
}

export async function remettreEnAttente(c: CampagneComplete, voeuId: number): Promise<void> {
  verifierInstruction(c);
  const v = c.voeux.find((x) => x.id === voeuId);
  if (!v) throw new UserFacingError("Vœu introuvable.");
  if (v.reservationId)
    throw new UserFacingError("Ce vœu a donné un dossier : annulez le dossier depuis sa fiche.");
  await prisma.voeu.update({
    where: { id: v.id },
    data: { status: "en_attente", decisionNote: null, decidedAt: null, decidedBy: null },
  });
}

export type BilanArbitrageServeur = { attribues: number; refuses: number; erreurs: number };

/**
 * Arbitrage automatique de tous les vœux en attente : les conflits sont tranchés par
 * priorité puis ancienneté, les vœux retenus donnent chacun un dossier (un échec de création,
 * créneau déjà pris ou règle de l'espace, laisse le vœu en attente avec le motif).
 */
export async function arbitrerCampagne(
  c: CampagneComplete,
  acteur: { name: string; email: string },
): Promise<BilanArbitrageServeur> {
  verifierInstruction(c);
  const a = arbitrer(arbitrables(c));
  const parId = new Map(c.voeux.map((v) => [v.id, v]));
  const bilan: BilanArbitrageServeur = { attribues: 0, refuses: 0, erreurs: 0 };
  for (const e of a.ecartes) {
    const gagnant = parId.get(e.gagnantId);
    await prisma.voeu.update({
      where: { id: e.id },
      data: {
        status: "refuse",
        decisionNote: gagnant
          ? `Créneau attribué en priorité à ${gagnant.organisation.name} (${decrireCreneauHebdo(gagnant)}).`
          : "Créneau attribué à une demande prioritaire.",
        decidedAt: new Date(),
        decidedBy: acteur.name,
        notifiedAt: null,
      },
    });
    bilan.refuses += 1;
  }
  for (const id of a.retenus) {
    try {
      // Rechargée à chaque tour : les dossiers créés avant comptent dans la disponibilité.
      const frais = (await chargerCampagne(c.id)) ?? c;
      await attribuerVoeu(frais, id, acteur);
      bilan.attribues += 1;
    } catch (err) {
      if (!(err instanceof UserFacingError)) throw err;
      await prisma.voeu.update({ where: { id }, data: { decisionNote: err.message } });
      bilan.erreurs += 1;
    }
  }
  await auditRecord(
    "arbitrage campagne",
    `${c.label} · ${bilan.attribues} attribué(s), ${bilan.refuses} refusé(s), ${bilan.erreurs} en erreur`,
    "reservations",
    acteur.email,
  );
  return bilan;
}

/** Courriel groupé des décisions : un par organisation ayant des décisions non communiquées. */
export async function notifierDecisions(
  c: CampagneComplete,
  acteur: { name: string; email: string },
): Promise<number> {
  const cfg = await getSettings();
  const aPrevenir = c.voeux.filter((v) => v.status !== "en_attente" && !v.notifiedAt);
  const parOrg = new Map<number, VoeuComplet[]>();
  for (const v of aPrevenir)
    parOrg.set(v.organisationId, [...(parOrg.get(v.organisationId) ?? []), v]);
  let n = 0;
  for (const [orgId, voeux] of parOrg) {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      include: {
        users: {
          where: { kind: "usager", isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });
    if (!org) continue;
    const destinataire = org.users[0];
    const to = destinataire?.email ?? org.email;
    const attribues = voeux.filter((v) => v.status === "attribue");
    const refuses = voeux.filter((v) => v.status === "refuse");
    const ligne = (v: VoeuComplet) =>
      `• ${decrireCreneauHebdo(v)} · ${v.espace.shortName || v.espace.name}`;
    const texteAttribues = attribues.length
      ? `${pluriel(attribues.length, "créneau attribué", "créneaux attribués")} :\n${attribues
          .map((v) => `${ligne(v)} — dossier ${v.reservation?.numero ?? ""}`)
          .join("\n")}`
      : "";
    const texteRefuses = refuses.length
      ? `${pluriel(refuses.length, "vœu non retenu", "vœux non retenus")} :\n${refuses
          .map((v) => `${ligne(v)}${v.decisionNote ? ` — ${v.decisionNote}` : ""}`)
          .join("\n")}`
      : "";
    const suite = attribues.length
      ? enabledIn(cfg, "signature")
        ? "Chaque créneau attribué fait l'objet d'une convention à signer depuis votre espace."
        : "Chaque créneau attribué fait l'objet d'une réservation confirmée visible dans votre espace."
      : "Nous restons à votre disposition pour étudier d'autres créneaux.";
    if (to) {
      await envoyerDepuisModele("campagne_decisions", to, {
        prenom: destinataire?.firstName || "Madame, Monsieur",
        organisation: org.name,
        campagne: c.label,
        attribues: texteAttribues,
        refuses: texteRefuses,
        suite,
        lien: `${cfg.APP_BASE_URL}/portail/mes-voeux`,
      });
    }
    if (destinataire)
      await notifier(
        destinataire.id,
        "reservation",
        `${c.label} : réponse à vos vœux`,
        `${attribues.length} attribué(s), ${refuses.length} refusé(s)`,
        "/portail/mes-voeux",
      );
    await prisma.voeu.updateMany({
      where: { id: { in: voeux.map((v) => v.id) } },
      data: { notifiedAt: new Date() },
    });
    n += 1;
  }
  await auditRecord(
    "decisions campagne",
    `${c.label} · ${n} organisation(s) prévenue(s)`,
    "reservations",
    acteur.email,
  );
  return n;
}
