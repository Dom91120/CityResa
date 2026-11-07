import { incomplet } from "@/modules/subventions/routes";
import { require as exigerModule } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /subventions/[id]/incomplet : renvoie le dossier à l'association. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerModule("subventions");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => incomplet(await requireEdit("subventions"), id, form),
    `/subventions/${id}`,
  );
}
