import { headers } from "next/headers";
import { champ } from "@/lib/forms-util";
import { auth } from "@/server/auth";
import { UserFacingError } from "@/server/errors";
import { requireUsager } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { anonymiserCompte } from "@/server/rgpd";

const ICI = "/portail/mon-compte";

/** POST /portail/mon-compte/supprimer : l'usager demande l'effacement de son compte (droit à l'effacement). */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      if (champ(form, "confirmation").trim().toUpperCase() !== "SUPPRIMER")
        return redirigerAvecMessage(
          ICI,
          "Pour confirmer, écrivez SUPPRIMER dans le champ prévu.",
          "warning",
        );
      try {
        await anonymiserCompte(user.id, user.email, "demande");
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(ICI, e.message, "danger");
        throw e;
      }
      try {
        await auth.api.signOut({ headers: await headers() });
      } catch {
        // la session a déjà été supprimée avec le compte
      }
      return redirigerAvecMessage(
        "/connexion",
        "Votre compte a été supprimé : vos coordonnées sont effacées et vous ne pouvez plus vous connecter.",
        "success",
      );
    },
    ICI,
  );
}
