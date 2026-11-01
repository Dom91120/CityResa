import { champ } from "@/lib/forms-util";
import { ajouter, lireReferentiel } from "@/modules/referentiels/server";
import { auditRecord } from "@/server/audit";
import { UserFacingError } from "@/server/errors";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /referentiels/nouveau */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireAdmin();
      const retour = `/referentiels#${champ(form, "kind")}`;
      try {
        const e = lireReferentiel(form);
        await ajouter(e);
        await auditRecord("ajout referentiel", `${e.kind} · ${e.label}`, "parametres", user.email);
        return redirigerAvecMessage(retour, `« ${e.label} » ajouté.`, "success");
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
    },
    "/referentiels",
  );
}
