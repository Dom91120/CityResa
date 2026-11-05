import { fermer } from "@/modules/planning/routes";
import { traiterFormulaire } from "@/server/http";

/** POST /planning/fermer : pose une fermeture exceptionnelle confirmée depuis l'aperçu. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => fermer(form), "/planning");
}
