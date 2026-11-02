import { controlerInscription } from "@/lib/dossier-usager";
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
      const type = champ(form, "type");
      const { valeurs: v, manques } = controlerInscription(type, {
        phone: champOuNull(form, "phone"),
        org_name: champOuNull(form, "org_name"),
        address: champOuNull(form, "address"),
        postal_code: champOuNull(form, "postal_code"),
        city: champOuNull(form, "city"),
        siret: champOuNull(form, "siret"),
        rna: champOuNull(form, "rna"),
        legal_first_name: champOuNull(form, "legal_first_name"),
        legal_last_name: champOuNull(form, "legal_last_name"),
        legal_appointed_at: parseDate(form.get("legal_appointed_at")),
      });
      if (manques.length)
        return redirigerAvecMessage(
          "/inscription",
          `Merci de renseigner : ${manques.map((m) => m.charAt(0).toLowerCase() + m.slice(1)).join(", ")}.`,
          "danger",
        );
      try {
        await creerCompteUsager(
          {
            firstName: champ(form, "first_name"),
            lastName: champ(form, "last_name"),
            email: champ(form, "email"),
            phone: v.phone,
            password,
            type,
            orgName: v.org_name,
            address: v.address,
            postalCode: v.postal_code,
            city: v.city,
            siret: v.siret,
            rna: v.rna,
            legalFirstName: v.legal_first_name,
            legalLastName: v.legal_last_name,
            legalAppointedAt: v.legal_appointed_at,
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
