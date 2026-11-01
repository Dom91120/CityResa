import { getSettings } from "@/server/config-store";
import { pasTrouve } from "@/server/http";
import { fluxUsager } from "@/server/ics";

/** GET /ics/usager/<token> : les réservations fermes d'un usager (lien personnel). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 64) return pasTrouve();
  const cfg = await getSettings();
  const ics = await fluxUsager(token, cfg.APP_BASE_URL);
  if (!ics) return pasTrouve();
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="mes-reservations.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
