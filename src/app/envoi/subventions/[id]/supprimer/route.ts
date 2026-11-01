import { supprimer } from "@/modules/subventions/routes";
import { require as exigerModule } from "@/server/features";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /subventions/[id]/supprimer : supprime une demande simplement déposée. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerModule("subventions");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async () => supprimer(await requireDelete("subventions"), id),
    `/subventions/${id}`,
  );
}
