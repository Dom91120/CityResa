import { champ, champOuNull, parseDate } from "@/lib/forms-util";
import { getSettings } from "@/server/config-store";
import { seConnecter } from "@/server/connexion";
import { UserFacingError } from "@/server/errors";
import { getCurrentUser } from "@/server/guards";
import {
  clientIp,
  pasTrouve,
  redirection,
  redirigerAvecMessage,
  traiterFormulaire,
} from "@/server/http";
import { creerCompteUsager } from "@/server/usagers";

/** POST /inscription : création d'un compte usager depuis le portail. */
export async function POST(req: Request) {
  const cfg = await getSettings();
  if (!cfg.INSCRIPTION_ENABLED || !cfg.PORTAIL_ENABLED) return pasTrouve();
  if (await getCurrentUser()) return redirection("/portail");
  return traiterFormulaire(
    req,
    async (form) => {
      const password = String(form.get("password") ?? "");
      if (password !== String(form.get("password2") ?? ""))
        return redirigerAvecMessage(
          "/inscription",
          "Les deux mots de passe ne correspondent pas.",
          "danger",
        );
      if (!form.get("cgu"))
        return redirigerAvecMessage("/inscription", "Merci d'accepter les conditions.", "danger");
      try {
        await creerCompteUsager(
          {
            firstName: champ(form, "first_name"),
            lastName: champ(form, "last_name"),
            email: champ(form, "email"),
            phone: champOuNull(form, "phone"),
            password,
            type: champ(form, "type"),
            orgName: champOuNull(form, "org_name"),
            address: champOuNull(form, "address"),
            postalCode: champOuNull(form, "postal_code"),
            city: champOuNull(form, "city"),
            siret: champOuNull(form, "siret"),
            rna: champOuNull(form, "rna"),
            legalFirstName: champOuNull(form, "legal_first_name"),
            legalLastName: champOuNull(form, "legal_last_name"),
            legalAppointedAt: parseDate(form.get("legal_appointed_at")),
          },
          champ(form, "email"),
        );
      } catch (e) {
        if (e instanceof UserFacingError)
          return redirigerAvecMessage("/inscription", e.message, "danger");
        throw e;
      }
      const res = await seConnecter(champ(form, "email"), password, await clientIp(), null);
      if (!res.ok)
        return redirigerAvecMessage("/connexion", "Compte créé : connectez-vous.", "success");
      return redirigerAvecMessage("/portail", "Bienvenue ! Votre espace est prêt.", "success");
    },
    "/inscription",
  );
}
