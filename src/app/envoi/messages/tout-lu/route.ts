import { toutLu } from "@/modules/messages/routes";
import { traiterFormulaire } from "@/server/http";

/** POST /messages/tout-lu : marque lus tous les messages d'usagers du périmètre. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => toutLu(form), "/messages");
}
