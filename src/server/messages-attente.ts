/**
 * Le nombre de conversations en attente de réponse (règle dans src/lib/messages.ts) : pour
 * chaque dossier, le dernier message échangé entre usager et agent vient de l'usager.
 * Sert au compteur du menu, à l'alerte et à l'indicateur du tableau de bord, au récapitulatif
 * quotidien des agents.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";

/** Les dossiers dont la conversation attend une réponse ; `perimetre` restreint les dossiers. */
export async function dossiersARepondre(
  perimetre: Prisma.ReservationWhereInput = {},
): Promise<number[]> {
  const derniers = await prisma.message.findMany({
    where: {
      isInternal: false,
      authorKind: { in: ["usager", "agent"] },
      ...(Object.keys(perimetre).length ? { reservation: perimetre } : {}),
    },
    orderBy: [{ reservationId: "asc" }, { createdAt: "desc" }],
    distinct: ["reservationId"],
    select: { reservationId: true, authorKind: true },
  });
  return derniers.filter((m) => m.authorKind === "usager").map((m) => m.reservationId);
}

export async function compterARepondre(
  perimetre: Prisma.ReservationWhereInput = {},
): Promise<number> {
  return (await dossiersARepondre(perimetre)).length;
}
