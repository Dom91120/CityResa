import { organisationDe } from "@/modules/portail/catalogue";
import { campagneOuverte, retirerVoeu } from "@/server/campagnes";
import { UserFacingError } from "@/server/errors";
import { require as requireFeature } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { idDe, interdit, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const ICI = "/portail/mes-voeux";

/** POST /portail/mes-voeux/<id>/retirer : l'usager retire un vœu tant que le dépôt est ouvert. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireFeature("campagnes");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async () => {
      const user = await requireUsager();
      const org = await organisationDe(user);
      if (!org) return interdit();
      try {
        const c = await campagneOuverte();
        if (!c) throw new UserFacingError("Le dépôt des vœux est clos.");
        await retirerVoeu(c, id, org.id);
        return redirigerAvecMessage(`${ICI}#voeux`, "Vœu retiré.", "success");
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(ICI, e.message, "danger");
        throw e;
      }
    },
    ICI,
  );
}
