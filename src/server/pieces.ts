/**
 * Les pièces attendues d'un usager face à la règle PIECES_REGLE : lecture des pièces de son
 * organisation, et refus du dépôt ou de l'acceptation d'une demande quand la Ville l'exige.
 * Règles pures dans src/lib/pieces.ts.
 */
import { todayParisISO } from "@/lib/paris-time";
import {
  type EtatPieceAttendue,
  lireReglePieces,
  phrasePiecesBloquantes,
  piecesBloquantes,
  piecesBloquent,
} from "@/lib/pieces";
import type { AppSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";

type Org = { id: number; type: string; name?: string };

/** Les pièces attendues manquantes ou expirées d'une organisation. */
export async function piecesBloquantesDe(
  org: Org,
  cfg: Pick<AppSettings, "ALERTE_PIECES_JOURS">,
): Promise<EtatPieceAttendue[]> {
  const pieces = await prisma.document.findMany({
    where: { organisationId: org.id },
    select: { kind: true, validUntil: true },
  });
  return piecesBloquantes(org.type, pieces, todayParisISO(), cfg.ALERTE_PIECES_JOURS);
}

/**
 * Refuse (UserFacingError) si la règle bloque à ce moment et que des pièces manquent ou sont
 * expirées. `moment` : dépôt d'une demande par l'usager, ou acceptation par un agent.
 */
export async function verifierPieces(
  org: Org,
  moment: "depot" | "acceptation",
  cfg: Pick<AppSettings, "ALERTE_PIECES_JOURS" | "PIECES_REGLE">,
): Promise<void> {
  if (!piecesBloquent(lireReglePieces(cfg.PIECES_REGLE), moment)) return;
  const bloquantes = await piecesBloquantesDe(org, cfg);
  if (!bloquantes.length) return;
  const detail = phrasePiecesBloquantes(bloquantes);
  throw new UserFacingError(
    moment === "depot"
      ? `Votre dossier ne permet pas de déposer une demande : ${detail}. Déposez les pièces à jour depuis « Mon organisation ».`
      : `Pièces de l'usager${org.name ? ` (${org.name})` : ""} : ${detail}. La règle « Pièces attendues » des Paramètres empêche l'acceptation tant qu'elles ne sont pas à jour.`,
  );
}
