import { vuesPlanning } from "@/modules/planning/routes";
import { traiterFormulaire } from "@/server/http";

/** POST /planning/vues : enregistre ou supprime une vue du planning de l'agent connecté. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => vuesPlanning(form), "/planning");
}
