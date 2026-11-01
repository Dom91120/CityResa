import { getSettings } from "@/server/config-store";
import { pasTrouve } from "@/server/http";
import { flusEspace } from "@/server/ics";

/** GET /ics/espace/<token> : l'agenda public d'un espace (créneaux fermes). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 64) return pasTrouve();
  const cfg = await getSettings();
  const ics = await flusEspace(token, cfg.APP_BASE_URL);
  if (!ics) return pasTrouve();
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="espace.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
