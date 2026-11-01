import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { champ, emailValide } from "@/lib/forms-util";
import { poserMotDePasse } from "@/server/amorcage";
import { auditRecord } from "@/server/audit";
import { auth } from "@/server/auth";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { requireUsager } from "@/server/guards";
import { interdit, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { envoyerDepuisModele } from "@/server/mailer";

const ICI = "/portail/mon-organisation";

/**
 * POST /portail/mon-organisation/inviter : un usager invite un collègue dans son
 * organisation. Le compte est créé avec un mot de passe aléatoire, jamais communiqué ;
 * l'invité reçoit le courriel de bienvenue puis un lien pour choisir son mot de passe.
 */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      if (!user.organisationId) return interdit();
      const org = await prisma.organisation.findUnique({ where: { id: user.organisationId } });
      if (!org || org.type === "particulier") return interdit();
      const prenom = champ(form, "first_name").slice(0, 80);
      const nom = champ(form, "last_name").slice(0, 80);
      const email = champ(form, "email").toLowerCase();
      if (!prenom || !nom)
        return redirigerAvecMessage(ICI, "Indiquez le prénom et le nom.", "danger");
      if (!emailValide(email))
        return redirigerAvecMessage(ICI, "Adresse de courriel invalide.", "danger");
      if (await prisma.user.findUnique({ where: { email } }))
        return redirigerAvecMessage(ICI, "Un compte existe déjà avec cette adresse.", "danger");
      const cfg = await getSettings();
      const u = await prisma.user.create({
        data: {
          email,
          name: `${prenom} ${nom}`,
          firstName: prenom,
          lastName: nom,
          kind: "usager",
          role: "usager",
          organisationId: org.id,
        },
      });
      // Mot de passe aléatoire, jamais affiché : l'invité en choisit un via le lien reçu.
      await poserMotDePasse(u.id, `${randomBytes(18).toString("base64url")}a1`);
      await auditRecord("invitation membre", `${email} · ${org.name}`, "usagers", user.email);
      await envoyerDepuisModele("compte_cree", email, {
        prenom,
        lien: `${cfg.APP_BASE_URL}/portail`,
      });
      try {
        await auth.api.requestPasswordReset({
          body: { email, redirectTo: "/reinitialiser" },
          headers: await headers(),
        });
      } catch (e) {
        console.error("[invitation] lien de réinitialisation impossible :", e);
      }
      return redirigerAvecMessage(
        ICI,
        `Invitation envoyée à ${email} : un courriel lui permet de choisir son mot de passe.`,
        "success",
      );
    },
    ICI,
  );
}
