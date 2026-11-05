import { champOuNull } from "@/lib/forms-util";
import { possede } from "@/modules/portail/suivi";
import { auditRecord } from "@/server/audit";
import { demanderCodeAvenant } from "@/server/avenant";
import { UserFacingError } from "@/server/errors";
import { require as requireFeature } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { idDe, interdit, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /portail/mes-reservations/<id>/avenant/<aid>/code : envoi du code de signature d'un avenant. */
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
      try {
        const canal = await demanderCodeAvenant(id, aid, champOuNull(form, "telephone"));
        await auditRecord(
          "code signature avenant demande",
          `réservation #${id} avenant #${aid} (${canal})`,
          "reservations",
          user.email,
        );
        return redirigerAvecMessage(
          retour,
          canal === "sms"
            ? "Votre code de signature vient de partir par SMS."
            : `Votre code de signature vient de partir par courriel à ${user.email}.`,
          "success",
        );
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
    },
    retour,
  );
}
