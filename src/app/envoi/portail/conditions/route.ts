import { coche } from "@/lib/forms-util";
import { conditionsAAccepter, PAGE_CONDITIONS } from "@/lib/portail";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireUsagerSansConditions } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/**
 * POST /portail/conditions : l'usager accepte les conditions d'utilisation. La date est posée
 * une seule fois sur son compte et tracée au journal d'audit.
 */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsagerSansConditions();
      if (!conditionsAAccepter(user, user.settings.PORTAIL_CONDITIONS))
        return redirigerAvecMessage("/portail/mes-reservations", "Rien à accepter.", "info");
      if (!coche(form, "accepte"))
        return redirigerAvecMessage(
          PAGE_CONDITIONS,
          "Cochez la case pour accepter les conditions.",
          "danger",
        );
      await prisma.user.update({ where: { id: user.id }, data: { acceptedCguAt: new Date() } });
      await auditRecord("acceptation des conditions", "", "usagers", user.email);
      return redirigerAvecMessage(
        "/portail/mes-reservations",
        "Merci : votre espace est prêt.",
        "success",
      );
    },
    PAGE_CONDITIONS,
  );
}
