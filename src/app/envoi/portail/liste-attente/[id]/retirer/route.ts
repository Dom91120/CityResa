import { UserFacingError } from "@/server/errors";
import { require as requireFeature } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { retirer } from "@/server/liste-attente";

const RETOUR = "/portail/mes-reservations#attente";

/** POST /portail/liste-attente/<id>/retirer : l'usager retire son inscription. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireFeature("portail");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async () => {
      const user = await requireUsager();
      try {
        await retirer(user, id);
        return redirigerAvecMessage(RETOUR, "Inscription retirée.", "success");
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(RETOUR, e.message, "danger");
        throw e;
      }
    },
    RETOUR,
  );
}
