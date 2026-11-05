import { actionCampagne } from "@/modules/campagnes/routes";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/**
 * POST /campagnes/<id>/modifier | statut | arbitrer | notifier | supprimer |
 * voeux/<vid>/attribuer | voeux/<vid>/refuser | voeux/<vid>/attente
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string[] }> },
) {
  const { id: raw, action } = await params;
  const id = idDe(raw);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => actionCampagne(id, action, form),
    `/campagnes/${id}`,
  );
}
