import { decrireCreneauHebdo } from "@/lib/campagnes";
import { lireVoeu } from "@/modules/campagnes/routes";
import { organisationDe } from "@/modules/portail/catalogue";
import { auditRecord } from "@/server/audit";
import { campagneOuverte, deposerVoeu } from "@/server/campagnes";
import { UserFacingError } from "@/server/errors";
import { require as requireFeature } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { interdit, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const ICI = "/portail/mes-voeux";

/** POST /portail/mes-voeux/nouveau : dépôt d'un vœu de créneau par un usager. */
export async function POST(req: Request) {
  await requireFeature("campagnes");
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      const org = await organisationDe(user);
      if (!org) return interdit();
      try {
        const c = await campagneOuverte();
        if (!c) throw new UserFacingError("Aucune campagne n'est ouverte au dépôt.");
        const e = lireVoeu(form);
        await deposerVoeu(c, org, user.id, e);
        await auditRecord(
          "depot voeu",
          `${c.label} · ${org.name} · ${decrireCreneauHebdo(e)}`,
          "reservations",
          user.email,
        );
        return redirigerAvecMessage(
          `${ICI}#voeux`,
          `Vœu déposé : ${decrireCreneauHebdo(e)}.`,
          "success",
        );
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(ICI, e.message, "danger");
        throw e;
      }
    },
    ICI,
  );
}
