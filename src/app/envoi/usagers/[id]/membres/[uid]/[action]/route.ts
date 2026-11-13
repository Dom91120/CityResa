import {
  envoyerLienReinitialisation,
  lireEmailLibre,
  lireIdentite,
  nomComplet,
} from "@/modules/utilisateurs/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireDelete, requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { anonymiserCompte } from "@/server/rgpd";

/** POST /usagers/[id]/membres/[uid]/(modifier|actif|reinitialiser|anonymiser) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; uid: string; action: string }> },
) {
  const { id: raw, uid, action } = await params;
  const id = idDe(raw);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("usagers");
    const retour = `/usagers/${id}#membres`;
    const membre = await prisma.user.findFirst({
      where: { id: uid, organisationId: id, kind: "usager" },
    });
    if (!membre) return pasTrouve();
    if (membre.anonymiseAt)
      return redirigerAvecMessage(retour, "Ce compte est anonymisé.", "warning");
    if (action === "modifier") {
      try {
        const ident = lireIdentite(form);
        const email = await lireEmailLibre(form, uid);
        await prisma.user.update({
          where: { id: uid },
          data: {
            email,
            name: `${ident.firstName} ${ident.lastName}`,
            firstName: ident.firstName,
            lastName: ident.lastName,
            phone: ident.phone,
            fonction: ident.fonction,
          },
        });
        await auditRecord(
          "modification compte usager",
          `${membre.email}${email !== membre.email ? ` → ${email}` : ""} (org #${id})`,
          "usagers",
          user.email,
        );
        return redirigerAvecMessage(
          retour,
          `Compte de ${nomComplet({ ...ident, email })} modifié.`,
          "success",
        );
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
    }
    if (action === "anonymiser") {
      await requireDelete("usagers");
      try {
        await anonymiserCompte(uid, user.email, "agent");
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
      return redirigerAvecMessage(
        retour,
        `Compte de ${nomComplet(membre)} anonymisé : coordonnées effacées, connexion impossible.`,
        "success",
      );
    }
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
