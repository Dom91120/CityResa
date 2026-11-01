/**
 * Classeur XLSX des statistiques (exceljs) : feuilles Réservations, Espaces, Usagers,
 * en-têtes en gras, colonnes dimensionnées, nombres au format français.
 */
import ExcelJS from "exceljs";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import type { Periode } from "@/lib/periodes";
import {
  COLONNES_EXPORT,
  ligneExport,
  type Stats,
  topOrganisations,
} from "@/modules/statistiques/server";

const FORMAT_EURO = '#,##0.00 "€"';

function entete(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.alignment = { vertical: "middle" };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDEEF3" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

export async function construireClasseur(stats: Stats, p: Periode): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CityRésa";
  wb.created = new Date();

  const r = wb.addWorksheet("Réservations");
  r.columns = COLONNES_EXPORT.map((c) => ({ header: c.label, key: c.cle, width: c.largeur }));
  for (const resa of stats.reservations) r.addRow(ligneExport(resa, p));
  for (const cle of ["montantHt", "montantTtc"]) r.getColumn(cle).numFmt = FORMAT_EURO;
  entete(r);

  const e = wb.addWorksheet("Espaces");
  e.columns = [
    { header: "Espace", key: "nom", width: 28 },
    { header: "Site", key: "site", width: 24 },
    { header: "Heures réservées", key: "heures", width: 16 },
    { header: "Taux d'occupation (%)", key: "taux", width: 20 },
    { header: "Créneaux", key: "nb", width: 10 },
  ];
  for (const o of stats.occupation)
    e.addRow({ nom: o.name, site: o.site, heures: o.heures, taux: o.taux, nb: o.nb });
  entete(e);

  const u = wb.addWorksheet("Usagers");
  u.columns = [
    { header: "Organisation", key: "nom", width: 32 },
    { header: "Type", key: "type", width: 20 },
    { header: "Réservations", key: "nb", width: 13 },
    { header: "Heures", key: "heures", width: 10 },
    { header: "Montant TTC", key: "montant", width: 14 },
    { header: "Dont gratuites", key: "gratuites", width: 14 },
  ];
  for (const o of topOrganisations(stats.reservations, p, Number.POSITIVE_INFINITY))
    u.addRow({
      nom: o.nom,
      type: ORGANISATION_TYPES[o.type] ?? o.type,
      nb: o.nb,
      heures: o.heures,
      montant: o.montant,
      gratuites: o.gratuites,
    });
  u.getColumn("montant").numFmt = FORMAT_EURO;
  entete(u);

  const s = wb.addWorksheet("Synthèse");
  s.columns = [
    { header: "Indicateur", key: "k", width: 44 },
    { header: "Valeur", key: "v", width: 18 },
  ];
  s.addRows([
    { k: "Période", v: p.label },
    { k: "Demandes reçues", v: stats.kpi.demandes.valeur },
    { k: "Réservations confirmées", v: stats.kpi.confirmees.valeur },
    { k: "Annulées ou refusées", v: stats.kpi.annulees.valeur },
    { k: "Revenus encaissés (€)", v: stats.kpi.revenus.valeur },
    { k: "Valeur des mises à disposition gracieuses (€)", v: stats.gracieux.total },
    { k: "Réservations à titre gracieux", v: stats.gracieux.nb },
  ]);
  entete(s);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
