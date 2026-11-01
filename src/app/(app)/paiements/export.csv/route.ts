import { csvResponse } from "@/lib/csv";
import { todayParisISO } from "@/lib/paris-time";
import {
  chargerFactures,
  filtrerFactures,
  lignesCsv,
  lireFiltres,
} from "@/modules/paiements/server";
import { require as exigerModule } from "@/server/features";
import { requireView } from "@/server/guards";

/** GET /paiements/export.csv : les factures de la liste (mêmes filtres), en CSV. */
export async function GET(req: Request) {
  await exigerModule("paiements");
  await requireView("paiements");
  const sp = new URL(req.url).searchParams;
  const params: Record<string, string> = {};
  for (const [k, v] of sp.entries()) params[k] = v;
  const fl = lireFiltres(params);
  const factures = filtrerFactures(await chargerFactures(), fl);
  return csvResponse(lignesCsv(factures), `factures-${todayParisISO()}.csv`);
}
