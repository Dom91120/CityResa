import { creer } from "@/modules/espaces/routes";
import { traiterFormulaire } from "@/server/http";

/** POST /espaces/nouveau */
export async function POST(req: Request) {
  return traiterFormulaire(req, (form) => creer(form), "/espaces");
}
