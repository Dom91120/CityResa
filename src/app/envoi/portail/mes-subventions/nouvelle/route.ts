import { portailCommencer } from "@/modules/subventions/routes";
import { require as exigerModule } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { traiterFormulaire } from "@/server/http";

/** POST /portail/mes-subventions/nouvelle : commence (ou reprend) le dossier de la campagne. */
export async function POST(req: Request) {
  await exigerModule("subventions");
  return traiterFormulaire(
    req,
    async () => portailCommencer(await requireUsager()),
    "/portail/mes-subventions",
  );
}
