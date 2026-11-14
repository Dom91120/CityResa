import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAgent } from "@/server/guards";
import { pasTrouve } from "@/server/http";

/** Le guide utilisateur rassemblé par scripts/guide-pdf.mjs (copié dans l'image par le Dockerfile). */
const FICHIER = path.join(process.cwd(), "docs", "guide", "CityResa-guide-utilisateur.pdf");

/** GET /guide.pdf : le guide utilisateur complet en PDF, réservé aux agents connectés (lien de la page /guide). */
export async function GET() {
  await requireAgent();
  let pdf: Buffer;
  try {
    pdf = await readFile(FICHIER);
  } catch {
    return pasTrouve();
  }
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="CityResa-guide-utilisateur.pdf"',
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
