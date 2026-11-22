import {
  filtrerEvts,
  lignesExport,
  lignesListe,
  lireFiltresEvts,
  resumeFiltres,
} from "@/lib/planning-vues";
import { classeurPlanning } from "@/modules/planning/export";
import {
  espacesPlanning,
  fenetreDemandee,
  lireFiltresPlanning,
  occupationsPlanning,
} from "@/modules/planning/server";
import { requireView } from "@/server/guards";
import type { Params } from "@/server/paging";
import { optionsServices } from "@/server/services";

/**
 * GET /planning/export.xlsx?vue=&date=&etendue=&au=&site=…&espace=…&secteur=&statut=…&type=…&q=
 * Les créneaux et blocages de la période affichée par le planning, avec ses filtres, en
 * classeur Excel (une ligne par créneau, dans l'ordre de la vue liste).
 */
export async function GET(req: Request) {
  const user = await requireView("planning");
  const sp = new URL(req.url).searchParams;
  const params: Params = {};
  for (const k of new Set(sp.keys())) params[k] = sp.getAll(k);
  const fen = fenetreDemandee(params);
  const filtres = lireFiltresPlanning(params);
  const filtresEvts = lireFiltresEvts(params);
  const espaces = await espacesPlanning(user, filtres);
  const occ = await occupationsPlanning(
    espaces.map((e) => e.id),
    fen,
  );
  const lignes = lignesExport(
    lignesListe(filtrerEvts(occ.creneaux, filtresEvts), occ.blocages),
    new Map(espaces.map((e) => [e.id, { name: e.name, site: e.site.name }])),
  );
  const octets = await classeurPlanning(lignes, {
    periode: fen.label,
    filtres: resumeFiltres(filtresEvts, filtres.secteur, await optionsServices()),
  });
  const fin = fen.jours.at(-1) ?? fen.date;
  return new Response(new Uint8Array(octets), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="planning-${fen.jours[0] ?? fen.date}-${fin}.xlsx"`,
      "Content-Length": String(octets.length),
    },
  });
}
