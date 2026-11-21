/**
 * Classeur XLSX du planning (exceljs) : les créneaux et blocages de la période affichée, une
 * ligne chacun, en-têtes en gras, filtre automatique, dates au format français.
 */
import ExcelJS from "exceljs";
import type { LigneExport } from "@/lib/planning-vues";

const COLONNES: { header: string; key: keyof LigneExport; width: number }[] = [
  { header: "Date", key: "date", width: 12 },
  { header: "Début", key: "debut", width: 8 },
  { header: "Fin", key: "fin", width: 8 },
  { header: "Jusqu'au", key: "jusquau", width: 12 },
  { header: "Site", key: "site", width: 26 },
  { header: "Espace", key: "espace", width: 30 },
  { header: "Objet", key: "objet", width: 40 },
  { header: "Dossier", key: "dossier", width: 16 },
  { header: "Usager", key: "usager", width: 30 },
  { header: "Type d'usager", key: "typeUsager", width: 24 },
  { header: "Statut", key: "statut", width: 16 },
];

export async function classeurPlanning(
  lignes: readonly LigneExport[],
  infos: { periode: string; filtres: string },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CityRésa";
  wb.created = new Date();

  const ws = wb.addWorksheet("Planning");
  ws.columns = COLONNES;
  for (const l of lignes) ws.addRow(l);
  for (const cle of ["date", "jusquau"]) ws.getColumn(cle).numFmt = "dd/mm/yyyy";
  const entete = ws.getRow(1);
  entete.font = { bold: true };
  entete.alignment = { vertical: "middle" };
  entete.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F1ED" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLONNES.length } };

  const s = wb.addWorksheet("À propos");
  s.columns = [
    { header: "Élément", key: "k", width: 22 },
    { header: "Valeur", key: "v", width: 70 },
  ];
  s.addRows([
    { k: "Période", v: infos.periode },
    { k: "Filtres", v: infos.filtres || "Aucun" },
    { k: "Lignes", v: lignes.length },
  ]);
  s.getRow(1).font = { bold: true };

  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
