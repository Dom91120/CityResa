/**
 * Compteurs de la barre latérale : demandes à traiter, conversations à répondre, usagers à
 * valider, factures à payer, subventions à instruire, notifications non lues. Calculés
 * au plus une fois par minute (cache process), puis filtrés selon les droits.
 */
import { serviceReference } from "@/lib/services";
import { prisma } from "@/server/db";
import { enabledIn } from "@/server/features";
import type { CurrentUser } from "@/server/guards";
import { compterARepondre } from "@/server/messages-attente";
import { servicesUsagers } from "@/server/services";

const TTL_MS = process.env.CITYRESA_TEST ? 0 : 30_000;
type Cache = { at: number; counts: Record<string, number> };
const partage = globalThis as unknown as { __cityresaNav?: { cache: Cache | null } };
partage.__cityresaNav ??= { cache: null };
const memo = partage.__cityresaNav;

async function calculer(): Promise<Record<string, number>> {
  const [a_traiter, messages, usagers_a_valider, factures_a_payer, subventions_a_traiter] =
    await Promise.all([
      prisma.reservation.count({ where: { status: { in: ["a_traiter", "en_traitement"] } } }),
      compterARepondre(),
      prisma.organisation.count({ where: { validatedAt: null, isActive: true } }),
      prisma.facture.count({ where: { status: "a_payer" } }),
      prisma.subvention.count({ where: { status: { in: ["deposee", "instruction", "avis"] } } }),
    ]);
  return { a_traiter, messages, usagers_a_valider, factures_a_payer, subventions_a_traiter };
}

/** La clause qui limite une requête de réservations à la file de travail d'un agent. */
export function clauseServices(file: number[] | null): {
  OR?: ({ serviceId: null } | { serviceId: { in: number[] } })[];
} {
  return file ? { OR: [{ serviceId: null }, { serviceId: { in: file } }] } : {};
}

/** Les fiches à valider de la file de travail d'un agent (ses usagers et ceux sans référent). */
export async function usagersAValider(user: CurrentUser): Promise<number> {
  const [orgs, services] = await Promise.all([
    prisma.organisation.findMany({
      where: { validatedAt: null, isActive: true },
      select: { type: true, sportive: true },
    }),
    servicesUsagers(),
  ]);
  return orgs.filter((o) => user.suitUsager(serviceReference(o, services)?.id)).length;
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
  if (user.canView("reservations")) {
    // Un agent rattaché à des espaces ne compte que leurs demandes, comme sa liste.
    // …et, s'il appartient à des services, que les demandes de ses services ou sans service.
    counts.a_traiter =
      user.espacesGeres.length || user.fileDeTravail
        ? await prisma.reservation
            .count({
              where: {
                status: { in: ["a_traiter", "en_traitement"] },
                ...(user.espacesGeres.length ? { espaceId: { in: user.espacesGeres } } : {}),
                ...clauseServices(user.fileDeTravail),
              },
            })
            .catch(() => c.a_traiter)
        : c.a_traiter;
  }
  if (user.canView("messages")) counts.messages = c.messages;
  if (user.canView("usagers"))
    counts.usagers_a_valider = user.fileDeTravail
      ? await usagersAValider(user).catch(() => c.usagers_a_valider)
      : c.usagers_a_valider;
  if (user.canView("paiements")) counts.factures_a_payer = c.factures_a_payer;
  if (user.canView("subventions"))
    counts.subventions_a_traiter = user.fileDeTravail
      ? await prisma.subvention
          .count({
            where: {
              status: { in: ["deposee", "instruction", "avis"] },
              ...clauseServices(user.fileDeTravail),
            },
          })
          .catch(() => c.subventions_a_traiter)
      : c.subventions_a_traiter;
  if (enabledIn(user.settings, "processus")) {
    const { etapesEnAttente } = await import("@/server/circuits");
    const { avisAttendus } = await import("@/server/circuits-subvention");
    counts.etapes =
      (await etapesEnAttente(user).catch(() => [])).length +
      (await avisAttendus(user).catch(() => [])).length;
  }
  if (user.canView("personnel")) {
    const { nbPropositions } = await import("@/server/affectation");
    counts.propositions_personnel = await nbPropositions(user).catch(() => 0);
  }
  return counts;
}
