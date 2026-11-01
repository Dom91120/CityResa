import { bloquer } from "@/modules/planning/routes";
import { traiterFormulaire } from "@/server/http";

/** POST /planning/bloquer : pose une indisponibilité sur un espace. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => bloquer(form), "/planning");
}
