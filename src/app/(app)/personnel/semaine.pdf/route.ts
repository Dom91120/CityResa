import { lundiDe } from "@/lib/editions";
import { parseInt_ } from "@/lib/forms-util";
import { nomFichierPlanningPersonnel } from "@/lib/personnel";
import { lireDate } from "@/modules/planning/server";
import { getSettings } from "@/server/config-store";
import { enabledIn } from "@/server/features";
import { requireView } from "@/server/guards";
import { pasTrouve } from "@/server/http";
import { reponsePdf } from "@/server/pdf";
import { pdfPlanningService } from "@/server/personnel";

/**
 * GET /personnel/semaine.pdf?date=&site=…&personne=…&format=A4|A3 : le planning de service, une
 * page par site, limité aux personnes cochées à l'écran s'il y en a.
 */
export async function GET(req: Request) {
  const user = await requireView("personnel");
  if (!enabledIn(user.settings, "personnel")) return pasTrouve();
  const url = new URL(req.url);
  const lundi = lundiDe(lireDate(url.searchParams.get("date") ?? undefined));
  const siteIds = url.searchParams
    .getAll("site")
    .map((v) => parseInt_(v, null, 1))
    .filter((n): n is number => n !== null);
  const personnelIds = url.searchParams
    .getAll("personne")
    .map((v) => parseInt_(v, null, 1))
    .filter((n): n is number => n !== null);
  const format = url.searchParams.get("format") === "A3" ? "A3" : "A4";
  const cfg = await getSettings();
  const pdf = await pdfPlanningService(
    user,
    lundi,
    siteIds.length ? siteIds : undefined,
    cfg,
    format,
    personnelIds,
  );
  return reponsePdf(pdf, nomFichierPlanningPersonnel(lundi));
}
