import { lireFichierCalendrier, lireSaison, lireZone } from "@/modules/calendrier/server";
import { auditRecord } from "@/server/audit";
import {
  activerSaison,
  importerVacances,
  modifierSaison,
  supprimerSaison,
} from "@/server/calendrier";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const ACTIONS = ["modifier", "activer", "importer", "supprimer"];
const RETOUR = "/calendrier";

/** POST /calendrier/saisons/[id]/modifier · activer · importer · supprimer */
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
      const s = await prisma.saison.findUnique({ where: { id } });
      if (!s) return pasTrouve();
      try {
        switch (p.action) {
          case "modifier": {
            const e = lireSaison(form);
            await modifierSaison(id, e);
            await auditRecord("modification saison", e.label, "parametres", user.email);
            return redirigerAvecMessage(RETOUR, `Saison ${e.label} modifiée.`, "success");
          }
          case "activer":
            await activerSaison(id);
            await auditRecord("activation saison", s.label, "parametres", user.email);
            return redirigerAvecMessage(RETOUR, `Saison ${s.label} active.`, "success");
          case "importer": {
            const zone = lireZone(form);
            const donnees = await lireFichierCalendrier(form);
            const { nb } = await importerVacances(id, zone, { donnees });
            await auditRecord(
              "import vacances scolaires",
              `${s.label} · ${zone} · ${nb} période(s)`,
              "parametres",
              user.email,
            );
            return redirigerAvecMessage(
              RETOUR,
              `${nb} période(s) de vacances ${zone} importée(s) pour la saison ${s.label}.`,
              "success",
            );
          }
          default: {
            const n = await supprimerSaison(id);
            await auditRecord("suppression saison", s.label, "parametres", user.email);
            return redirigerAvecMessage(
              RETOUR,
              `Saison ${s.label} supprimée${n ? ` avec ${n} période(s) importée(s) ou calculée(s)` : ""}.`,
              "success",
            );
          }
        }
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(RETOUR, e.message, "danger");
        throw e;
      }
    },
    RETOUR,
  );
}
