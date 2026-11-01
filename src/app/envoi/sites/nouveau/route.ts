import { lireSite, verifierSlugSite } from "@/modules/sites/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /sites/nouveau */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireEdit("espaces");
      try {
        const data = lireSite(form);
        await verifierSlugSite(data.slug, null);
        const site = await prisma.site.create({ data });
        await auditRecord("creation site", site.name, "espaces", user.email);
        return redirigerAvecMessage(`/sites/${site.id}`, `Site « ${site.name} » créé.`, "success");
      } catch (e) {
        if (e instanceof UserFacingError)
          return redirigerAvecMessage("/sites/nouveau", e.message, "danger");
        throw e;
      }
    },
    "/sites",
  );
}
