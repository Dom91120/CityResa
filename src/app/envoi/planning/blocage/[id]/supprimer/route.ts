import { supprimerBlocage } from "@/modules/planning/routes";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /planning/blocage/<id>/supprimer : lève un blocage. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => supprimerBlocage(id, form), "/planning");
}
