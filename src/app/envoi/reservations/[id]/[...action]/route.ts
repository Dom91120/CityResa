import { actionReservation } from "@/modules/reservations/routes";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/**
 * POST /reservations/<id>/modifier | statut | message | assigner | creneaux/ajouter |
 * creneaux/<cid>/annuler | creneaux/<cid>/modifier | convention/regenerer | convention/relancer |
 * avenants/<aid>/relancer | avenants/<aid>/signature-manuelle | etat-des-lieux/entree|sortie |
 * caution/encaisser|restituer|retenir|valider | signature/manuelle |
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
