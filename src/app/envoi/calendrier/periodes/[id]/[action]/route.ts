import { lirePeriode } from "@/modules/calendrier/server";
import { auditRecord } from "@/server/audit";
import { modifierPeriode, supprimerPeriode } from "@/server/calendrier";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const ACTIONS = ["modifier", "supprimer"];
const RETOUR = "/calendrier";

/** POST /calendrier/periodes/[id]/modifier · supprimer */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  if (!id || !ACTIONS.includes(p.action)) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireAdmin();
      const existante = await prisma.periodeCalendrier.findUnique({ where: { id } });
      if (!existante) return pasTrouve();
      try {
        if (p.action === "modifier") {
          const e = lirePeriode(form);
          await modifierPeriode(id, e);
          await auditRecord("modification periode calendrier", e.label, "parametres", user.email);
          return redirigerAvecMessage(RETOUR, `« ${e.label} » modifié.`, "success");
        }
        await supprimerPeriode(id);
        await auditRecord(
          "suppression periode calendrier",
          existante.label,
          "parametres",
          user.email,
        );
        return redirigerAvecMessage(RETOUR, `« ${existante.label} » supprimé.`, "success");
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(RETOUR, e.message, "danger");
        throw e;
      }
    },
    RETOUR,
  );
}
