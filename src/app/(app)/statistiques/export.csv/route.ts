import { csvResponse } from "@/lib/csv";
import { todayParisISO } from "@/lib/paris-time";
import { INCLUDE_STATS, lignesCsv, periodeDepuisParams } from "@/modules/statistiques/server";
import { prisma } from "@/server/db";
import { requireAgent } from "@/server/guards";

/** GET /statistiques/export.csv?periode=|de=&a= : les réservations de la période. */
export async function GET(req: Request) {
  await requireAgent();
  const sp = new URL(req.url).searchParams;
  const params: Record<string, string> = {};
  for (const [k, v] of sp.entries()) params[k] = v;
  const p = periodeDepuisParams(params);
  const rows = await prisma.reservation.findMany({
    where: { startAt: { gte: p.de, lt: p.a } },
    include: INCLUDE_STATS,
    orderBy: { startAt: "asc" },
  });
  return csvResponse(lignesCsv(rows, p), `reservations-${p.cle}-${todayParisISO()}.csv`);
}
