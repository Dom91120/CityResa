import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";
import { referenceDe } from "@/server/services";
import { validerOrganisation } from "@/server/usagers";

/** POST /usagers/[id]/valider */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("usagers");
    try {
      const org = await prisma.organisation.findUnique({
        where: { id },
        select: { type: true, sportive: true },
      });
      const reference = org ? await referenceDe(org) : null;
      if (reference && !user.agitPour(reference.id))
        throw new UserFacingError(
          `La fiche de cet usager est validée par son service de référence : ${reference.name}.`,
        );
      await validerOrganisation(id, user.email);
    } catch (e) {
      if (e instanceof UserFacingError)
        return redirigerAvecMessage(`/usagers/${id}`, e.message, "danger");
      throw e;
    }
    invalidateNavCounts();
    return redirigerAvecMessage(
      `/usagers/${id}`,
      "Organisation validée : ses membres en ont été informés par courriel.",
      "success",
    );
  });
}
