/**
 * Fermeture exceptionnelle d'un espace : aperçu des dossiers touchés avant de poser le blocage,
 * puis blocage avec, au choix, annulation des occurrences touchées et courriel aux usagers.
 */
import { after } from "next/server";
import { lignesCourriel } from "@/lib/alternatives";
import {
  apercuInchange,
  type BilanFermeture,
  type DossierTouche,
  dossiersTouches,
  planFermeture,
} from "@/lib/fermetures";
import { plage } from "@/lib/libelles";
import { alternativesPour } from "@/server/alternatives";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { invalidateNavCounts } from "@/server/nav";
import {
  chargerReservation,
  courrielUsager,
  majBornes,
  occupants,
  recalculerMontants,
} from "@/server/reservations";

/** L'aperçu d'une fermeture : la page qui liste les dossiers touchés avant de confirmer. */
export function urlApercuFermeture(p: {
  espaceId: number;
  startAt: Date;
  endAt: Date;
  motif: string | null;
  next: string;
}): string {
  const q = new URLSearchParams({
    espace: String(p.espaceId),
    debut: p.startAt.toISOString(),
    fin: p.endAt.toISOString(),
    next: p.next,
  });
  if (p.motif) q.set("motif", p.motif.slice(0, 200));
  return `/planning/fermeture?${q.toString()}`;
}

export type DossierFermeture = DossierTouche & {
  numero: string;
  title: string;
  status: string;
  demandeur: string;
};

/** Les dossiers dont des créneaux prévus tombent sur la période (espace et sa famille). */
export async function apercuFermeture(
  espaceId: number,
  startAt: Date,
  endAt: Date,
): Promise<DossierFermeture[]> {
  const occ = (await occupants(espaceId, startAt, endAt)).filter(
    (o) => o.genre === "reservation" && o.reservationId !== null,
  );
  if (!occ.length) return [];
  const ids = [...new Set(occ.map((o) => o.reservationId as number))];
  const [comptes, dossiers] = await Promise.all([
    prisma.creneau.groupBy({
      by: ["reservationId"],
      where: { reservationId: { in: ids }, status: "prevu" },
      _count: { _all: true },
    }),
    prisma.reservation.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        numero: true,
        title: true,
        status: true,
        user: { select: { firstName: true, lastName: true } },
        organisation: { select: { name: true } },
      },
    }),
  ]);
  const parId = new Map(dossiers.map((d) => [d.id, d]));
  return dossiersTouches(
    occ.map((o) => ({
      creneauId: o.id,
      reservationId: o.reservationId as number,
      startAt: o.startAt,
      endAt: o.endAt,
    })),
    new Map(comptes.map((c) => [c.reservationId, c._count._all])),
  ).flatMap((t) => {
    const d = parId.get(t.reservationId);
    if (!d) return [];
    const personne = d.user ? `${d.user.firstName} ${d.user.lastName}`.trim() : "";
    return [
      {
        ...t,
        numero: d.numero,
        title: d.title,
        status: d.status,
        demandeur: d.organisation?.name ?? personne,
      },
    ];
  });
}

/**
 * Pose la fermeture vue dans l'aperçu (`vus` : ses créneaux touchés). Refuse si la situation a
 * changé depuis. Blocage, annulations et historiques sont écrits ensemble ; bornes et montants
 * sont recalculés ensuite ; les courriels partent après la réponse.
 */
export async function poserFermeture(opts: {
  espace: { id: number; name: string };
  startAt: Date;
  endAt: Date;
  motif: string | null;
  annuler: boolean;
  prevenir: boolean;
  vus: number[];
  acteur: { email: string; name: string };
}): Promise<BilanFermeture | "apercu_perime"> {
  const { espace, startAt, endAt, motif, acteur } = opts;
  const touches = await apercuFermeture(espace.id, startAt, endAt);
  if (!apercuInchange(opts.vus, touches)) return "apercu_perime";
  const { creneauxAAnnuler, dossiersAnnules, bilan } = planFermeture(touches, opts);
  const periode = plage(startAt, endAt);
  const dates = new Map(
    touches.map((t) => [
      t.reservationId,
      t.occurrences.map((o) => plage(o.startAt, o.endAt)).join(" ; "),
    ]),
  );
  await prisma.$transaction([
    prisma.indisponibilite.create({
      data: {
        espaceId: espace.id,
        startAt,
        endAt,
        motif: motif?.slice(0, 200) ?? null,
        createdBy: acteur.email,
      },
    }),
    prisma.creneau.updateMany({
      where: { id: { in: creneauxAAnnuler }, status: "prevu" },
      data: { status: "annule" },
    }),
    prisma.reservationHistory.createMany({
      data: touches.map((t) => ({
        reservationId: t.reservationId,
        action: dossiersAnnules.has(t.reservationId)
          ? "Créneaux annulés (fermeture)"
          : "Fermeture exceptionnelle",
        comment: `${espace.name} fermé (${periode})${motif ? ` · ${motif}` : ""} : ${dates.get(t.reservationId)}`,
        performedBy: acteur.name,
      })),
    }),
  ]);
  // Valeurs dérivées des créneaux : recalculables à tout moment depuis la fiche du dossier.
  for (const id of dossiersAnnules) {
    await majBornes(id);
    await recalculerMontants(id);
  }
  await auditRecord(
    "fermeture exceptionnelle",
    `${espace.name} · ${periode}${motif ? ` · ${motif}` : ""} · ${bilan.dossiers} dossier(s), ${bilan.annulees} créneau(x) annulé(s), ${bilan.prevenus} usager(s) prévenu(s)`,
    "planning",
    acteur.email,
  );
  invalidateNavCounts();
  if (opts.prevenir)
    after(async () => {
      for (const t of touches) {
        const r = await chargerReservation(t.reservationId);
        if (!r) continue;
        // Le blocage est posé : les alternatives proposées sont hors fermeture et libres.
        const premiere = t.occurrences[0];
        const alternatives = premiere
          ? await alternativesPour({
              espaceId: espace.id,
              i: premiere,
              excludeReservationId: t.reservationId,
              ignorerDelai: true,
            })
          : [];
        await courrielUsager(r, "fermeture_exceptionnelle", {
          fermeture: periode,
          motif: motif ?? "raison de service",
          occurrences: dates.get(t.reservationId) ?? "",
          suite: [
            dossiersAnnules.has(t.reservationId)
              ? "Ces créneaux sont annulés et retirés du montant de votre réservation."
              : "Nos services reviennent vers vous pour la suite à donner.",
            lignesCourriel(alternatives),
          ]
            .filter(Boolean)
            .join(" "),
        });
      }
    });
  return bilan;
}
