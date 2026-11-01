import { champOuNull } from "@/lib/forms-util";
import { possede } from "@/modules/portail/suivi";
import { auditRecord } from "@/server/audit";
import { UserFacingError } from "@/server/errors";
import { require as requireFeature } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { idDe, interdit, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { demanderCode } from "@/server/signature";

/** POST /portail/mes-reservations/<id>/signature/code : envoi du code de signature. */
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
      try {
        const canal = await demanderCode(id, champOuNull(form, "telephone"));
        await auditRecord(
          "code signature demande",
          `réservation #${id} (${canal})`,
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
