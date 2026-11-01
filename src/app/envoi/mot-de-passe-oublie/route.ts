import { headers } from "next/headers";
import { champ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /mot-de-passe-oublie : envoie le lien de réinitialisation (réponse identique, compte ou non). */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const email = champ(form, "email").toLowerCase();
      const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
      if (user?.isActive) {
        try {
          await auth.api.requestPasswordReset({
            body: { email, redirectTo: "/reinitialiser" },
            headers: await headers(),
          });
          await auditRecord("demande reinitialisation", email, "securite", email);
        } catch (e) {
          console.error("[mot-de-passe] demande impossible :", e);
        }
      }
      return redirigerAvecMessage(
        "/connexion",
        "Si un compte correspond à cette adresse, un lien vient d'être envoyé.",
        "success",
      );
    },
    "/mot-de-passe-oublie",
  );
}
