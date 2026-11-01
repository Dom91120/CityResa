import { champ, coche } from "@/lib/forms-util";
import { possede } from "@/modules/portail/suivi";
import { auditRecord } from "@/server/audit";
import { UserFacingError } from "@/server/errors";
import { require as requireFeature } from "@/server/features";
import { requireUsager } from "@/server/guards";
import {
  clientIp,
  idDe,
  interdit,
  pasTrouve,
  redirigerAvecMessage,
  traiterFormulaire,
} from "@/server/http";
import { signer } from "@/server/signature";

/** POST /portail/mes-reservations/<id>/signature/signer : signature de la convention. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireFeature("signature");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  const retour = `/portail/mes-reservations/${id}#signature`;
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      if (!(await possede(user, id))) return interdit();
      if (!coche(form, "lu"))
        return redirigerAvecMessage(retour, "Merci de confirmer avoir lu la convention.", "danger");
      try {
        await signer(id, champ(form, "code"), champ(form, "nom"), await clientIp());
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
      await auditRecord("signature usager", `réservation #${id}`, "reservations", user.email);
      return redirigerAvecMessage(
        `/portail/mes-reservations/${id}`,
        "Convention signée. Merci ! Vous recevez une confirmation par courriel.",
        "success",
      );
    },
    retour,
  );
}
