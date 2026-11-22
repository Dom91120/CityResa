import { champ, champOuNull } from "@/lib/forms-util";
import { chargerPorteur, repondreEtape } from "@/server/circuits";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import * as features from "@/server/features";
import { requireAgent } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, suite, traiterFormulaire } from "@/server/http";

/**
 * POST /etapes/<id> : la réponse à une étape de circuit (relecture, avis, visa). Elle
 * n'exige aucun droit d'écriture sur les réservations : seul compte le fait d'être la
 * personne attendue (service, délégation, rôle), vérifié par `repondreEtape`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireAgent();
      await features.require("processus");
      const etape = await prisma.dossierEtape.findUnique({ where: { id } });
      if (!etape) return pasTrouve();
      const r = await chargerPorteur(etape.objet, etape.objetId);
      if (!r) return pasTrouve();
      const retour = suite(form, "/etapes");
      const reponse = champ(form, "reponse");
      if (reponse !== "accord" && reponse !== "refus") return pasTrouve();
      try {
        const issue = await repondreEtape(
          r,
          id,
          user,
          reponse === "accord",
          champOuNull(form, "commentaire"),
        );
        return redirigerAvecMessage(retour, `${issue} · dossier ${r.numero}.`, "success");
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
    },
    "/etapes",
  );
}
