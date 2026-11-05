/**
 * Caution et états des lieux d'un dossier : états des lieux d'entrée et de sortie (observations,
 * dégâts, photos), encaissement, restitution après l'état des lieux de sortie, retenue motivée
 * avec seconde validation au-delà du seuil, courriels à l'usager. Règles pures dans src/lib/caution.ts.
 */
import type { Prisma } from "@/generated/prisma/client";
import { obstacleCloture, retenueAValider, verifierRetenue } from "@/lib/caution";
import { dateHeure, montant } from "@/lib/libelles";
import { auditRecord } from "@/server/audit";
import type { AppSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { deposerDocument, type FichierLu } from "@/server/documents";
import { UserFacingError } from "@/server/errors";
import {
  chargerReservation,
  courrielUsager,
  historiser,
  type ReservationComplete,
} from "@/server/reservations";

export const INCLUDE_EDL = {
  documents: { orderBy: { position: "asc" as const } },
} satisfies Prisma.EtatDesLieuxInclude;

export type EtatDesLieuxComplet = Prisma.EtatDesLieuxGetPayload<{ include: typeof INCLUDE_EDL }>;

export async function etatsDesLieux(reservationId: number): Promise<EtatDesLieuxComplet[]> {
  return prisma.etatDesLieux.findMany({
    where: { reservationId },
    include: INCLUDE_EDL,
    orderBy: { kind: "asc" },
  });
}

export type EtatDesLieuxEntree = {
  observations: string | null;
  degats: boolean;
  signataire: string | null;
};

/** Enregistre (ou complète) l'état des lieux d'entrée ou de sortie, avec ses photos. */
export async function enregistrerEtatDesLieux(
  r: ReservationComplete,
  kind: "entree" | "sortie",
  e: EtatDesLieuxEntree,
  photos: FichierLu[],
  acteur: { name: string; email: string; id: string },
): Promise<EtatDesLieuxComplet> {
  if (!["acceptee", "signee", "confirmee", "terminee"].includes(r.status))
    throw new UserFacingError("Un état des lieux se fait sur un dossier acquis ou terminé.");
  const edl = await prisma.etatDesLieux.upsert({
    where: { reservationId_kind: { reservationId: r.id, kind } },
    create: {
      reservationId: r.id,
      kind,
      agent: acteur.name,
      observations: e.observations,
      degats: e.degats,
      signataire: e.signataire,
    },
    update: {
      agent: acteur.name,
      doneAt: new Date(),
      observations: e.observations,
      degats: e.degats,
      signataire: e.signataire,
    },
  });
  for (const f of photos) {
    await deposerDocument({
      kind: "etat_des_lieux",
      parentId: edl.id,
      fichier: f,
      docKind: "etat_des_lieux",
      title: `État des lieux ${kind === "entree" ? "d'entrée" : "de sortie"}`,
      uploadedById: acteur.id,
    });
  }
  await historiser(
    r.id,
    `État des lieux ${kind === "entree" ? "d'entrée" : "de sortie"}`,
    [
      e.degats ? "dégâts constatés" : "sans dégât",
      photos.length ? `${photos.length} photo(s)` : null,
      e.signataire ? `en présence de ${e.signataire}` : null,
      e.observations,
    ]
      .filter(Boolean)
      .join(" · "),
    acteur.name,
  );
  await auditRecord(`etat des lieux ${kind}`, r.numero, "reservations", acteur.email);
  return (await prisma.etatDesLieux.findUniqueOrThrow({
    where: { id: edl.id },
    include: INCLUDE_EDL,
  })) as EtatDesLieuxComplet;
}

/** Un agent constate la réception de la caution (chèque, espèces) sans passer par une facture. */
export async function marquerCautionEncaissee(
  r: ReservationComplete,
  acteur: { name: string; email: string },
): Promise<void> {
  if (r.caution <= 0) throw new UserFacingError("Ce dossier n'a pas de caution.");
  if (!["aucune", "attendue"].includes(r.cautionStatus))
    throw new UserFacingError("La caution est déjà encaissée.");
  await prisma.reservation.update({
    where: { id: r.id },
    data: { cautionStatus: "encaissee", cautionEncaisseeAt: new Date() },
  });
  await historiser(r.id, "Caution encaissée", montant(r.caution), acteur.name);
  await auditRecord(
    "caution encaissee",
    `${r.numero} · ${montant(r.caution)}`,
    "reservations",
    acteur.email,
  );
}

async function factureCautionRemboursee(r: ReservationComplete): Promise<void> {
  const f = r.factures.find((x) => x.type === "caution" && x.status === "payee");
  if (f) await prisma.facture.update({ where: { id: f.id }, data: { status: "remboursee" } });
}

/** Restitue la caution en totalité, après l'état des lieux de sortie. */
export async function restituerCaution(
  r: ReservationComplete,
  acteur: { name: string; email: string },
): Promise<void> {
  const sortie = await prisma.etatDesLieux.findFirst({
    where: { reservationId: r.id, kind: "sortie" },
  });
  const obstacle = obstacleCloture(r, Boolean(sortie));
  if (obstacle) throw new UserFacingError(obstacle);
  await prisma.reservation.update({
    where: { id: r.id },
    data: {
      cautionStatus: "restituee",
      cautionClotureeAt: new Date(),
      cautionRetenue: 0,
      cautionMotif: null,
      cautionDecideePar: acteur.name,
    },
  });
  await factureCautionRemboursee(r);
  await historiser(r.id, "Caution restituée", montant(r.caution), acteur.name);
  await auditRecord(
    "caution restituee",
    `${r.numero} · ${montant(r.caution)}`,
    "reservations",
    acteur.email,
  );
  const maj = await chargerReservation(r.id);
  if (maj)
    await courrielUsager(maj, "caution_restituee", {
      montant_caution: montant(r.caution),
      date: dateHeure(new Date()),
    });
}

/**
 * Retient tout ou partie de la caution après l'état des lieux de sortie. Au-delà du seuil, la
 * retenue attend la validation d'un administrateur avant d'être notifiée à l'usager.
 */
export async function retenirCaution(
  r: ReservationComplete,
  montantRetenu: number,
  motif: string | null,
  acteur: { name: string; email: string },
  cfg: Pick<AppSettings, "CAUTION_SEUIL_VALIDATION">,
): Promise<"retenue" | "retenue_a_valider"> {
  const sortie = await prisma.etatDesLieux.findFirst({
    where: { reservationId: r.id, kind: "sortie" },
    include: { _count: { select: { documents: true } } },
  });
  const obstacle = obstacleCloture(r, Boolean(sortie));
  if (obstacle) throw new UserFacingError(obstacle);
  const erreurs = verifierRetenue(
    montantRetenu,
    r.caution,
    motif,
    sortie
      ? {
          degats: sortie.degats,
          observations: sortie.observations,
          photos: sortie._count.documents,
        }
      : null,
  );
  if (erreurs.length) throw new UserFacingError(erreurs.join(" "));
  const statut = retenueAValider(montantRetenu, cfg.CAUTION_SEUIL_VALIDATION)
    ? "retenue_a_valider"
    : "retenue";
  await prisma.reservation.update({
    where: { id: r.id },
    data: {
      cautionStatus: statut,
      cautionClotureeAt: statut === "retenue" ? new Date() : null,
      cautionRetenue: Math.round(montantRetenu * 100) / 100,
      cautionMotif: motif,
      cautionDecideePar: acteur.name,
      cautionValideePar: null,
    },
  });
  await historiser(
    r.id,
    statut === "retenue" ? "Caution retenue" : "Retenue sur caution à valider",
    `${montant(montantRetenu)} sur ${montant(r.caution)} · ${motif}`,
    acteur.name,
  );
  await auditRecord(
    `caution ${statut}`,
    `${r.numero} · ${montant(montantRetenu)}`,
    "reservations",
    acteur.email,
  );
  if (statut === "retenue") await notifierRetenue(r.id, montantRetenu, motif ?? "");
  return statut;
}

async function notifierRetenue(reservationId: number, montantRetenu: number, motif: string) {
  const maj = await chargerReservation(reservationId);
  if (!maj) return;
  await factureCautionRemboursee(maj);
  const reste = Math.max(0, Math.round((maj.caution - montantRetenu) * 100) / 100);
  await courrielUsager(maj, "caution_retenue", {
    montant_caution: montant(maj.caution),
    montant_retenu: montant(montantRetenu),
    motif,
    reste:
      reste > 0
        ? `Le solde de ${montant(reste)} vous est restitué.`
        : "La caution est retenue en totalité.",
  });
}

/** Un administrateur valide une retenue au-delà du seuil ; l'usager est alors prévenu. */
export async function validerRetenue(
  r: ReservationComplete,
  acteur: { name: string; email: string },
): Promise<void> {
  if (r.cautionStatus !== "retenue_a_valider")
    throw new UserFacingError("Aucune retenue n'attend de validation sur ce dossier.");
  await prisma.reservation.update({
    where: { id: r.id },
    data: {
      cautionStatus: "retenue",
      cautionClotureeAt: new Date(),
      cautionValideePar: acteur.name,
    },
  });
  await historiser(r.id, "Retenue sur caution validée", montant(r.cautionRetenue), acteur.name);
  await auditRecord(
    "caution retenue validee",
    `${r.numero} · ${montant(r.cautionRetenue)}`,
    "reservations",
    acteur.email,
  );
  await notifierRetenue(r.id, r.cautionRetenue, r.cautionMotif ?? "");
}
