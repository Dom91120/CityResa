import { champOuNull, idOuNull } from "@/lib/forms-util";
import { plage } from "@/lib/libelles";
import { lireCreneau } from "@/modules/reservations/formulaire";
import { UserFacingError } from "@/server/errors";
import { require as requireFeature } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { inscrire } from "@/server/liste-attente";

const RETOUR = "/portail/mes-reservations#attente";

/** POST /portail/liste-attente/inscrire : être prévenu si un créneau occupé se libère. */
export async function POST(req: Request) {
  await requireFeature("portail");
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      try {
        const espaceId = idOuNull(form, "espace_id");
        if (!espaceId) throw new UserFacingError("Espace inconnu.");
        const i = lireCreneau(form);
        await inscrire(user, espaceId, i, champOuNull(form, "title"));
        return redirigerAvecMessage(
          RETOUR,
          `Inscription enregistrée : vous serez prévenu si le créneau du ${plage(i.startAt, i.endAt)} se libère.`,
          "success",
        );
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(RETOUR, e.message, "danger");
        throw e;
      }
    },
    RETOUR,
  );
}
