import { UserFacingError } from "@/server/errors";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";
import { validerOrganisation } from "@/server/usagers";

/** POST /usagers/[id]/valider */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("usagers");
    try {
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
