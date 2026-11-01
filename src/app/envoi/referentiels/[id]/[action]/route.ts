import {
  basculer,
  deplacer,
  lireReferentiel,
  modifier,
  supprimer,
} from "@/modules/referentiels/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const ACTIONS = ["modifier", "monter", "descendre", "basculer", "supprimer"];

/** POST /referentiels/[id]/modifier · monter · descendre · basculer · supprimer */
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
      const r = await prisma.referential.findUnique({ where: { id } });
      if (!r) return pasTrouve();
      const retour = `/referentiels#${r.kind}`;
      try {
        switch (p.action) {
          case "modifier": {
            const e = lireReferentiel(form);
            await modifier(id, e);
            await auditRecord(
              "modification referentiel",
              `${r.kind} · ${e.label}`,
              "parametres",
              user.email,
            );
            return redirigerAvecMessage(retour, "Valeur modifiée.", "success");
          }
          case "monter":
          case "descendre":
            await deplacer(id, p.action === "monter" ? "haut" : "bas");
            return redirigerAvecMessage(retour, "Ordre modifié.", "success");
          case "basculer": {
            const actif = await basculer(id);
            await auditRecord(
              actif ? "activation referentiel" : "desactivation referentiel",
              `${r.kind} · ${r.label}`,
              "parametres",
              user.email,
            );
            return redirigerAvecMessage(
              retour,
              actif ? `« ${r.label} » activé.` : `« ${r.label} » désactivé.`,
              "success",
            );
          }
          default: {
            const message = await supprimer(id);
            await auditRecord(
              "suppression referentiel",
              `${r.kind} · ${r.label}`,
              "parametres",
              user.email,
            );
            return redirigerAvecMessage(retour, message, "success");
          }
        }
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
    },
    "/referentiels",
  );
}
