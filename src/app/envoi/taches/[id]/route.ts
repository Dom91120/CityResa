import { auditRecord } from "@/server/audit";
import { requireAdmin } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { executerTache, LIBELLES_TACHES, TACHES } from "@/server/taches";

export const maxDuration = 300;

/** POST /taches/[id] : exécute une tâche tout de suite. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(id in TACHES)) return pasTrouve();
  return traiterFormulaire(
    req,
    async () => {
      const admin = await requireAdmin();
      const res = await executerTache(id);
      const label = LIBELLES_TACHES[id] ?? id;
      await auditRecord(
        "execution tache",
        `${label} : ${res.ok ? "ok" : "erreur"} · ${res.message}`,
        "systeme",
        admin.email,
      );
      return redirigerAvecMessage(
        "/taches",
        res.ok
          ? `« ${label} » exécutée : ${res.message}.`
          : `« ${label} » a échoué : ${res.message}`,
        res.ok ? "success" : "danger",
      );
    },
    "/taches",
  );
}
