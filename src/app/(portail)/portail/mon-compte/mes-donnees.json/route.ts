import { nomFichierExport } from "@/lib/rgpd";
import { auditRecord } from "@/server/audit";
import { requireUsager } from "@/server/guards";
import { exportDonneesUsager, reponseJson } from "@/server/rgpd";

/** GET /portail/mon-compte/mes-donnees.json : l'usager télécharge ses données (droit d'accès et de portabilité). */
export async function GET() {
  const user = await requireUsager();
  const donnees = await exportDonneesUsager(user.id);
  await auditRecord("export donnees usager", user.email, "usagers", user.email);
  return reponseJson(donnees, nomFichierExport());
}
