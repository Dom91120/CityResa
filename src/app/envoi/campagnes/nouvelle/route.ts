import { creer } from "@/modules/campagnes/routes";
import { traiterFormulaire } from "@/server/http";

/** POST /campagnes/nouvelle : création d'une campagne annuelle de créneaux. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => creer(form), "/campagnes");
}
