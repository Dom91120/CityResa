import { ACTIONS_PERSONNE, actionPersonne } from "@/modules/personnel/routes";
import { require as requireFeature } from "@/server/features";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /personnel/personnes/[id]/modifier · desactiver · reactiver · supprimer · ics_generer · ics_revoquer · envoyer_planning */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  if (!id || !ACTIONS_PERSONNE.includes(p.action)) return pasTrouve();
  await requireFeature("personnel");
  return traiterFormulaire(
    req,
    async (form) => actionPersonne(id, p.action, form),
    `/personnel/personnes/${id}`,
  );
}
