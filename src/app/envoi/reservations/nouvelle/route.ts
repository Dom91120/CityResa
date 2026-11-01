import { creer } from "@/modules/reservations/routes";
import { traiterFormulaire } from "@/server/http";

/** POST /reservations/nouvelle : création d'un dossier par un agent. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => creer(form), "/reservations/nouvelle");
}
