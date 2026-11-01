import { creerLibre } from "@/modules/paiements/routes";
import { require as exigerModule } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { traiterFormulaire } from "@/server/http";

/** POST /paiements/nouvelle : émet une facture libre. */
export async function POST(req: Request) {
  await exigerModule("paiements");
  return traiterFormulaire(
    req,
    async (form) => creerLibre(await requireEdit("paiements"), form),
    "/paiements/nouvelle",
  );
}
