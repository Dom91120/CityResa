/**
 * Rendu PDF (HTML → PDF par Chromium headless, via Puppeteer). Les gabarits sont du HTML,
 * la mise en page du CSS, le navigateur fait le reste.
 */
import puppeteer, { type Browser } from "puppeteer";

let navigateur: Promise<Browser> | null = null;

async function obtenirNavigateur(): Promise<Browser> {
  if (!navigateur) {
    navigateur = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    navigateur.catch(() => {
      navigateur = null;
    });
  }
  const b = await navigateur;
  if (!b.connected) {
    navigateur = null;
    return obtenirNavigateur();
  }
  return b;
}

export type MargesPdf = { top: string; right: string; bottom: string; left: string };

/** Un document HTML complet → les octets du PDF (A4, portrait). */
export async function htmlVersPdf(
  html: string,
  marges: MargesPdf = { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
): Promise<Buffer> {
  const b = await obtenirNavigateur();
  const page = await b.newPage();
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: marges,
      preferCSSPageSize: false,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Réponse HTTP d'un PDF (en ligne par défaut). */
export function reponsePdf(octets: Buffer, filename: string, attachment = false): Response {
  return new Response(new Uint8Array(octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="${filename}"`,
      "Content-Length": String(octets.length),
    },
  });
}

/** Feuille de style commune des éditions (convention, facture, fiche). */
export const CSS_EDITION = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; font-size: 11pt; color: #1f2937; line-height: 1.45; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 4px; color: #111827; }
  h2 { font-size: 13pt; margin: 18px 0 6px; color: #e8336d; border-bottom: 1px solid #f3cfdc; padding-bottom: 3px; }
  h3 { font-size: 11.5pt; margin: 12px 0 4px; }
  p { margin: 0 0 6px; }
  .entete { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #e8336d; padding-bottom: 10px; margin-bottom: 16px; }
  .entete .coll { font-weight: 700; font-size: 13pt; }
.entete .logo { display: block; height: 52px; max-width: 140px; object-fit: contain; object-position: left; margin-bottom: 6px; }
  .entete .doc { text-align: right; color: #6b7280; }
  .muted { color: #6b7280; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
  th { background: #fdf2f6; color: #4b5563; font-weight: 600; font-size: 10pt; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .total td { font-weight: 700; border-top: 2px solid #1f2937; }
  .grille { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
  .bloc { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin: 8px 0; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; }
  .signature { border: 1px dashed #cbd5e1; border-radius: 8px; min-height: 90px; padding: 8px 12px; }
  .cachet { display: inline-block; border: 2px solid #059669; color: #059669; border-radius: 6px; padding: 4px 10px; font-weight: 700; transform: rotate(-3deg); }
  .pied { position: fixed; bottom: 0; left: 0; right: 0; font-size: 8.5pt; color: #9ca3af; text-align: center; }
  .pre { white-space: pre-wrap; }
`;
