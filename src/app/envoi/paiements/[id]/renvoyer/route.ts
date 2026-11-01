import { renvoyer } from "@/modules/paiements/routes";
import { require as exigerModule } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /paiements/[id]/renvoyer : renvoie la facture (PDF joint) à l'usager. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerModule("paiements");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => renvoyer(await requireEdit("paiements"), id, form),
    `/paiements/${id}`,
  );
}
