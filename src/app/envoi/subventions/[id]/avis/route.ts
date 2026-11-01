import { avis } from "@/modules/subventions/routes";
import { require as exigerModule } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /subventions/[id]/avis : l'avis de l'agent ou de l'élu connecté. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerModule("subventions");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => avis(await requireEdit("subventions"), id, form),
    `/subventions/${id}`,
  );
}
