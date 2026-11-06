import { getSettings } from "@/server/config-store";
import { enabledIn } from "@/server/features";
import { pasTrouve } from "@/server/http";
import { fluxPersonnel } from "@/server/ics";

/** GET /ics/personnel/<token> : les vacations d'une personne de service (lien personnel). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 64) return pasTrouve();
  const cfg = await getSettings();
  if (!enabledIn(cfg, "personnel")) return pasTrouve();
  const ics = await fluxPersonnel(token, cfg.APP_BASE_URL);
  if (!ics) return pasTrouve();
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="mon-planning-de-service.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
