import { portailFiche } from "@/modules/subventions/routes";
import { require as exigerModule } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /portail/mes-subventions/[id]/dossier/[fiche] : une fiche du dossier. */
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
    async (form) => portailFiche(await requireUsager(), id, p.fiche, form),
    `/portail/mes-subventions/${id}`,
  );
}
