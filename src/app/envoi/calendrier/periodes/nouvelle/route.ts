import { lirePeriode } from "@/modules/calendrier/server";
import { auditRecord } from "@/server/audit";
import { creerPeriode } from "@/server/calendrier";
import { UserFacingError } from "@/server/errors";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/calendrier";

/** POST /calendrier/periodes/nouvelle */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireAdmin();
      try {
        const e = lirePeriode(form);
        await creerPeriode(e);
        await auditRecord(
          "ajout periode calendrier",
          `${e.kind} · ${e.label}`,
          "parametres",
          user.email,
        );
        return redirigerAvecMessage(RETOUR, `« ${e.label} » ajouté au calendrier.`, "success");
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(RETOUR, e.message, "danger");
        throw e;
      }
    },
    RETOUR,
  );
}
