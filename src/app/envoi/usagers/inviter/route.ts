import { phraseBilan } from "@/lib/invitations";
import { lireTypesInvites } from "@/modules/usagers/invitations";
import { UserFacingError } from "@/server/errors";
import { enabled } from "@/server/features";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { inviterUsagers } from "@/server/invitations";

const RETOUR = "/usagers?type=sans_compte";

/**
 * POST /usagers/inviter : crée les comptes des organisations qui n'en ont pas et leur envoie
 * l'invitation. Réservé à l'administrateur (envoi en masse), portail ouvert seulement.
 */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      if (!(await enabled("portail")))
        return redirigerAvecMessage(
          "/usagers",
          "Le portail est fermé : ouvrez-le depuis Paramètres › Portail avant d'inviter les usagers.",
          "danger",
        );
      try {
        const b = await inviterUsagers(lireTypesInvites(form), admin.email);
        return redirigerAvecMessage(
          b.ecartees.length ? RETOUR : "/usagers",
          phraseBilan({
            invites: b.invites,
            echecs: b.echecs.length,
            ecartees: b.ecartees.length,
          }),
          b.ecartees.length || b.echecs.length ? "warning" : "success",
        );
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(RETOUR, e.message, "danger");
        throw e;
      }
    },
    "/usagers",
  );
}
