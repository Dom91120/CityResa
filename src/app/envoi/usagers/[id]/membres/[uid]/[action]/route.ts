import { envoyerLienReinitialisation, nomComplet } from "@/modules/utilisateurs/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /usagers/[id]/membres/[uid]/(actif|reinitialiser) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; uid: string; action: string }> },
) {
  const { id: raw, uid, action } = await params;
  const id = idDe(raw);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("usagers");
    const retour = `/usagers/${id}#membres`;
    const membre = await prisma.user.findFirst({
      where: { id: uid, organisationId: id, kind: "usager" },
    });
    if (!membre) return pasTrouve();
    if (action === "actif") {
      const actif = !membre.isActive;
      await prisma.user.update({ where: { id: uid }, data: { isActive: actif } });
      if (!actif) await prisma.session.deleteMany({ where: { userId: uid } });
      await auditRecord(
        actif ? "reactivation compte usager" : "desactivation compte usager",
        `${membre.email} (org #${id})`,
        "usagers",
        user.email,
      );
      return redirigerAvecMessage(
        retour,
        actif
          ? `Compte de ${nomComplet(membre)} réactivé.`
          : `Compte de ${nomComplet(membre)} désactivé.`,
        "success",
      );
    }
    if (action === "reinitialiser") {
      if (!membre.isActive)
        return redirigerAvecMessage(retour, "Ce compte est désactivé.", "warning");
      try {
        await envoyerLienReinitialisation(membre.email);
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
      await auditRecord("envoi lien reinitialisation", membre.email, "usagers", user.email);
      return redirigerAvecMessage(
        retour,
        `Un lien de réinitialisation a été envoyé à ${membre.email}.`,
        "success",
      );
    }
    return pasTrouve();
  });
}
