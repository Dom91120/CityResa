/**
 * Sites : lecture du formulaire, chargement d'une fiche, suppression.
 *
 *   name · slug · description · address · postal_code · city · lat · lng · phone · email
 *   · access_info · is_active · position
 */
import type { Prisma } from "@/generated/prisma/client";
import { champ, champOuNull, coche, parseFloat_, parseInt_, slugifier } from "@/lib/forms-util";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";

export type SiteEntree = {
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  accessInfo: string | null;
  isActive: boolean;
  affectationAuto: boolean;
  position: number;
};

/** Lit un site depuis le formulaire ; lève une UserFacingError si le nom manque. */
export function lireSite(form: FormData): SiteEntree {
  const name = champ(form, "name").slice(0, 120);
  if (!name) throw new UserFacingError("Indiquez le nom du site.");
  const slug = (slugifier(champ(form, "slug")) || slugifier(name)).slice(0, 140);
  if (!slug) throw new UserFacingError("L'adresse (slug) du site est vide.");
  const lat = parseFloat_(form.get("lat"), null);
  const lng = parseFloat_(form.get("lng"), null);
  if ((lat === null) !== (lng === null))
    throw new UserFacingError(
      "Indiquez à la fois la latitude et la longitude, ou aucune des deux.",
    );
  if (lat !== null && (lat < -90 || lat > 90))
    throw new UserFacingError("La latitude doit être comprise entre -90 et 90.");
  if (lng !== null && (lng < -180 || lng > 180))
    throw new UserFacingError("La longitude doit être comprise entre -180 et 180.");
  return {
    name,
    slug,
    description: champOuNull(form, "description"),
    address: champOuNull(form, "address")?.slice(0, 200) ?? null,
    postalCode: champOuNull(form, "postal_code")?.slice(0, 10) ?? null,
    city: champOuNull(form, "city")?.slice(0, 80) ?? null,
    lat,
    lng,
    phone: champOuNull(form, "phone")?.slice(0, 40) ?? null,
    email: champOuNull(form, "email")?.slice(0, 160) ?? null,
    accessInfo: champOuNull(form, "access_info"),
    isActive: coche(form, "is_active"),
    affectationAuto: coche(form, "affectation_auto"),
    position: parseInt_(form.get("position"), 0, 0) ?? 0,
  };
}

/** Le slug est-il déjà pris par un autre site ? */
export async function verifierSlugSite(slug: string, excludeId: number | null): Promise<void> {
  const autre = await prisma.site.findUnique({ where: { slug }, select: { id: true } });
  if (autre && autre.id !== excludeId)
    throw new UserFacingError(`L'adresse « ${slug} » est déjà utilisée par un autre site.`);
}

export const INCLUDE_SITE = {
  espaces: {
    orderBy: [{ position: "asc" as const }, { name: "asc" as const }],
    include: { nature: true, _count: { select: { reservations: true } } },
  },
} satisfies Prisma.SiteInclude;

export type SiteComplet = Prisma.SiteGetPayload<{ include: typeof INCLUDE_SITE }>;

export async function chargerSite(id: number): Promise<SiteComplet | null> {
  return prisma.site.findUnique({ where: { id }, include: INCLUDE_SITE });
}

/** Le lien OpenStreetMap d'un site géolocalisé. */
export function lienCarte(s: { lat: number | null; lng: number | null }): string | null {
  if (s.lat === null || s.lng === null) return null;
  return `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=17/${s.lat}/${s.lng}`;
}

/** « 12 rue de la Mairie, 92320 Châtillon ». */
export function adresseComplete(s: {
  address: string | null;
  postalCode: string | null;
  city: string | null;
}): string {
  const ville = [s.postalCode, s.city].filter(Boolean).join(" ");
  return [s.address, ville].filter(Boolean).join(", ");
}

/**
 * Supprime un site : désactivation si des espaces y sont rattachés, suppression
 * définitive sinon. Renvoie le message à afficher.
 */
export async function supprimerSite(id: number): Promise<string> {
  const site = await prisma.site.findUnique({
    where: { id },
    include: { _count: { select: { espaces: true } } },
  });
  if (!site) throw new UserFacingError("Site introuvable.");
  if (site._count.espaces > 0) {
    await prisma.site.update({ where: { id }, data: { isActive: false } });
    return `Le site « ${site.name} » a été désactivé (${site._count.espaces} espace(s) y restent rattachés).`;
  }
  await prisma.site.delete({ where: { id } });
  return `Site « ${site.name} » supprimé.`;
}

/** Les sites pour un <select> (actifs en tête). */
export async function sitesPourSelect(): Promise<[string, string][]> {
  const sites = await prisma.site.findMany({
    orderBy: [{ isActive: "desc" }, { position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, isActive: true },
  });
  return sites.map((s) => [String(s.id), s.isActive ? s.name : `${s.name} (inactif)`]);
}

/** La première photo de chaque site (id du document), dans l'ordre de la galerie. */
export async function premieresPhotosSites(siteIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!siteIds.length) return out;
  const docs = await prisma.document.findMany({
    where: { siteId: { in: siteIds }, kind: "photo" },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    select: { id: true, siteId: true },
  });
  for (const d of docs) {
    if (d.siteId && !out.has(d.siteId)) out.set(d.siteId, d.id);
  }
  return out;
}
