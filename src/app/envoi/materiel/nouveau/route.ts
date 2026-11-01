import { lireMateriel } from "@/modules/materiel/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { require as requireFeature } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /materiel/nouveau */
export async function POST(req: Request) {
  await requireFeature("materiel");
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireEdit("materiel");
      try {
        const data = lireMateriel(form);
        const m = await prisma.materiel.create({ data });
        await auditRecord("creation materiel", m.name, "materiel", user.email);
        return redirigerAvecMessage(`/materiel/${m.id}`, `Matériel « ${m.name} » créé.`, "success");
      } catch (e) {
        if (e instanceof UserFacingError)
          return redirigerAvecMessage("/materiel/nouveau", e.message, "danger");
        throw e;
      }
    },
    "/materiel",
  );
}
