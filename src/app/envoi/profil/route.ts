import { createOTP } from "@better-auth/utils/otp";
import { champ, coche } from "@/lib/forms-util";
import { lireIdentite } from "@/modules/utilisateurs/server";
import { poserMotDePasse } from "@/server/amorcage";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireAgent } from "@/server/guards";
import { redirection, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { nouveauJeton } from "@/server/ics";
import { reprocheMotDePasse, verifyPassword } from "@/server/password";
import {
  cancelEnrolement,
  initTwoFactor,
  normaliserCode,
  pendingEnrolement,
  resetTwoFactor,
} from "@/server/two-factor";

async function motDePasseValide(userId: string, password: string): Promise<boolean> {
  const cred = await prisma.authAccount.findFirst({ where: { userId, providerId: "credential" } });
  return Boolean(cred?.password) && (await verifyPassword(cred?.password ?? "", password));
}

/** POST /profil : identité, notifications, mot de passe, 2FA, lien ICS de l'agent connecté. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireAgent();
      const action = champ(form, "action");
      const ici = "/profil";
      const securite = "/profil#securite";

      if (action === "identite") {
        try {
          const ident = lireIdentite(form);
          await prisma.user.update({
            where: { id: user.id },
            data: { ...ident, name: `${ident.firstName} ${ident.lastName}` },
          });
        } catch (e) {
          if (e instanceof UserFacingError) return redirigerAvecMessage(ici, e.message, "danger");
          throw e;
        }
        await auditRecord("modification profil", "", "profil", user.email);
        return redirigerAvecMessage(ici, "Profil enregistré.", "success");
      }

      if (action === "notifications") {
        const v = coche(form, "notif_email");
        await prisma.user.update({ where: { id: user.id }, data: { notifEmail: v } });
        return redirigerAvecMessage(
          ici,
          v
            ? "Vous recevrez les notifications par courriel."
            : "Notifications par courriel désactivées.",
          "success",
        );
      }

      if (action === "mot_de_passe") {
        const old = String(form.get("old_password") ?? "");
        const nouveau = String(form.get("new_password") ?? "");
        const confirm = String(form.get("confirm_password") ?? "");
        if (!(await motDePasseValide(user.id, old)))
          return redirigerAvecMessage(securite, "Mot de passe actuel incorrect.", "danger");
        if (nouveau !== confirm)
          return redirigerAvecMessage(
            securite,
            "Les deux mots de passe ne correspondent pas.",
            "danger",
          );
        const reproche = reprocheMotDePasse(nouveau, user.settings.PASSWORD_MIN_LENGTH);
        if (reproche) return redirigerAvecMessage(securite, reproche, "danger");
        if (nouveau === old)
          return redirigerAvecMessage(
            securite,
            "Choisissez un mot de passe différent de l'actuel.",
            "danger",
          );
        await poserMotDePasse(user.id, nouveau);
        await auditRecord("changement mot de passe", "", "securite", user.email);
        return redirigerAvecMessage(securite, "Mot de passe modifié.", "success");
      }

      if (action === "init_2fa") {
        if (user.hasTwoFactor) return redirection(securite);
        await initTwoFactor(user.id, user.email);
        return redirection(securite);
      }

      if (action === "cancel_2fa") {
        await cancelEnrolement(user.id);
        return redirigerAvecMessage(securite, "Activation annulée.", "info");
      }

      if (action === "confirm_2fa") {
        const pending = await pendingEnrolement(user.id, user.email);
        const code = normaliserCode(form.get("code"));
        const ok = pending
          ? await createOTP(pending.secret, { digits: 6, period: 30 }).verify(code, { window: 1 })
          : false;
        if (pending && ok) {
          await prisma.twoFactor.updateMany({
            where: { userId: user.id },
            data: { verified: true },
          });
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorEnabled: true, totpFailedCount: 0, totpLockedUntil: null },
          });
          await auditRecord("activation 2FA", "", "securite", user.email);
          return redirigerAvecMessage(securite, "Double authentification activée.", "success");
        }
        return redirigerAvecMessage(
          securite,
          "Code invalide : vérifiez l'heure de votre téléphone et réessayez.",
          "danger",
        );
      }

      if (action === "disable_2fa") {
        if (user.settings.REQUIRE_2FA_ADMIN && user.isAdmin)
          return redirigerAvecMessage(
            securite,
            "La double authentification est obligatoire pour les administrateurs.",
            "warning",
          );
        if (await motDePasseValide(user.id, String(form.get("password") ?? ""))) {
          await resetTwoFactor(user.id);
          await auditRecord("desactivation 2FA", "", "securite", user.email);
          return redirigerAvecMessage(securite, "Double authentification désactivée.", "success");
        }
        return redirigerAvecMessage(securite, "Mot de passe incorrect.", "danger");
      }

      if (action === "ics_generer") {
        await prisma.user.update({ where: { id: user.id }, data: { icsToken: nouveauJeton() } });
        await auditRecord("generation lien ICS", "", "profil", user.email);
        return redirigerAvecMessage(
          ici,
          "Lien ICS généré : copiez-le dans votre agenda.",
          "success",
        );
      }

      if (action === "ics_revoquer") {
        await prisma.user.update({ where: { id: user.id }, data: { icsToken: null } });
        await auditRecord("revocation lien ICS", "", "profil", user.email);
        return redirigerAvecMessage(ici, "Lien ICS révoqué.", "success");
      }

      return redirection(ici);
    },
    "/profil",
  );
}
