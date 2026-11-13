import {
  donneesLiees,
  envoyerLienReinitialisation,
  nomComplet,
} from "@/modules/utilisateurs/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireAdmin } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { resetTwoFactor } from "@/server/two-factor";

/** POST /utilisateurs/[id]/(actif|reset-2fa|reinitialiser|supprimer) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params;
  return traiterFormulaire(req, async () => {
    const admin = await requireAdmin();
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) return pasTrouve();
    const ici = `/utilisateurs/${id}`;
    const nom = nomComplet(u);

    if (action === "actif") {
      if (u.id === admin.id)
        return redirigerAvecMessage(
          ici,
          "Vous ne pouvez pas désactiver votre propre compte.",
          "danger",
        );
      const actif = !u.isActive;
      await prisma.user.update({ where: { id }, data: { isActive: actif } });
      if (!actif) await prisma.session.deleteMany({ where: { userId: id } });
      await auditRecord(
        actif ? "reactivation compte" : "desactivation compte",
        u.email,
        "utilisateurs",
        admin.email,
      );
      return redirigerAvecMessage(
        ici,
        actif ? `Compte de ${nom} réactivé.` : `Compte de ${nom} désactivé.`,
        "success",
      );
    }

    if (action === "reset-2fa") {
      await resetTwoFactor(id);
      await auditRecord("reinitialisation 2FA", u.email, "securite", admin.email);
      return redirigerAvecMessage(
        ici,
        `Double authentification réinitialisée pour ${nom}.`,
        "success",
      );
    }

    if (action === "reinitialiser") {
      if (!u.isActive) return redirigerAvecMessage(ici, "Ce compte est désactivé.", "warning");
      try {
        await envoyerLienReinitialisation(u.email);
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(ici, e.message, "danger");
        throw e;
      }
      await auditRecord("envoi lien reinitialisation", u.email, "securite", admin.email);
      return redirigerAvecMessage(
        ici,
        `Un lien de réinitialisation a été envoyé à ${u.email}.`,
        "success",
      );
    }

    if (action === "supprimer") {
      if (u.id === admin.id)
        return redirigerAvecMessage(
          ici,
          "Vous ne pouvez pas supprimer votre propre compte.",
          "danger",
        );
      const liees = await donneesLiees(id);
      if (liees.length)
        return redirigerAvecMessage(
          ici,
          "Ce compte a des données liées : désactivez-le plutôt que de le supprimer.",
          "danger",
        );
      await prisma.user.delete({ where: { id } });
      await auditRecord("suppression compte", `${u.email} (${nom})`, "utilisateurs", admin.email);
      const liste =
        u.kind === "agent"
          ? "/utilisateurs"
          : u.organisationId
            ? `/usagers/${u.organisationId}#membres`
            : "/usagers";
      return redirigerAvecMessage(liste, `Compte de ${nom} supprimé.`, "success");
    }
    return pasTrouve();
  });
}
