import { champ, champOuNull } from "@/lib/forms-util";
import { lireOrganisation, messageMotDePasse } from "@/modules/usagers/server";
import { motDePasseAleatoire } from "@/modules/utilisateurs/server";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { creerCompteUsager } from "@/server/usagers";

/** POST /usagers/nouveau : l'organisation et son premier compte. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireEdit("usagers");
      const retour = "/usagers/nouveau";
      try {
        const org = lireOrganisation(form);
        const motDePasse = motDePasseAleatoire();
        const email = champ(form, "email");
        const uid = await creerCompteUsager(
          {
            firstName: champ(form, "first_name"),
            lastName: champ(form, "last_name"),
            email,
            phone: champOuNull(form, "phone"),
            password: motDePasse,
            type: org.type,
            orgName: org.name || null,
            address: org.address,
            postalCode: org.postalCode,
            city: org.city,
            siret: org.siret,
            rna: org.rna,
            legalFirstName: org.legalFirstName,
            legalLastName: org.legalLastName,
            legalAppointedAt: org.legalAppointedAt,
            fonction: champOuNull(form, "fonction"),
          },
          user.email,
          { parAgent: true },
        );
        const cree = await prisma.user.findUnique({
          where: { id: uid },
          select: { organisationId: true, email: true },
        });
        if (!cree?.organisationId) throw new UserFacingError("Organisation introuvable.");
        await prisma.organisation.update({
          where: { id: cree.organisationId },
          data: {
            website: org.website,
            notes: org.notes,
            ...(org.email ? { email: org.email } : {}),
            ...(org.phone ? { phone: org.phone } : {}),
            ...(org.profilId ? { profilId: org.profilId } : {}),
          },
        });
        return redirigerAvecMessage(
          `/usagers/${cree.organisationId}`,
          messageMotDePasse(cree.email, motDePasse),
          "success",
        );
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
    },
    "/usagers/nouveau",
  );
}
