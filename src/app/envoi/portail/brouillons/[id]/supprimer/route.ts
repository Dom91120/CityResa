import { supprimerBrouillon } from "@/server/brouillons";
import { requireUsager } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/portail/mes-reservations?onglet=brouillons";

/** POST /portail/brouillons/[id]/supprimer : l'usager jette un brouillon de demande. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async () => {
      const user = await requireUsager();
      await supprimerBrouillon(user, id);
      return redirigerAvecMessage(RETOUR, "Brouillon supprimé.", "success");
    },
    RETOUR,
  );
}
