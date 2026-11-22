/**
 * Les services en base, sous la forme que lisent les règles pures de src/lib/services.ts.
 * À part de src/server/circuits.ts pour que les gardes (src/server/guards.ts) puissent s'en
 * servir sans dépendance circulaire.
 */

import { todayParisISO } from "@/lib/paris-time";
import { type ServiceBrut, servicesAgis } from "@/lib/services";
import { prisma } from "@/server/db";

const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function servicesBruts(): Promise<ServiceBrut[]> {
  const services = await prisma.service.findMany({
    select: {
      id: true,
      isActive: true,
      responsableId: true,
      suppleantId: true,
      suppleanceDu: true,
      suppleanceAu: true,
      membres: { select: { userId: true } },
    },
  });
  return services.map((s) => ({
    id: s.id,
    isActive: s.isActive,
    responsableId: s.responsableId,
    membres: s.membres.map((m) => m.userId),
    suppleantId: s.suppleantId,
    suppleanceDu: jour(s.suppleanceDu),
    suppleanceAu: jour(s.suppleanceAu),
  }));
}

/** Les services pour lesquels un agent agit aujourd'hui (suppléances en cours comprises). */
export async function servicesDe(userId: string): Promise<number[]> {
  return servicesAgis(userId, await servicesBruts(), todayParisISO());
}
