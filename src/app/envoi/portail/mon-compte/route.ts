import { champ, champOuNull, coche } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireUsager } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const ICI = "/portail/mon-compte";

/** POST /portail/mon-compte : identité et préférences de l'usager. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      const prenom = champ(form, "first_name").slice(0, 80);
      const nom = champ(form, "last_name").slice(0, 80);
      if (!prenom || !nom)
        return redirigerAvecMessage(ICI, "Indiquez votre prénom et votre nom.", "danger");
      await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: prenom,
          lastName: nom,
          name: `${prenom} ${nom}`,
          phone: champOuNull(form, "phone")?.slice(0, 40) ?? null,
          notifEmail: coche(form, "notif_email"),
        },
      });
      await auditRecord("modification profil usager", user.email, "usagers", user.email);
      return redirigerAvecMessage(ICI, "Profil enregistré", "success");
    },
    ICI,
  );
}
