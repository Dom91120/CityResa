import { lireSite, siteAccessible, supprimerSite, verifierSlugSite } from "@/modules/sites/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireDelete, requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /sites/[id]/modifier · /sites/[id]/supprimer */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  if (!id) return pasTrouve();
  if (p.action !== "modifier" && p.action !== "supprimer") return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => {
      try {
        if (p.action === "supprimer") {
          const user = await requireDelete("espaces");
          // Supprimer ou désactiver un site touche tous ses espaces : il faut les voir tous.
          if (!(await siteAccessible(user, id, true))) return pasTrouve();
          const message = await supprimerSite(id);
          await auditRecord("suppression site", `#${id}`, "espaces", user.email);
          return redirigerAvecMessage("/sites", message, "success");
        }
        const user = await requireEdit("espaces");
        const existant = await prisma.site.findUnique({ where: { id }, select: { id: true } });
        if (!existant || !(await siteAccessible(user, id))) return pasTrouve();
        const data = lireSite(form);
        await verifierSlugSite(data.slug, id);
        const site = await prisma.site.update({ where: { id }, data });
        await auditRecord("modification site", site.name, "espaces", user.email);
        return redirigerAvecMessage(`/sites/${id}`, "Site modifié.", "success");
      } catch (e) {
        if (e instanceof UserFacingError)
          return redirigerAvecMessage(
            p.action === "supprimer" ? `/sites/${id}` : `/sites/${id}/modifier`,
            e.message,
            "danger",
          );
        throw e;
      }
    },
    `/sites/${id}`,
  );
}
