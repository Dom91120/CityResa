import path from "node:path";
import { auditRecord } from "@/server/audit";
import { backupDatabase } from "@/server/db-backup";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

export const maxDuration = 300;

/** POST /sauvegardes : sauvegarde immédiate. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async () => {
      const admin = await requireAdmin();
      try {
        const chemin = await backupDatabase(admin.settings);
        await auditRecord("sauvegarde base", path.basename(chemin), "systeme", admin.email);
        return redirigerAvecMessage(
          "/sauvegardes",
          `Sauvegarde écrite : ${path.basename(chemin)}.`,
          "success",
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await auditRecord("sauvegarde base (echec)", msg.slice(0, 300), "systeme", admin.email);
        return redirigerAvecMessage(
          "/sauvegardes",
          `La sauvegarde a échoué : ${msg}${/introuvable|ENOENT/i.test(msg) ? " — installez les outils PostgreSQL ou réglez PG_DUMP_BIN." : ""}`,
          "danger",
        );
      }
    },
    "/sauvegardes",
  );
}
