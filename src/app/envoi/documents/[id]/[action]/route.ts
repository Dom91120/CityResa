import { reordonner, supprimer } from "@/modules/documents/routes";
import { requireUser } from "@/server/guards";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /documents/<id>/delete | haut | bas */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id: raw, action } = await params;
  const id = idDe(raw);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireUser();
    if (action === "delete") return supprimer(user, id, form);
    if (action === "haut" || action === "bas") return reordonner(user, id, action, form);
    return pasTrouve();
  });
}
