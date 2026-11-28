import { Prisma } from "@/generated/prisma/client";
import { PERMISSION_CATEGORIES } from "@/lib/constantes";
import { derogationsUtiles, ecarts, lireNiveau, lireNiveaux, resumeEcarts } from "@/lib/droits";
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

/** POST /utilisateurs/[id]/(actif|reset-2fa|reinitialiser|supprimer|droits) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params;
  return traiterFormulaire(req, async (form) => {
    const admin = await requireAdmin();
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) return pasTrouve();
    const ici = `/utilisateurs/${id}`;
    const nom = nomComplet(u);

    // Les droits propres au compte, par dérogation à son rôle.
    if (action === "droits") {
      const role = await prisma.role.findUnique({ where: { name: u.role } });
      if (u.kind !== "agent" || !role || role.isAdmin || role.isUsager)
        return redirigerAvecMessage(
          ici,
          "Seul un agent qui n'est pas administrateur peut recevoir des droits personnalisés.",
          "danger",
        );
      const duRole = lireNiveaux(role.permissions);
      // « Revenir aux droits du rôle » efface tout ; sinon chaque catégorie est « comme le
      // rôle » (vide) ou un niveau.
      const saisie = form.get("retablir")
        ? {}
        : Object.fromEntries(
            PERMISSION_CATEGORIES.map((c) => [c, lireNiveau(form.get(`droit_${c}`))]),
          );
      const derogations = derogationsUtiles(duRole, saisie);
      const liste = ecarts(duRole, derogations);
      await prisma.user.update({
        where: { id },
        data: { permissions: liste.length ? derogations : Prisma.DbNull },
      });
      await auditRecord(
        "droits du compte",
        `${u.email} · ${resumeEcarts(liste) || "droits du rôle"}`,
        "utilisateurs",
        admin.email,
      );
      return redirigerAvecMessage(
        `${ici}#droits`,
        liste.length
          ? `Droits de ${nom} enregistrés : ${liste.length} domaine${liste.length > 1 ? "s" : ""} différent${liste.length > 1 ? "s" : ""} de son rôle.`
          : `${nom} a de nouveau les droits de son rôle.`,
        "success",
      );
    }

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
