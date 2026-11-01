import { ACTIONS_ESPACE, type ActionEspace, agir } from "@/modules/espaces/routes";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/**
 * POST /espaces/[id]/modifier · supprimer · equipements · tarifs · options ·
 * gestionnaires · indisponibilites · ics
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  if (!id || !(ACTIONS_ESPACE as readonly string[]).includes(p.action)) return pasTrouve();
  return traiterFormulaire(
    req,
    (form) => agir(id, p.action as ActionEspace, form),
    `/espaces/${id}`,
  );
}
