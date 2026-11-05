/**
 * Priorité municipale : réquisition d'un créneau d'un dossier acquis pour un événement de la
 * Ville. Le créneau est déplacé (déplacement d'une occurrence, convention ou avenant à la
 * clé) ou annulé sans frais (le dossier entier si c'était son dernier créneau) ; l'usager est
 * prévenu par un courriel dédié. Règles pures dans src/lib/priorite.ts.
 */
import { plage } from "@/lib/libelles";
import {
  type ChoixRequisition,
  dernierPrevu,
  motifRequisition,
  obstacleRequisition,
  phraseSuite,
} from "@/lib/priorite";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { invalidateNavCounts } from "@/server/nav";
import {
  changerStatut,
  chargerReservation,
  courrielUsager,
  historiser,
  majBornes,
  type ReservationComplete,
  recalculerMontants,
} from "@/server/reservations";
import { deplacerSerie } from "@/server/serie";

export type BilanRequisition = {
  mode: ChoixRequisition["mode"];
  dossierAnnule: boolean;
  avenant: boolean;
  prevenu: boolean;
};

export async function requisitionner(opts: {
  r: ReservationComplete;
  creneauId: number;
  evenement: string;
  motif: string | null;
  choix: ChoixRequisition;
  prevenir: boolean;
  acteur: { email: string; name: string };
}): Promise<BilanRequisition> {
  const { r, choix, acteur } = opts;
  const c = r.creneaux.find((x) => x.id === opts.creneauId);
  if (!c) throw new UserFacingError("Créneau introuvable.");
  const obstacle = obstacleRequisition(r, c);
  if (obstacle) throw new UserFacingError(obstacle);
  const evenement = opts.evenement.trim().slice(0, 160);
  if (!evenement)
    throw new UserFacingError("Indiquez l'événement de la Ville qui motive la réquisition.");
  const motif = opts.motif?.trim().slice(0, 300) || null;
  const libelle = motifRequisition(evenement, motif);
  const ancien = { startAt: c.startAt, endAt: c.endAt };
  const montantAvant = r.montantTtc;

  let dossierAnnule = false;
  let avenant = false;
  if (choix.mode === "deplacer") {
    const b = await deplacerSerie({
      r,
      cibleId: c.id,
      nouveau: choix.nouveau,
      portee: "cette",
      prevenir: false,
      acteur,
    });
    avenant = b.convention === "avenant";
    await historiser(
      r.id,
      "Réquisition municipale",
      `${libelle} · ${plage(ancien.startAt, ancien.endAt)} → ${plage(choix.nouveau.startAt, choix.nouveau.endAt)}`,
      acteur.name,
    );
  } else if (dernierPrevu(r.creneaux, c.id)) {
    dossierAnnule = true;
    await changerStatut(
      r.id,
      "annulee",
      { name: acteur.name, isAgent: true },
      {
        motif: libelle,
        sansFrais: true,
        parSysteme: true,
        sansCourriel: true,
      },
    );
    await historiser(r.id, "Réquisition municipale", libelle, acteur.name);
  } else {
    await prisma.creneau.update({ where: { id: c.id }, data: { status: "annule" } });
    await majBornes(r.id);
    await recalculerMontants(r.id);
    await historiser(
      r.id,
      "Réquisition municipale",
      `${libelle} · créneau du ${plage(ancien.startAt, ancien.endAt)} annulé sans frais`,
      acteur.name,
    );
  }
  await auditRecord(
    "requisition municipale",
    `${r.numero} · ${evenement} · ${plage(ancien.startAt, ancien.endAt)}`,
    "reservations",
    acteur.email,
  );
  invalidateNavCounts();

  let prevenu = false;
  if (opts.prevenir) {
    const maj = (await chargerReservation(r.id)) ?? r;
    await courrielUsager(maj, "priorite_municipale", {
      evenement,
      motif: motif ?? "organisation d'un événement municipal",
      creneau: plage(ancien.startAt, ancien.endAt),
      suite: phraseSuite(ancien, choix, {
        dossierAnnule,
        avenant,
        montantChange: !dossierAnnule && Math.abs(maj.montantTtc - montantAvant) > 0.005,
      }),
    });
    prevenu = Boolean(maj.user?.email ?? maj.organisation?.email);
  }
  return { mode: choix.mode, dossierAnnule, avenant, prevenu };
}
