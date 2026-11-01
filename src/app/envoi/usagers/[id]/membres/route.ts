import { ajouterMembre, messageMotDePasse } from "@/modules/usagers/server";
import { UserFacingError } from "@/server/errors";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /usagers/[id]/membres : ajoute un compte usager à l'organisation. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("usagers");
    const retour = `/usagers/${id}#membres`;
    try {
      const { email, motDePasse } = await ajouterMembre(id, form, user.email);
      return redirigerAvecMessage(retour, messageMotDePasse(email, motDePasse), "success");
    } catch (e) {
      if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
      throw e;
    }
  });
}
