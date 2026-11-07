import { campagneNouvelle } from "@/modules/subventions/routes";
import { require as exigerModule } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { traiterFormulaire } from "@/server/http";

/** POST /subventions/campagnes/nouvelle : crée la campagne d'un exercice. */
export async function POST(req: Request) {
  await exigerModule("subventions");
  return traiterFormulaire(
    req,
    async (form) => campagneNouvelle(await requireEdit("subventions"), form),
    "/subventions/campagnes",
  );
}
