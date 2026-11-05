import { champOuNull, parseInt_ } from "@/lib/forms-util";
import { lireMateriel, supprimerMateriel } from "@/modules/materiel/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { require as requireFeature } from "@/server/features";
import { requireDelete, requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { controlerMateriel, remettreEnService, signalerPanne } from "@/server/materiel-stock";

const ACTIONS = ["modifier", "supprimer", "panne", "remise", "controle"];

/** POST /materiel/[id]/modifier · supprimer · panne · remise · controle */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  if (!id || !ACTIONS.includes(p.action)) return pasTrouve();
  await requireFeature("materiel");
  const fiche = `/materiel/${id}`;
  return traiterFormulaire(
    req,
    async (form) => {
      try {
        if (p.action === "supprimer") {
          const user = await requireDelete("materiel");
          const message = await supprimerMateriel(id);
          await auditRecord("suppression materiel", `#${id}`, "materiel", user.email);
          return redirigerAvecMessage("/materiel", message, "success");
        }
        const user = await requireEdit("materiel");
        if (p.action === "panne" || p.action === "remise") {
          const quantite = parseInt_(form.get("quantite"), 0, 0) ?? 0;
          const note = champOuNull(form, "note");
          const message =
            p.action === "panne"
              ? await signalerPanne(user, id, quantite, note)
              : await remettreEnService(user, id, quantite, note);
          return redirigerAvecMessage(fiche, message, "success");
        }
        if (p.action === "controle") {
          const message = await controlerMateriel(user, id, champOuNull(form, "note"));
          return redirigerAvecMessage(fiche, message, "success");
        }
        const existant = await prisma.materiel.findUnique({ where: { id }, select: { id: true } });
        if (!existant) return pasTrouve();
        const m = await prisma.materiel.update({ where: { id }, data: lireMateriel(form) });
        await auditRecord("modification materiel", m.name, "materiel", user.email);
        return redirigerAvecMessage(fiche, "Matériel modifié.", "success");
      } catch (e) {
        if (e instanceof UserFacingError)
          return redirigerAvecMessage(
            p.action === "modifier" ? `${fiche}/modifier` : fiche,
            e.message,
            "danger",
          );
        throw e;
      }
    },
    fiche,
  );
}
