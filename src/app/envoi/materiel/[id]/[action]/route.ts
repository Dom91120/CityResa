import { lireMateriel, supprimerMateriel } from "@/modules/materiel/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { require as requireFeature } from "@/server/features";
import { requireDelete, requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /materiel/[id]/modifier · /materiel/[id]/supprimer */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  if (!id || (p.action !== "modifier" && p.action !== "supprimer")) return pasTrouve();
  await requireFeature("materiel");
  return traiterFormulaire(
    req,
    async (form) => {
      try {
        if (p.action === "supprimer") {
          const user = await requireDelete("materiel");
          const message = await supprimerMateriel(id);
          await auditRecord("suppression materiel", `#${id}`, "materiel", user.email);
          return redirigerAvecMessage("/materiel", message, "success");
        }
        const user = await requireEdit("materiel");
        const existant = await prisma.materiel.findUnique({ where: { id }, select: { id: true } });
        if (!existant) return pasTrouve();
        const m = await prisma.materiel.update({ where: { id }, data: lireMateriel(form) });
        await auditRecord("modification materiel", m.name, "materiel", user.email);
        return redirigerAvecMessage(`/materiel/${id}`, "Matériel modifié.", "success");
      } catch (e) {
        if (e instanceof UserFacingError)
          return redirigerAvecMessage(
            p.action === "supprimer" ? `/materiel/${id}` : `/materiel/${id}/modifier`,
            e.message,
            "danger",
          );
        throw e;
      }
    },
    `/materiel/${id}`,
  );
}
