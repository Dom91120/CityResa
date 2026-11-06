import { nouvellePersonne } from "@/modules/personnel/routes";
import { require as requireFeature } from "@/server/features";
import { traiterFormulaire } from "@/server/http";

/** POST /personnel/personnes/nouveau : une personne de service. */
export async function POST(req: Request) {
  await requireFeature("personnel");
  return traiterFormulaire(req, async (form) => nouvellePersonne(form), "/personnel/personnes");
}
