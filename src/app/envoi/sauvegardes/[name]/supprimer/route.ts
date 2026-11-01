import { auditRecord } from "@/server/audit";
import { backupPath, deleteBackup } from "@/server/db-backup";
import { requireAdmin } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /sauvegardes/[name]/supprimer */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  return traiterFormulaire(
    req,
    async () => {
      const admin = await requireAdmin();
      if (!backupPath(admin.settings, name)) return pasTrouve();
      try {
        await deleteBackup(admin.settings, name);
      } catch (e) {
        return redirigerAvecMessage(
          "/sauvegardes",
          `Suppression impossible : ${e instanceof Error ? e.message : String(e)}`,
          "danger",
        );
      }
      await auditRecord("suppression sauvegarde", name, "systeme", admin.email);
      return redirigerAvecMessage("/sauvegardes", `Sauvegarde ${name} supprimée.`, "success");
    },
    "/sauvegardes",
  );
}
