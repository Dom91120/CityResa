import { actionReservation } from "@/modules/reservations/routes";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/**
 * POST /reservations/<id>/modifier | statut | message | assigner | creneaux/ajouter |
 * creneaux/<cid>/annuler | creneaux/<cid>/modifier | convention/regenerer | convention/relancer |
 * signature/manuelle |
 * factures/creer | recalculer | supprimer
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string[] }> },
) {
  const { id: raw, action } = await params;
  const id = idDe(raw);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => actionReservation(id, action, form),
    `/reservations/${id}`,
  );
}
