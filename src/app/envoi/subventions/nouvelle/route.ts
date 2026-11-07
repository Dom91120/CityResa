import { commencerDossier } from "@/modules/subventions/routes";
import { require as exigerModule } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { traiterFormulaire } from "@/server/http";

/** POST /subventions/nouvelle : commence le dossier de demande d'une association. */
export async function POST(req: Request) {
  await exigerModule("subventions");
  return traiterFormulaire(
    req,
    async (form) => commencerDossier(await requireEdit("subventions"), form),
    "/subventions/nouvelle",
  );
}
