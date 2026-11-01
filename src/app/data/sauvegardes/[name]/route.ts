import fs from "node:fs/promises";
import { auditRecord } from "@/server/audit";
import { backupPath } from "@/server/db-backup";
import { getCurrentUser } from "@/server/guards";

/** GET /data/sauvegardes/[name] : téléchargement d'une sauvegarde (administrateur). */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Authentification requise.", { status: 401 });
  if (!user.isAdmin) return new Response("Forbidden", { status: 403 });
  const name = decodeURIComponent((await params).name);
  const chemin = backupPath(user.settings, name);
  if (!chemin) return new Response("Not Found", { status: 404 });
  let octets: Buffer;
  try {
    octets = await fs.readFile(chemin);
  } catch {
    return new Response("Not Found", { status: 404 });
  }
  await auditRecord("telechargement sauvegarde", name, "systeme", user.email);
  return new Response(new Uint8Array(octets), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(octets.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
