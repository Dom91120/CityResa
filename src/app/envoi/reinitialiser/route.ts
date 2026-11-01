import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { champ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { auth } from "@/server/auth";
import { getSettings } from "@/server/config-store";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { reprocheMotDePasse } from "@/server/password";

/** POST /reinitialiser : pose le nouveau mot de passe depuis le jeton reçu par courriel. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const token = champ(form, "token");
      const password = String(form.get("password") ?? "");
      const retour = `/reinitialiser?token=${encodeURIComponent(token)}`;
      if (password !== String(form.get("password2") ?? ""))
        return redirigerAvecMessage(
          retour,
          "Les deux mots de passe ne correspondent pas.",
          "danger",
        );
      const cfg = await getSettings();
      const reproche = reprocheMotDePasse(password, cfg.PASSWORD_MIN_LENGTH);
      if (reproche) return redirigerAvecMessage(retour, reproche, "danger");
      try {
        await auth.api.resetPassword({
          body: { newPassword: password, token },
          headers: await headers(),
        });
      } catch (e) {
        if (e instanceof APIError)
          return redirigerAvecMessage(
            "/reinitialiser?error=1",
            "Lien invalide ou expiré.",
            "danger",
          );
        throw e;
      }
      await auditRecord("reinitialisation mot de passe", "", "securite", "anonyme");
      return redirigerAvecMessage(
        "/connexion",
        "Mot de passe modifié : vous pouvez vous connecter.",
        "success",
      );
    },
    "/reinitialiser",
  );
}
