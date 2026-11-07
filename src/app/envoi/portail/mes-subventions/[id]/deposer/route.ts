import { portailDeposer } from "@/modules/subventions/routes";
import { require as exigerModule } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /portail/mes-subventions/[id]/deposer : dépose le dossier. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerModule("subventions");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async () => portailDeposer(await requireUsager(), id),
    `/portail/mes-subventions/${id}`,
  );
}
