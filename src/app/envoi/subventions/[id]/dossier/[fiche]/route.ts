import { fiche } from "@/modules/subventions/routes";
import { require as exigerModule } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /subventions/[id]/dossier/[fiche] : un agent remplit une fiche au nom de l'association. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; fiche: string }> },
) {
  await exigerModule("subventions");
  const p = await params;
  const id = idDe(p.id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => fiche(await requireEdit("subventions"), id, p.fiche, form, "/subventions"),
    `/subventions/${id}`,
  );
}
