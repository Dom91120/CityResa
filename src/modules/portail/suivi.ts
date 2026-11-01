/**
 * Le suivi des dossiers d'un usager : chargement contrôlé (whereUsager), la phrase
 * « prochaine étape » d'un dossier, le fil de discussion visible (jamais les notes
 * internes), l'historique sans notes internes.
 */
import type { Prisma } from "@/generated/prisma/client";
import { RESERVATION_STATUS, type ReservationStatus } from "@/lib/constantes";
import type { AppSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { enabledIn } from "@/server/features";
import type { CurrentUser } from "@/server/guards";
import {
  annulableParUsager,
  INCLUDE_RESERVATION,
  type ReservationComplete,
  whereUsager,
} from "@/server/reservations";

export const INCLUDE_RESERVATION_USAGER = {
  ...INCLUDE_RESERVATION,
  espace: {
    include: {
      site: true,
      documents: {
        where: { kind: "photo", isPublic: true },
        orderBy: [{ position: "asc" as const }, { createdAt: "desc" as const }],
        take: 1,
      },
    },
  },
} satisfies Prisma.ReservationInclude;

export type ReservationUsager = Prisma.ReservationGetPayload<{
  include: typeof INCLUDE_RESERVATION_USAGER;
}>;

/** Les dossiers visibles par l'usager. */
export async function reservationsUsager(user: CurrentUser): Promise<ReservationUsager[]> {
  return prisma.reservation.findMany({
    where: { AND: [whereUsager(user), { status: { not: "brouillon" } }] },
    include: INCLUDE_RESERVATION_USAGER,
    orderBy: { startAt: "asc" },
  });
}

/** Un dossier de l'usager, ou null s'il n'est pas le sien. */
export async function reservationUsager(
  user: CurrentUser,
  id: number,
): Promise<ReservationUsager | null> {
  return prisma.reservation.findFirst({
    where: { AND: [{ id }, whereUsager(user)] },
    include: INCLUDE_RESERVATION_USAGER,
  });
}

/** Le dossier appartient-il à l'usager ? (contrôle des routes d'écriture) */
export async function possede(user: CurrentUser, id: number): Promise<boolean> {
  const r = await prisma.reservation.findFirst({
    where: { AND: [{ id }, whereUsager(user)] },
    select: { id: true },
  });
  return Boolean(r);
}

export type Etape = { texte: string; icone: string; teinte: string; action?: string };

/** La phrase « prochaine étape » d'un dossier, pour l'usager. */
export function prochaineEtape(
  r: Pick<ReservationComplete, "status" | "startAt" | "acompte" | "montantTtc" | "factures">,
  cfg: AppSettings,
): Etape {
  const s = r.status as ReservationStatus;
  const facturesDues = r.factures.filter((f) => f.status === "a_payer");
  switch (s) {
    case "brouillon":
      return { texte: "Demande non envoyée.", icone: "pencil", teinte: "slate" };
    case "a_traiter":
      return {
        texte:
          "Votre demande est bien reçue : la collectivité l'étudie et vous répond au plus vite.",
        icone: "hourglass",
        teinte: "amber",
      };
    case "en_traitement":
      return {
        texte:
          "La collectivité vous a demandé des précisions : répondez dans le fil de discussion.",
        icone: "message-circle",
        teinte: "sky",
        action: "messages",
      };
    case "acceptee":
      return enabledIn(cfg, "signature")
        ? {
            texte:
              "Bonne nouvelle, votre demande est acceptée : il vous reste à signer la convention.",
            icone: "pen-line",
            teinte: "rose",
            action: "signature",
          }
        : {
            texte: "Votre demande est acceptée : la collectivité finalise la convention.",
            icone: "file-signature",
            teinte: "rose",
          };
    case "signee":
      return facturesDues.length
        ? {
            texte: "Convention signée : votre réservation sera confirmée à réception de l'acompte.",
            icone: "credit-card",
            teinte: "violet",
            action: "factures",
          }
        : {
            texte: "Convention signée : la confirmation est en cours.",
            icone: "file-check",
            teinte: "violet",
          };
    case "confirmee":
      return facturesDues.length
        ? {
            texte: "Réservation confirmée. Une facture reste à régler avant l'événement.",
            icone: "credit-card",
            teinte: "emerald",
            action: "factures",
          }
        : {
            texte: "Tout est en ordre : l'espace est réservé pour vous.",
            icone: "circle-check",
            teinte: "emerald",
          };
    case "terminee":
      return { texte: "L'événement a eu lieu. Merci !", icone: "check-check", teinte: "slate" };
    case "refusee":
      return {
        texte: "La collectivité n'a pas pu donner suite à cette demande.",
        icone: "circle-x",
        teinte: "red",
      };
    case "annulee":
      return { texte: "Cette réservation a été annulée.", icone: "ban", teinte: "red" };
    default:
      return { texte: RESERVATION_STATUS[s]?.aide ?? "", icone: "archive", teinte: "slate" };
  }
}

/** Le dossier est-il « en cours » (onglet En cours) ? */
export function enCours(status: string): boolean {
  return RESERVATION_STATUS[status as ReservationStatus]?.actif ?? false;
}

/** L'usager peut-il annuler lui-même ce dossier ? */
export function peutAnnuler(r: { status: string; startAt: Date }, cfg: AppSettings): boolean {
  return annulableParUsager(r, cfg.DELAI_ANNULATION_JOURS);
}

/** Le fil de discussion visible par l'usager (jamais les notes internes). */
export async function messagesVisibles(reservationId: number) {
  return prisma.message.findMany({
    where: { reservationId, isInternal: false },
    include: { author: { select: { firstName: true, lastName: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Marque lus les messages de la collectivité sur ce dossier. */
export async function marquerMessagesLus(reservationId: number): Promise<void> {
  await prisma.message.updateMany({
    where: { reservationId, authorKind: "agent", isInternal: false, readAt: null },
    data: { readAt: new Date() },
  });
}

/** L'historique visible par l'usager : sans les notes internes. */
export async function historiqueVisible(reservationId: number) {
  const lignes = await prisma.reservationHistory.findMany({
    where: { reservationId },
    orderBy: { performedAt: "desc" },
  });
  return lignes.filter((l) => !/interne/i.test(l.action));
}
