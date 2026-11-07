import { portailSigner } from "@/modules/subventions/routes";
import { require as exigerModule } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { clientIp, idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /portail/mes-subventions/[id]/signature/signer : vérifie le code et signe l'attestation. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerModule("subventions");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => portailSigner(await requireUsager(), id, form, await clientIp()),
    `/portail/mes-subventions/${id}/dossier/attestation`,
  );
}
