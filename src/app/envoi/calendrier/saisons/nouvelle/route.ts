import { lireSaison } from "@/modules/calendrier/server";
import { auditRecord } from "@/server/audit";
import { creerSaison } from "@/server/calendrier";
import { UserFacingError } from "@/server/errors";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/calendrier";

/** POST /calendrier/saisons/nouvelle */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireAdmin();
      try {
        const e = lireSaison(form);
        const s = await creerSaison(e);
        await auditRecord("creation saison", s.label, "parametres", user.email);
        return redirigerAvecMessage(
          RETOUR,
          `Saison ${s.label} créée avec ses jours fériés. Importez maintenant les vacances scolaires.`,
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
