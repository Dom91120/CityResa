/**
 * Matériel : lecture du formulaire, stock mobilisé par les dossiers vivants, fiche,
 * suppression.
 *
 *   name · categorie_id · site_id · espace_id · description · stock_total · montant · unite · is_active
 */
import type { Prisma } from "@/generated/prisma/client";
import { MATERIEL_UNITES, STATUTS_OCCUPANTS } from "@/lib/constantes";
import { champ, champOuNull, coche, idOuNull, parseFloat_, parseInt_ } from "@/lib/forms-util";
import { type Mobilisation, picMobilisation } from "@/lib/materiel-stock";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";

export type MaterielEntree = {
  name: string;
  categorieId: number | null;
  description: string | null;
  siteId: number | null;
  espaceId: number | null;
  stockTotal: number;
  montant: number;
  unite: string;
  isActive: boolean;
  controleMois: number | null;
};

export function lireMateriel(form: FormData): MaterielEntree {
  const name = champ(form, "name").slice(0, 120);
  if (!name) throw new UserFacingError("Indiquez le nom du matériel.");
  const unite = champ(form, "unite");
  if (!(unite in MATERIEL_UNITES)) throw new UserFacingError("Mode de tarification inconnu.");
  const m = parseFloat_(form.get("montant"), 0) ?? 0;
  if (m < 0) throw new UserFacingError("Le montant ne peut pas être négatif.");
  return {
    name,
    categorieId: idOuNull(form, "categorie_id"),
    description: champOuNull(form, "description"),
    siteId: idOuNull(form, "site_id"),
    espaceId: idOuNull(form, "espace_id"),
    stockTotal: parseInt_(form.get("stock_total"), 0, 0) ?? 0,
    montant: unite === "gratuit" ? 0 : Math.round(m * 100) / 100,
    unite,
    isActive: coche(form, "is_active"),
    controleMois: parseInt_(form.get("controle_mois"), null, 1),
  };
}

/**
 * Quantité mobilisée par matériel au plus fort, sur les dossiers vivants dont la fin n'est
 * pas passée : seuls les dossiers qui se recouvrent s'additionnent.
 */
export async function stockMobilise(materielIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!materielIds.length) return out;
  const lignes = await prisma.reservationMateriel.findMany({
    where: {
      materielId: { in: materielIds },
      reservation: { status: { in: STATUTS_OCCUPANTS }, endAt: { gte: new Date() } },
    },
    select: {
      materielId: true,
      quantite: true,
      reservation: { select: { startAt: true, endAt: true } },
    },
  });
  const parMateriel = new Map<number, Mobilisation[]>();
  for (const l of lignes) {
    const liste = parMateriel.get(l.materielId) ?? [];
    liste.push({ debut: l.reservation.startAt, fin: l.reservation.endAt, quantite: l.quantite });
    parMateriel.set(l.materielId, liste);
  }
  for (const [id, liste] of parMateriel) out.set(id, picMobilisation(liste));
  return out;
}

/**
 * Le rattachement saisi, vérifié : un espace impose son site (le site saisi est ignoré) ; un
 * site ou un espace inconnu est refusé.
 */
export async function resoudreRattachement(e: {
  siteId: number | null;
  espaceId: number | null;
}): Promise<{ siteId: number | null; espaceId: number | null }> {
  if (e.espaceId) {
    const espace = await prisma.espace.findUnique({
      where: { id: e.espaceId },
      select: { id: true, siteId: true },
    });
    if (!espace) throw new UserFacingError("Espace de rattachement introuvable.");
    return { siteId: espace.siteId, espaceId: espace.id };
  }
  if (e.siteId) {
    const site = await prisma.site.findUnique({ where: { id: e.siteId }, select: { id: true } });
    if (!site) throw new UserFacingError("Site de rattachement introuvable.");
    return { siteId: site.id, espaceId: null };
  }
  return { siteId: null, espaceId: null };
}

/** Les sites et espaces proposés pour rattacher un matériel. */
export async function lieuxDeRattachement() {
  const [sites, espaces] = await Promise.all([
    prisma.site.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
    prisma.espace.findMany({
      where: { isActive: true },
      include: { site: true },
      orderBy: [{ site: { position: "asc" } }, { position: "asc" }, { name: "asc" }],
    }),
  ]);
  return { sites, espaces };
}

