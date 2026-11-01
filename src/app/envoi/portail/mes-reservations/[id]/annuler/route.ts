import { champOuNull } from "@/lib/forms-util";
import { reservationUsager } from "@/modules/portail/suivi";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { UserFacingError } from "@/server/errors";
import { requireUsager } from "@/server/guards";
import { idDe, interdit, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { annulableParUsager, changerStatut } from "@/server/reservations";

/** POST /portail/mes-reservations/<id>/annuler : annulation par l'usager, dans le délai. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  const retour = `/portail/mes-reservations/${id}`;
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      const r = await reservationUsager(user, id);
      if (!r) return interdit();
      const cfg = await getSettings();
      if (!annulableParUsager(r, cfg.DELAI_ANNULATION_JOURS))
        return redirigerAvecMessage(
          retour,
          `L'annulation en ligne n'est plus possible (délai de ${cfg.DELAI_ANNULATION_JOURS} jour(s)). Écrivez à la collectivité dans le fil de discussion.`,
          "warning",
        );
      try {
        await changerStatut(
          id,
          "annulee",
          { name: user.name, isAgent: false },
          { motif: champOuNull(form, "motif") ?? undefined },
        );
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
      await auditRecord("annulation usager", r.numero, "reservations", user.email);
      return redirigerAvecMessage(retour, "Votre réservation est annulée.", "success");
    },
    retour,
  );
}
