import { champ } from "@/lib/forms-util";
import { messageMotDePasse } from "@/modules/usagers/server";
import { creerAgent, lireEmailLibre, lireIdentite } from "@/modules/utilisateurs/server";
import { UserFacingError } from "@/server/errors";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /utilisateurs/nouveau : un compte agent. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireAdmin();
      try {
        const ident = lireIdentite(form);
        const email = await lireEmailLibre(form);
        const { id, motDePasse } = await creerAgent(
          { ...ident, email, role: champ(form, "role") },
          user.email,
        );
        return redirigerAvecMessage(
          `/utilisateurs/${id}`,
          messageMotDePasse(email, motDePasse),
          "success",
        );
      } catch (e) {
        if (e instanceof UserFacingError)
          return redirigerAvecMessage("/utilisateurs/nouveau", e.message, "danger");
        throw e;
      }
    },
    "/utilisateurs/nouveau",
  );
}
