import { champ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireUsager } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { nouveauJeton } from "@/server/ics";

const ICI = "/portail/mon-compte";

/** POST /portail/mon-compte/ics : génère ou révoque le lien de calendrier personnel. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      const action = champ(form, "action");
      if (action === "revoquer") {
        await prisma.user.update({ where: { id: user.id }, data: { icsToken: null } });
        await auditRecord("revocation lien ics", user.email, "usagers", user.email);
        return redirigerAvecMessage(ICI, "Lien de calendrier révoqué", "success");
      }
      await prisma.user.update({ where: { id: user.id }, data: { icsToken: nouveauJeton() } });
      await auditRecord("generation lien ics", user.email, "usagers", user.email);
      return redirigerAvecMessage(ICI, "Votre lien de calendrier est prêt", "success");
    },
    ICI,
  );
}
