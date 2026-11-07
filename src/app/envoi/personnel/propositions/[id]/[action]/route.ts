import { ACTIONS_PROPOSITION, actionProposition } from "@/modules/personnel/routes";
import { require as requireFeature } from "@/server/features";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /personnel/propositions/[creneauId]/valider · ecarter */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  if (!id || !ACTIONS_PROPOSITION.includes(p.action)) return pasTrouve();
  await requireFeature("personnel");
  return traiterFormulaire(
    req,
    async (form) => actionProposition(id, p.action, form),
    "/personnel?onglet=propositions",
  );
}
