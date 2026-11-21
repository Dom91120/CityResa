import { ACTIONS_PLANNING_TYPE, actionPlanningType } from "@/modules/personnel/routes";
import { require as requireFeature } from "@/server/features";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /personnel/plannings-types/[id]/enregistrer · supprimer ([id] = type de contrat) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  if (!id || !ACTIONS_PLANNING_TYPE.includes(p.action)) return pasTrouve();
  await requireFeature("personnel");
  return traiterFormulaire(
    req,
    async (form) => actionPlanningType(id, p.action, form),
    "/personnel/plannings-types",
  );
}
