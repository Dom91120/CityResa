import { portailCode } from "@/modules/subventions/routes";
import { require as exigerModule } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /portail/mes-subventions/[id]/signature/code : envoie le code de signature. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerModule("subventions");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => portailCode(await requireUsager(), id, form),
    `/portail/mes-subventions/${id}/dossier/attestation`,
  );
}
