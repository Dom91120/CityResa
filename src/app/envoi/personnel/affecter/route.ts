import { affecter } from "@/modules/personnel/routes";
import { require as requireFeature } from "@/server/features";
import { traiterFormulaire } from "@/server/http";

/** POST /personnel/affecter : affecte ou propose le personnel sur les créneaux de la période affichée. */
export async function POST(req: Request) {
  await requireFeature("personnel");
  return traiterFormulaire(req, async (form) => affecter(form), "/personnel");
}
