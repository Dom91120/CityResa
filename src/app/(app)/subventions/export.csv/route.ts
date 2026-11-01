import { csvResponse } from "@/lib/csv";
import {
  chargerSubventions,
  exerciceParDefaut,
  filtrerSubventions,
  lignesCsv,
  lireFiltres,
} from "@/modules/subventions/server";
import { require as exigerModule } from "@/server/features";
import { requireView } from "@/server/guards";

/** GET /subventions/export.csv?exercice=2026 : les demandes de l'exercice (et autres filtres). */
export async function GET(req: Request) {
  await exigerModule("subventions");
  await requireView("subventions");
  const sp = new URL(req.url).searchParams;
  const params: Record<string, string> = {};
  for (const [k, v] of sp.entries()) params[k] = v;
  const fl = lireFiltres(params);
  if (!fl.exercice) fl.exercice = exerciceParDefaut();
  const rows = filtrerSubventions(await chargerSubventions(), fl);
  return csvResponse(lignesCsv(rows), `subventions-${fl.exercice}.csv`);
}
