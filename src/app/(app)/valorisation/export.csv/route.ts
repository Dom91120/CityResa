import { csvResponse } from "@/lib/csv";
import { lignesAnnexe } from "@/lib/valorisation";
import { require as exigerModule } from "@/server/features";
import { requireView } from "@/server/guards";
import { calculerValorisation, exerciceCourant, seuilsDe } from "@/server/valorisation";

/** GET /valorisation/export.csv?exercice=2026 : l'annexe du compte administratif (une ligne par organisation). */
export async function GET(req: Request) {
  await exigerModule("subventions");
  const user = await requireView("subventions");
  const ex = Number(new URL(req.url).searchParams.get("exercice"));
  const exercice = Number.isInteger(ex) && ex > 2000 ? ex : exerciceCourant();
  const lignes = await calculerValorisation(exercice);
  return csvResponse(
    lignesAnnexe(exercice, lignes, seuilsDe(user.settings)),
    `valorisation-${exercice}.csv`,
  );
}
