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

/** GET /personnel/semaine.pdf?date=&site=&format=A4|A3 : le planning de service, une page par site. */
export async function GET(req: Request) {
  const user = await requireView("personnel");
  if (!enabledIn(user.settings, "personnel")) return pasTrouve();
  const url = new URL(req.url);
  const lundi = lundiDe(lireDate(url.searchParams.get("date") ?? undefined));
  const siteId = parseInt_(url.searchParams.get("site"), null, 1);
  const format = url.searchParams.get("format") === "A3" ? "A3" : "A4";
  const cfg = await getSettings();
  const pdf = await pdfPlanningService(user, lundi, siteId ? [siteId] : undefined, cfg, format);
  return reponsePdf(pdf, nomFichierPlanningPersonnel(lundi));
}
