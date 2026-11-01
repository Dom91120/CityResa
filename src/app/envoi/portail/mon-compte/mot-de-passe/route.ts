import { poserMotDePasse } from "@/server/amorcage";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireUsager } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { reprocheMotDePasse, verifyPassword } from "@/server/password";

const ICI = "/portail/mon-compte";

/** POST /portail/mon-compte/mot-de-passe : changement de mot de passe (ancien, nouveau, confirmation). */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      const ancien = String(form.get("ancien") ?? "");
      const nouveau = String(form.get("nouveau") ?? "");
      const confirmation = String(form.get("confirmation") ?? "");
      if (nouveau !== confirmation)
        return redirigerAvecMessage(
          ICI,
          "Les deux nouveaux mots de passe ne correspondent pas.",
          "danger",
        );
      const reproche = reprocheMotDePasse(nouveau, user.settings.PASSWORD_MIN_LENGTH);
      if (reproche) return redirigerAvecMessage(ICI, reproche, "danger");
      const cred = await prisma.authAccount.findFirst({
        where: { userId: user.id, providerId: "credential" },
      });
      if (!cred?.password || !(await verifyPassword(cred.password, ancien)))
        return redirigerAvecMessage(ICI, "Le mot de passe actuel est incorrect.", "danger");
      await poserMotDePasse(user.id, nouveau);
      await auditRecord("changement mot de passe", user.email, "securite", user.email);
      return redirigerAvecMessage(ICI, "Mot de passe modifié", "success");
    },
    ICI,
  );
}
