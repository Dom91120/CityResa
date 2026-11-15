import { csvResponse } from "@/lib/csv";
import { todayParisISO } from "@/lib/paris-time";
import { chargerListe, lignesCsv, lireFiltres, trierListe } from "@/modules/reservations/requetes";
import { auditRecord } from "@/server/audit";
import { requireView } from "@/server/guards";

/** GET /reservations/export.csv : la liste courante (mêmes filtres que la page) en CSV. */
export async function GET(req: Request) {
  const user = await requireView("reservations");
  const url = new URL(req.url);
  // Un filtre à plusieurs valeurs répète son paramètre (?site=1&site=3) : on les garde toutes.
  const params: Record<string, string | string[]> = {};
  for (const k of new Set(url.searchParams.keys())) {
    const tous = url.searchParams.getAll(k);
    params[k] = tous.length > 1 ? tous : tous[0];
  }
  const f = lireFiltres(params);
  const { rows, onglet } = await chargerListe(f, user);
  const tries = trierListe(rows, f, onglet);
  await auditRecord("export reservations", `${tries.length} ligne(s)`, "reservations", user.email);
  return csvResponse(lignesCsv(tries), `reservations-${todayParisISO()}.csv`);
}
