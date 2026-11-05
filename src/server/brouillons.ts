/**
 * Brouillons de demande du portail : enregistrement, reprise et suppression, pour l'usager
 * connecté seulement. Règles pures dans src/lib/brouillons.ts.
 */
import { brouillonUtile, type DonneesBrouillon, lireBrouillon } from "@/lib/brouillons";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import type { CurrentUser } from "@/server/guards";

const MAX_BROUILLONS = 10;

/** Crée ou met à jour (`id`) un brouillon de l'usager sur un espace. */
export async function enregistrerBrouillon(
  user: CurrentUser,
  espaceId: number,
  data: DonneesBrouillon,
  id: number | null,
): Promise<number> {
  if (!brouillonUtile(data))
    throw new UserFacingError(
      "Indiquez au moins une date ou l'objet de la demande pour garder un brouillon.",
    );
  if (id) {
    const b = await prisma.brouillonDemande.findFirst({ where: { id, userId: user.id } });
    if (b) {
      await prisma.brouillonDemande.update({ where: { id }, data: { espaceId, data } });
      return id;
    }
  }
  const nb = await prisma.brouillonDemande.count({ where: { userId: user.id } });
  if (nb >= MAX_BROUILLONS)
    throw new UserFacingError(
      `Vous avez déjà ${MAX_BROUILLONS} brouillons : reprenez-en un ou supprimez-en avant d'en garder un nouveau.`,
    );
  const b = await prisma.brouillonDemande.create({ data: { userId: user.id, espaceId, data } });
  return b.id;
}

/** Le brouillon `id` de l'usager, données relues, ou null. */
export async function chargerBrouillon(user: CurrentUser, id: number) {
  const b = await prisma.brouillonDemande.findFirst({
    where: { id, userId: user.id },
    include: { espace: { select: { id: true, slug: true, name: true } } },
  });
  return b ? { ...b, data: lireBrouillon(b.data) } : null;
}

/** Les brouillons de l'usager, le plus récent d'abord. */
export async function brouillonsDe(user: CurrentUser) {
  const liste = await prisma.brouillonDemande.findMany({
    where: { userId: user.id },
    include: { espace: { select: { id: true, slug: true, name: true, shortName: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return liste.map((b) => ({ ...b, data: lireBrouillon(b.data) }));
}

export async function supprimerBrouillon(user: CurrentUser, id: number): Promise<void> {
  await prisma.brouillonDemande.deleteMany({ where: { id, userId: user.id } });
}
