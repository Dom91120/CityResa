/**
 * Délais des étapes de circuit, lus en base : les étapes demandées sur la période, rangées
 * par étape et par service du dossier.
 */
import { type Delai, delaiDe, delaisParGroupe, type LigneEtape } from "@/lib/circuits-delais";
import { processusActif } from "@/server/circuits";
import { prisma } from "@/server/db";

export type DelaisEtapes = {
  depuis: Date;
  ensemble: Delai;
  parEtape: Delai[];
  parService: Delai[];
};

const SANS_SERVICE = "Sans service";

/** Les délais des étapes demandées depuis `mois` mois. */
export async function delaisEtapes(mois: number, now = new Date()): Promise<DelaisEtapes | null> {
  if (!(await processusActif())) return null;
  const depuis = new Date(now);
  depuis.setMonth(depuis.getMonth() - mois);
  const etapes = await prisma.dossierEtape.findMany({
    where: { ouvertAt: { gte: depuis }, status: { in: ["ouverte", "validee", "refusee"] } },
    select: {
      objet: true,
      objetId: true,
      libelle: true,
      status: true,
      ouvertAt: true,
      closAt: true,
      echeanceAt: true,
    },
  });
  // Le service de chaque dossier, type par type.
  const ids = (objet: string) => [
    ...new Set(etapes.filter((e) => e.objet === objet).map((e) => e.objetId)),
  ];
  const sel = { id: true, serviceId: true } as const;
  const [reservations, subventions, campagnes, services] = await Promise.all([
    prisma.reservation.findMany({ where: { id: { in: ids("reservation") } }, select: sel }),
    prisma.subvention.findMany({ where: { id: { in: ids("subvention") } }, select: sel }),
    prisma.campagne.findMany({ where: { id: { in: ids("campagne") } }, select: sel }),
    prisma.service.findMany({ select: { id: true, name: true } }),
  ]);
  const noms = new Map(services.map((s) => [s.id, s.name]));
  const serviceDe = new Map<string, string>();
  for (const [objet, dossiers] of [
    ["reservation", reservations],
    ["subvention", subventions],
    ["campagne", campagnes],
  ] as const)
    for (const d of dossiers)
      serviceDe.set(
        `${objet}:${d.id}`,
        (d.serviceId ? noms.get(d.serviceId) : null) ?? SANS_SERVICE,
      );
  const ligne = (e: (typeof etapes)[number], groupe: string): LigneEtape => ({
    groupe,
    status: e.status,
    ouvertAt: e.ouvertAt,
    closAt: e.closAt,
    echeanceAt: e.echeanceAt,
  });
  return {
    depuis,
    ensemble: delaiDe(
      "Ensemble",
      etapes.map((e) => ligne(e, "Ensemble")),
      now,
    ),
    parEtape: delaisParGroupe(
      etapes.map((e) => ligne(e, e.libelle)),
      now,
    ),
    parService: delaisParGroupe(
      etapes.map((e) => ligne(e, serviceDe.get(`${e.objet}:${e.objetId}`) ?? SANS_SERVICE)),
      now,
    ),
  };
}
