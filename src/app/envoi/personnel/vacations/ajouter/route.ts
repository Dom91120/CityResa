import { ajouterVacation } from "@/modules/personnel/routes";
import { require as requireFeature } from "@/server/features";
import { traiterFormulaire } from "@/server/http";

/** POST /personnel/vacations/ajouter : une vacation, ou sa série hebdomadaire. */
export async function POST(req: Request) {
  await requireFeature("personnel");
  return traiterFormulaire(req, async (form) => ajouterVacation(form), "/personnel");
}
