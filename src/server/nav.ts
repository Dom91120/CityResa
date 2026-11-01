/**
 * Compteurs de la barre latérale : demandes à traiter, messages non lus, usagers à
 * valider, factures à payer, subventions à instruire, notifications non lues. Calculés
 * au plus une fois par minute (cache process), puis filtrés selon les droits.
 */
import { prisma } from "@/server/db";
import type { CurrentUser } from "@/server/guards";

const TTL_MS = process.env.CITYRESA_TEST ? 0 : 30_000;
type Cache = { at: number; counts: Record<string, number> };
const partage = globalThis as unknown as { __cityresaNav?: { cache: Cache | null } };
partage.__cityresaNav ??= { cache: null };
const memo = partage.__cityresaNav;

async function calculer(): Promise<Record<string, number>> {
  const [a_traiter, messages, usagers_a_valider, factures_a_payer, subventions_a_traiter] =
    await Promise.all([
      prisma.reservation.count({ where: { status: { in: ["a_traiter", "en_traitement"] } } }),
      prisma.message.count({ where: { readAt: null, authorKind: "usager", isInternal: false } }),
      prisma.organisation.count({ where: { validatedAt: null, isActive: true } }),
      prisma.facture.count({ where: { status: "a_payer" } }),
      prisma.subvention.count({ where: { status: { in: ["deposee", "instruction", "avis"] } } }),
    ]);
  return { a_traiter, messages, usagers_a_valider, factures_a_payer, subventions_a_traiter };
}

export function invalidateNavCounts(): void {
  memo.cache = null;
}

/** Compteurs du menu (back-office) ou de l'espace usager. */
export async function navCounts(user: CurrentUser): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  try {
    counts.notifications = await prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
  } catch {
    counts.notifications = 0;
  }
  if (!user.isAgent) {
    try {
      counts.messages = await prisma.message.count({
        where: {
          readAt: null,
          authorKind: "agent",
          isInternal: false,
          reservation: user.organisationId
            ? { OR: [{ userId: user.id }, { organisationId: user.organisationId }] }
            : { userId: user.id },
        },
      });
    } catch {
      counts.messages = 0;
    }
    return counts;
  }
  if (!memo.cache || Date.now() - memo.cache.at > TTL_MS) {
    try {
      memo.cache = { at: Date.now(), counts: await calculer() };
    } catch (e) {
      console.error("[nav] compteurs impossibles :", e);
      return counts;
    }
  }
  const c = memo.cache.counts;
  if (user.canView("reservations")) counts.a_traiter = c.a_traiter;
  if (user.canView("messages")) counts.messages = c.messages;
  if (user.canView("usagers")) counts.usagers_a_valider = c.usagers_a_valider;
  if (user.canView("paiements")) counts.factures_a_payer = c.factures_a_payer;
  if (user.canView("subventions")) counts.subventions_a_traiter = c.subventions_a_traiter;
  return counts;
}
