import { champ } from "@/lib/forms-util";
import { possede } from "@/modules/portail/suivi";
import { auditRecord } from "@/server/audit";
import { UserFacingError } from "@/server/errors";
import { requireUsager } from "@/server/guards";
import { idDe, interdit, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { ajouterMessage } from "@/server/reservations";

/** POST /portail/mes-reservations/<id>/message : un message de l'usager sur son dossier. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  const retour = `/portail/mes-reservations/${id}#messages`;
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      if (!(await possede(user, id))) return interdit();
      try {
        await ajouterMessage(id, user, champ(form, "texte").slice(0, 4000), false);
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
      await auditRecord("message usager", `réservation #${id}`, "messages", user.email);
      return redirigerAvecMessage(retour, "Message envoyé", "success");
    },
    retour,
  );
}
