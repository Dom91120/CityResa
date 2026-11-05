import { champ, coche } from "@/lib/forms-util";
import { possede } from "@/modules/portail/suivi";
import { auditRecord } from "@/server/audit";
import { signerAvenant } from "@/server/avenant";
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

/** POST /portail/mes-reservations/<id>/avenant/<aid>/signer : signature d'un avenant. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; aid: string }> },
) {
  await requireFeature("signature");
  const p = await params;
  const id = idDe(p.id);
  const aid = idDe(p.aid);
  if (!id || !aid) return pasTrouve();
  const retour = `/portail/mes-reservations/${id}#avenant`;
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      if (!(await possede(user, id))) return interdit();
      if (!coche(form, "lu"))
        return redirigerAvecMessage(retour, "Merci de confirmer avoir lu l'avenant.", "danger");
      try {
        await signerAvenant(id, aid, champ(form, "code"), champ(form, "nom"), await clientIp());
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
      await auditRecord(
        "signature avenant usager",
        `réservation #${id} avenant #${aid}`,
        "reservations",
        user.email,
      );
      return redirigerAvecMessage(
        `/portail/mes-reservations/${id}`,
        "Avenant signé. Merci ! Vous recevez une confirmation par courriel.",
        "success",
      );
    },
    retour,
  );
}
