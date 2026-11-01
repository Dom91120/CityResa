// Helpers d'export CSV partagés par les routes d'export (réservations, espaces, usagers,
// factures). Compatible Excel FR : BOM UTF-8, « ; », CRLF, injection de formule neutralisée.

const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/** Échappe une valeur pour une cellule CSV (guillemets doublés, formule neutralisée). */
export function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = FORMULA_TRIGGERS.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Construit une réponse CSV téléchargeable. */
export function csvResponse(
  rows: (string | number | null | undefined)[][],
  filename: string,
): Response {
  const body = rows.map((cols) => cols.map(csvCell).join(";")).join("\r\n");
  return new Response(`${String.fromCharCode(0xfeff)}${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
