import { campagneAction } from "@/modules/subventions/routes";
import { require as exigerModule } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /subventions/campagnes/[id]/[action] : modifier, ouvrir, cloturer, reprendre, supprimer. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  await exigerModule("subventions");
  const p = await params;
  const id = idDe(p.id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => campagneAction(await requireEdit("subventions"), id, p.action, form),
    "/subventions/campagnes",
  );
}
