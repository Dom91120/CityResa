import { todayParisISO } from "@/lib/paris-time";
import { construireClasseur } from "@/modules/statistiques/export";
import { chargerStatistiques, periodeDepuisParams } from "@/modules/statistiques/server";
import { requireAgent } from "@/server/guards";

/** GET /statistiques/export.xlsx?periode=|de=&a= : classeur Réservations / Espaces / Usagers. */
export async function GET(req: Request) {
  await requireAgent();
  const sp = new URL(req.url).searchParams;
  const params: Record<string, string> = {};
  for (const [k, v] of sp.entries()) params[k] = v;
  const p = periodeDepuisParams(params);
  const stats = await chargerStatistiques(p);
  const octets = await construireClasseur(stats, p);
  return new Response(new Uint8Array(octets), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="statistiques-${p.cle}-${todayParisISO()}.xlsx"`,
      "Content-Length": String(octets.length),
    },
  });
}
