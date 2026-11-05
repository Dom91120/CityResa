/**
 * Modification d'une récurrence depuis la fiche d'un dossier : déplace cette occurrence seule,
 * celle-ci et les suivantes, ou toute la série, après contrôle des règles de l'espace, des
 * chevauchements internes et de la disponibilité. Règles pures dans src/lib/serie.ts.
 */
import { after } from "next/server";
import { type ReservationStatus, STATUTS_OCCUPANTS } from "@/lib/constantes";
import { type Intervalle, lireRecurrence, reglesAuCreneau, verifierRegles } from "@/lib/creneaux";
import { dateMoyenne, montant, plage } from "@/lib/libelles";
import {
  chevauchementInterne,
  creneauxPrevus,
  creneauxVises,
  decalage,
  decrireDeplacements,
  deplacer,
  memeIntervalle,
  type Portee,
  recurrenceDeplacee,
} from "@/lib/serie";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { horairesSaisonDe } from "@/server/horaires";
import { notifierLiberation } from "@/server/liste-attente";
import { invalidateNavCounts } from "@/server/nav";
import {
  chargerReservation,
  courrielUsager,
  majBornes,
  type ReservationComplete,
  recalculerMontants,
  verifierDisponibilite,
} from "@/server/reservations";

export type BilanSerie = {
  nb: number;
  /** Ce qu'il est advenu de la convention : régénérée, complétée d'un avenant (elle était signée), ou sans objet. */
  convention: "regeneree" | "avenant" | null;
};

/** Les créneaux d'un dossier se modifient-ils encore ? */
export function serieModifiable(r: { status: string }): boolean {
  return STATUTS_OCCUPANTS.includes(r.status as ReservationStatus);
}

/**
 * Déplace la cible sur `nouveau` et, selon la portée, les autres créneaux prévus d'autant.
 * Lève une UserFacingError sur toute règle non respectée ; rien n'est écrit dans ce cas.
 */
export async function deplacerSerie(opts: {
  r: ReservationComplete;
  cibleId: number;
  nouveau: Intervalle;
  portee: Portee;
  prevenir: boolean;
  acteur: { email: string; name: string };
}): Promise<BilanSerie> {
  const { r, nouveau, portee, acteur } = opts;
  if (!serieModifiable(r))
    throw new UserFacingError("Les créneaux de ce dossier ne se modifient plus.");
  const cible = r.creneaux.find((c) => c.id === opts.cibleId);
  if (!cible) throw new UserFacingError("Créneau introuvable.");
  if (cible.status !== "prevu") throw new UserFacingError("Ce créneau est annulé.");
  if (memeIntervalle(cible, nouveau)) throw new UserFacingError("L'horaire est inchangé.");

  const vises = creneauxVises(r.creneaux, cible, portee);
  const d = decalage(cible, nouveau);
  const deps = deplacer(vises, d);
  const now = new Date();
  const periodes = await horairesSaisonDe(r.espaceId);
  for (const { apres } of deps) {
    const erreurs = verifierRegles(reglesAuCreneau(r.espace, periodes, apres), apres, now, {
      ignorerDelai: true,
    });
    if (erreurs.length)
      throw new UserFacingError(`${dateMoyenne(apres.startAt)} : ${erreurs.join(" ")}`);
  }
  const visesIds = new Set(vises.map((c) => c.id));
  const fixes = creneauxPrevus(r.creneaux).filter((c) => !visesIds.has(c.id));
  const interne = chevauchementInterne(
    deps.map((x) => x.apres),
    fixes,
  );
  if (interne)
    throw new UserFacingError(
      `Deux créneaux du dossier se chevaucheraient : ${plage(interne.a.startAt, interne.a.endAt)} et ${plage(interne.b.startAt, interne.b.endAt)}.`,
    );
  const conflits = await verifierDisponibilite(
    r.espace,
    deps.map((x) => x.apres),
    r.id,
  );
  if (conflits.length) {
    const c = conflits[0];
    throw new UserFacingError(
      `Créneau indisponible : ${plage(c.demande.startAt, c.demande.endAt)} chevauche « ${c.existant.libelle} »${conflits.length > 1 ? ` (${conflits.length} conflits)` : ""}.`,
    );
  }

  const detail = decrireDeplacements(deps);
  const rec = lireRecurrence(r.recurrence);
  const recApres = portee === "serie" ? recurrenceDeplacee(rec, d.jours) : rec;
  await prisma.$transaction([
    ...deps.map((x) =>
      prisma.creneau.update({
        where: { id: x.creneau.id },
        data: { startAt: x.apres.startAt, endAt: x.apres.endAt },
      }),
    ),
    ...(recApres !== rec
      ? [
          prisma.reservation.update({
            where: { id: r.id },
            data: { recurrence: recApres ? (recApres as object) : undefined },
          }),
        ]
      : []),
    prisma.reservationHistory.create({
      data: {
        reservationId: r.id,
        action: deps.length === 1 ? "Créneau déplacé" : "Série modifiée",
        comment: detail,
        performedBy: acteur.name,
      },
    }),
  ]);
  await majBornes(r.id);
  const devis = await recalculerMontants(r.id);
  // Les anciens créneaux sont libres : la liste d'attente de l'espace est prévenue.
  await notifierLiberation(
    r.espaceId,
    deps.map((x) => x.creneau),
  ).catch((e) => console.error("[liste d'attente]", e));

  let convention: BilanSerie["convention"] = null;
  if (r.conventionDocumentId) {
    const maj = await chargerReservation(r.id);
    if (maj && r.signedAt) {
      // Convention signée : on ne la réécrit pas, un avenant formalise la modification.
      const { genererAvenant } = await import("@/server/avenant");
      await genererAvenant(maj, `Créneaux modifiés : ${detail}`, acteur.name).catch((e) =>
        console.error("[avenant]", e),
      );
      convention = "avenant";
    } else if (maj) {
      const { genererConvention } = await import("@/server/convention");
      await genererConvention(maj, acteur.name).catch((e) => console.error("[convention]", e));
      convention = "regeneree";
    }
  }
  await auditRecord(
    "modification creneaux",
    `${r.numero} · ${deps.length} créneau(x) · ${detail}`,
    "reservations",
    acteur.email,
  );
  invalidateNavCounts();

  if (opts.prevenir)
    after(async () => {
      const maj = await chargerReservation(r.id);
      if (!maj) return;
      await courrielUsager(maj, "creneaux_modifies", {
        modifications: detail,
        suite:
          Math.abs(devis.ttc - r.montantTtc) >= 0.005
            ? `Le montant de la réservation a été recalculé : ${montant(devis.ttc)} TTC.`
            : "Le montant de la réservation est inchangé.",
      });
    });
  return { nb: deps.length, convention };
}
