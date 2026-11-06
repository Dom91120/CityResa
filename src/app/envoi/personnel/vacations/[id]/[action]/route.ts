import { ACTIONS_VACATION, actionVacation } from "@/modules/personnel/routes";
import { require as requireFeature } from "@/server/features";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /personnel/vacations/[id]/modifier · supprimer · supprimer_serie */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  if (!id || !ACTIONS_VACATION.includes(p.action)) return pasTrouve();
  await requireFeature("personnel");
  return traiterFormulaire(
    req,
    async (form) => actionVacation(id, p.action, form),
    `/personnel/vacations/${id}`,
  );
}