export const INCLUDE_MATERIEL = {
  categorie: true,
  site: true,
  espace: true,
  _count: { select: { reservations: true } },
} satisfies Prisma.MaterielInclude;

export type MaterielComplet = Prisma.MaterielGetPayload<{ include: typeof INCLUDE_MATERIEL }>;

export async function chargerMateriel(id: number): Promise<MaterielComplet | null> {
  return prisma.materiel.findUnique({ where: { id }, include: INCLUDE_MATERIEL });
}

/** Les réservations à venir (dossiers vivants) qui mobilisent ce matériel. */
export async function reservationsAVenir(materielId: number, limite = 20) {
  return prisma.reservationMateriel.findMany({
    where: {
      materielId,
      reservation: { status: { in: STATUTS_OCCUPANTS }, endAt: { gte: new Date() } },
    },
    include: {
      reservation: {
        select: {
          id: true,
          numero: true,
          title: true,
          status: true,
          startAt: true,
          endAt: true,
          espace: { select: { name: true, shortName: true, color: true } },
          organisation: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { reservation: { startAt: "asc" } },
    take: limite,
  });
}

/** Désactivation si des dossiers l'utilisent, suppression définitive sinon. */
export async function supprimerMateriel(id: number): Promise<string> {
  const m = await prisma.materiel.findUnique({
    where: { id },
    include: { _count: { select: { reservations: true } } },
  });
  if (!m) throw new UserFacingError("Matériel introuvable.");
  if (m._count.reservations > 0) {
    await prisma.materiel.update({ where: { id }, data: { isActive: false } });
    return `« ${m.name} » est utilisé par ${m._count.reservations} dossier(s) : il a été désactivé.`;
  }
  await prisma.materiel.delete({ where: { id } });
  return `Matériel « ${m.name} » supprimé.`;
}

/** La première photo (id de document) de chaque matériel. */
export async function premieresPhotosMateriel(ids: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!ids.length) return out;
  const docs = await prisma.document.findMany({
    where: { materielId: { in: ids }, kind: "photo" },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    select: { id: true, materielId: true },
  });
  for (const d of docs) if (d.materielId && !out.has(d.materielId)) out.set(d.materielId, d.id);
  return out;
}

export async function categoriesMateriel() {
  return prisma.referential.findMany({
    where: { kind: "materiel_categorie", isActive: true },
    orderBy: [{ position: "asc" }, { label: "asc" }],
  });
}

/** Le prix d'un matériel : règle pure dans src/lib/tarification.ts. */
export { tarifMateriel } from "@/lib/tarification";

export type MobilisationDossier = Mobilisation & {
  materielId: number;
  reservationId: number;
  numero: string;
  titre: string;
  qui: string;
  status: string;
};

/**
 * Le matériel retenu par les dossiers qui touchent la période (planning du matériel), pour les
 * statuts demandés : comme pour le stock mobilisé, c'est toute la durée du dossier qui retient
 * le matériel.
 */
export async function mobilisationsPeriode(
  de: Date,
  a: Date,
  statuts: readonly string[],
): Promise<MobilisationDossier[]> {
  if (!statuts.length) return [];
  const lignes = await prisma.reservationMateriel.findMany({
    where: {
      quantite: { gt: 0 },
      reservation: { status: { in: [...statuts] }, startAt: { lt: a }, endAt: { gt: de } },
    },
    select: {
      materielId: true,
      quantite: true,
      reservation: {
        select: {
          id: true,
          numero: true,
          title: true,
          status: true,
          startAt: true,
          endAt: true,
          organisation: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { reservation: { startAt: "asc" } },
  });
  return lignes.map((l) => ({
    materielId: l.materielId,
    quantite: l.quantite,
    debut: l.reservation.startAt,
    fin: l.reservation.endAt,
    reservationId: l.reservation.id,
    numero: l.reservation.numero,
    titre: l.reservation.title,
    status: l.reservation.status,
    qui:
      l.reservation.organisation?.name ??
      (l.reservation.user
        ? `${l.reservation.user.firstName} ${l.reservation.user.lastName}`.trim()
        : ""),
  }));
}
